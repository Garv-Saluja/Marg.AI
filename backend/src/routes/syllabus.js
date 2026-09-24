import { Router } from "express";
import multer from "multer";
import { query } from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";
import { aiService } from "../services/aiServiceClient.js";

export const syllabusRouter = Router();
syllabusRouter.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// Step 1: upload syllabus file, create subject + syllabus row
syllabusRouter.post("/upload", upload.single("file"), async (req, res) => {
  const { userId } = req.user;
  const { subjectName } = req.body;
  if (!req.file) return res.status(400).json({ error: "file is required" });

  try {
    // TODO(AI/NLP member): real PDF/doc text extraction. For now store a placeholder.
    // Suggested libs: pdf-parse / pdfminer / textract, called either here or via ai-service.
    const rawText = `[TODO: extracted text from ${req.file.originalname}]`;

    const subject = await query(
      `INSERT INTO subjects (name, created_by) VALUES ($1, $2) RETURNING subject_id, name`,
      [subjectName || req.file.originalname, userId]
    );

    const syllabus = await query(
      `INSERT INTO syllabi (subject_id, uploaded_by, original_filename, raw_text, status)
       VALUES ($1, $2, $3, $4, 'uploaded') RETURNING *`,
      [subject.rows[0].subject_id, userId, req.file.originalname, rawText]
    );

    res.status(201).json({ subject: subject.rows[0], syllabus: syllabus.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Syllabus upload failed" });
  }
});

// Step 2: trigger NLP concept extraction (delegates to ai-service, writes concepts to Neo4j there)
syllabusRouter.post("/:syllabusId/process", async (req, res) => {
  const { syllabusId } = req.params;
  try {
    const syllabusResult = await query("SELECT * FROM syllabi WHERE syllabus_id = $1", [syllabusId]);
    if (syllabusResult.rowCount === 0) return res.status(404).json({ error: "Syllabus not found" });
    const syllabus = syllabusResult.rows[0];

    await query("UPDATE syllabi SET status = 'processing' WHERE syllabus_id = $1", [syllabusId]);

    const extraction = await aiService.extractConcepts({
      syllabusId,
      subjectId: syllabus.subject_id,
      rawText: syllabus.raw_text,
    });
    // extraction shape (contract with ai-service):
    // { units: [{ title, order, topics: [{ title, order, concepts: [{id,label}] }] }] }

    // Persist unit/topic structure + topic->concept pointers in Postgres
    for (const [uIdx, unit] of extraction.units.entries()) {
      const unitRow = await query(
        `INSERT INTO units (syllabus_id, title, order_index) VALUES ($1,$2,$3) RETURNING unit_id`,
        [syllabusId, unit.title, unit.order ?? uIdx]
      );
      for (const [tIdx, topic] of unit.topics.entries()) {
        const topicRow = await query(
          `INSERT INTO topics (unit_id, title, order_index) VALUES ($1,$2,$3) RETURNING topic_id`,
          [unitRow.rows[0].unit_id, topic.title, topic.order ?? tIdx]
        );
        for (const concept of topic.concepts) {
          await query(
            `INSERT INTO topic_concepts (topic_id, concept_id, concept_label)
             VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
            [topicRow.rows[0].topic_id, concept.id, concept.label]
          );
        }
      }
    }

    await query("UPDATE syllabi SET status = 'processed' WHERE syllabus_id = $1", [syllabusId]);
    res.json({ syllabusId, status: "processed", unitsCreated: extraction.units.length });
  } catch (err) {
    console.error(err);
    await query("UPDATE syllabi SET status = 'failed' WHERE syllabus_id = $1", [syllabusId]);
    res.status(500).json({ error: "Syllabus processing failed" });
  }
});
