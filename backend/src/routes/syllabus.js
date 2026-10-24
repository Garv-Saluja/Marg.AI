
import express from "express";
import multer from "multer";
import { PDFParse } from "pdf-parse";

import { query } from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";
import { aiService } from "../services/aiServiceClient.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    const isPdf =
      file.mimetype === "application/pdf" ||
      file.originalname.toLowerCase().endsWith(".pdf");

    if (!isPdf) {
      return callback(new Error("Only PDF files are allowed."));
    }

    callback(null, true);
  },
});

async function extractPdfText(buffer) {
  const parser = new PDFParse({
    data: new Uint8Array(buffer),
  });

  try {
    const result = await parser.getText();
    return (result.text || "").trim();
  } finally {
    await parser.destroy();
  }
}

function getUserId(req) {
  return (
    req.user?.userId ??
    req.user?.user_id ??
    req.user?.id ??
    req.user?.sub
  );
}

/**
 * POST /api/syllabus/upload
 * multipart/form-data:
 *   subjectName: DBMS
 *   file: <PDF>
 */
router.post(
  "/upload",
  requireAuth,
  upload.single("file"),
  async (req, res) => {
    try {
      const subjectName = req.body.subjectName?.trim();
      const file = req.file;
      const userId = getUserId(req);

      if (!userId) {
        return res.status(401).json({
          message: "Authenticated user ID was not found.",
        });
      }

      if (!subjectName) {
        return res.status(400).json({
          message: "subjectName is required.",
        });
      }

      if (!file) {
        return res.status(400).json({
          message: "Upload a PDF using the file field.",
        });
      }

      let rawText;

      try {
        rawText = await extractPdfText(file.buffer);
      } catch (error) {
        console.error("PDF extraction error:", error);

        return res.status(400).json({
          message: "Could not extract text from this PDF.",
        });
      }

      if (!rawText) {
        return res.status(400).json({
          message:
            "No readable text was found. Scanned PDFs may require OCR.",
        });
      }

      const subjectResult = await query(
        `INSERT INTO subjects (name, created_by)
         VALUES ($1, $2)
         RETURNING *`,
        [subjectName, userId]
      );

      const subject = subjectResult.rows[0];

      const syllabusResult = await query(
        `INSERT INTO syllabi
           (subject_id, uploaded_by, original_filename, raw_text, status)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING syllabus_id, subject_id, uploaded_by,
                   original_filename, status, uploaded_at`,
        [
          subject.subject_id,
          userId,
          file.originalname,
          rawText,
          "uploaded",
        ]
      );

      return res.status(201).json({
        message: "Syllabus uploaded and text extracted successfully.",
        subject,
        syllabus: {
          ...syllabusResult.rows[0],
          extractedCharacterCount: rawText.length,
        },
      });
    } catch (error) {
      console.error("Syllabus upload error:", error);

      return res.status(500).json({
        message: "Failed to upload syllabus.",
        error: error.message,
      });
    }
  }
);

/**
 * POST /api/syllabus/:syllabusId/process
 */
router.post("/:syllabusId/process", requireAuth, async (req, res) => {
  try {
    const { syllabusId } = req.params;
    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({
        message: "Authenticated user ID was not found.",
      });
    }

    const syllabusResult = await query(
      `SELECT s.syllabus_id,
              s.subject_id,
              s.uploaded_by,
              s.raw_text,
              s.status,
              sub.name AS subject_name
       FROM syllabi s
       JOIN subjects sub ON sub.subject_id = s.subject_id
       WHERE s.syllabus_id = $1
         AND s.uploaded_by = $2`,
      [syllabusId, userId]
    );

    if (syllabusResult.rows.length === 0) {
      return res.status(404).json({
        message: "Syllabus not found or access denied.",
      });
    }

    const syllabus = syllabusResult.rows[0];

    if (!syllabus.raw_text?.trim()) {
      return res.status(400).json({
        message: "This syllabus has no extracted text. Upload it again.",
      });
    }

    // Correct call matching your existing aiServiceClient.js.
    const aiResult = await aiService.extractConcepts({
      syllabusId: syllabus.syllabus_id,
      subjectId: syllabus.subject_id,
      rawText: syllabus.raw_text,
    });

    if (!Array.isArray(aiResult?.units)) {
      console.error("Unexpected AI response:", aiResult);

      return res.status(502).json({
        message: "AI service returned an unexpected response.",
      });
    }

    let savedUnits = 0;
    let savedTopics = 0;
    let savedConcepts = 0;

    for (let unitIndex = 0; unitIndex < aiResult.units.length; unitIndex++) {
      const unit = aiResult.units[unitIndex];

      const unitResult = await query(
        `INSERT INTO units (syllabus_id, title, order_index)
         VALUES ($1, $2, $3)
         RETURNING unit_id`,
        [
          syllabus.syllabus_id,
          unit.title || `Unit ${unitIndex + 1}`,
          unitIndex + 1,
        ]
      );

      const unitId = unitResult.rows[0].unit_id;
      savedUnits++;

      const topics = Array.isArray(unit.topics) ? unit.topics : [];

      for (let topicIndex = 0; topicIndex < topics.length; topicIndex++) {
        const topic = topics[topicIndex];

        const topicResult = await query(
          `INSERT INTO topics (unit_id, title, order_index)
           VALUES ($1, $2, $3)
           RETURNING topic_id`,
          [
            unitId,
            topic.title || `Topic ${topicIndex + 1}`,
            topicIndex + 1,
          ]
        );

        const topicId = topicResult.rows[0].topic_id;
        savedTopics++;

        const concepts = Array.isArray(topic.concepts)
          ? topic.concepts
          : [];

        for (const concept of concepts) {
          const conceptId =
            typeof concept === "string"
              ? concept
              : concept?.id ?? concept?.conceptId;

          const conceptLabel =
            typeof concept === "string"
              ? concept
              : concept?.label ?? concept?.name ?? conceptId;

          if (!conceptId || !conceptLabel) {
            continue;
          }

          await query(
            `INSERT INTO topic_concepts
               (topic_id, concept_id, concept_label)
             VALUES ($1, $2, $3)
             ON CONFLICT (topic_id, concept_id) DO NOTHING`,
            [topicId, conceptId, conceptLabel]
          );

          savedConcepts++;
        }
      }
    }

    await query(
      `UPDATE syllabi
       SET status = $1
       WHERE syllabus_id = $2`,
      ["processed", syllabus.syllabus_id]
    );

    return res.status(200).json({
      message: "Syllabus processed successfully.",
      syllabusId: syllabus.syllabus_id,
      subjectId: syllabus.subject_id,
      subjectName: syllabus.subject_name,
      summary: {
        units: savedUnits,
        topics: savedTopics,
        concepts: savedConcepts,
      },
    });
  } catch (error) {
    console.error("Syllabus processing error:", error);

    return res.status(500).json({
      message: "Failed to process syllabus.",
      error: error.message,
    });
  }
});

router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    return res.status(400).json({
      message:
        error.code === "LIMIT_FILE_SIZE"
          ? "PDF must be 20 MB or smaller."
          : error.message,
    });
  }

  if (error.message === "Only PDF files are allowed.") {
    return res.status(400).json({ message: error.message });
  }

  next(error);
});

export { router as syllabusRouter };