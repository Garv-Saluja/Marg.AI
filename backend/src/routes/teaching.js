
import { Router } from "express";
import { query } from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";
import { aiService } from "../services/aiServiceClient.js";

export const teachingRouter = Router();

teachingRouter.use(requireAuth);

// Extract authenticated user ID.
function getUserId(req) {
  return (
    req.user?.userId ??
    req.user?.user_id ??
    req.user?.id ??
    req.user?.sub
  );
}

// Handle errors consistently, including AI rate limits.
function handleTeachingError(err, res, operation) {
  const rawStatus = err.response?.status ?? err.status;
  const status = Number(rawStatus);

  console.error(`${operation} error:`, {
    status: Number.isFinite(status) ? status : 500,
    details: err.response?.data || err.message,
  });

  if (status === 429) {
    const retryAfter =
      err.response?.headers?.["retry-after"] ??
      err.response?.headers?.get?.("retry-after");

    if (retryAfter != null) {
      res.set("Retry-After", String(retryAfter));
    }

    return res.status(429).json({
      error: "AI service rate limit exceeded",
      message:
        "The AI service has reached its request or token limit. Please try again later.",
    });
  }

  if (status === 503) {
    return res.status(503).json({
      error: "AI service temporarily unavailable",
      message:
        "The AI service is currently unavailable. Please try again later.",
    });
  }

  return res.status(500).json({
    error: `Failed to ${operation.toLowerCase()}`,
  });
}

// ------------------------------------------------------
// 1. GENERATE EXPLANATION
// ------------------------------------------------------
// Modes: simple | detailed | example |
// step_by_step | exam_oriented

teachingRouter.post("/explain", async (req, res) => {
  const userId = getUserId(req);

  const {
    conceptId,
    explanationMode,
    sessionId,
  } = req.body ?? {};

  if (!userId) {
    return res.status(401).json({
      error: "Authenticated user ID was not found.",
    });
  }

  if (
    typeof conceptId !== "string" ||
    !conceptId.trim()
  ) {
    return res.status(400).json({
      error: "conceptId is required.",
    });
  }

  try {
    const masteryRow = await query(
      `SELECT mastery_score
       FROM concept_mastery
       WHERE user_id = $1
         AND concept_id = $2`,
      [userId, conceptId.trim()]
    );

    const currentMastery =
      masteryRow.rows[0]?.mastery_score ?? 0;

    const explanation = await aiService.teachConcept({
      userId,
      conceptId: conceptId.trim(),
      explanationMode: explanationMode || "simple",
      currentMastery,
    });

    await query(
      `INSERT INTO ai_interactions
         (
           user_id,
           concept_id,
           session_id,
           interaction_type,
           ai_response
         )
       VALUES ($1, $2, $3, 'explanation', $4)`,
      [
        userId,
        conceptId.trim(),
        sessionId || null,
        explanation.text,
      ]
    );

    return res.json(explanation);
  } catch (err) {
    return handleTeachingError(
      err,
      res,
      "Generate explanation"
    );
  }
});

// ------------------------------------------------------
// 2. RAG-BACKED DOUBT SUPPORT
// ------------------------------------------------------


teachingRouter.post("/ask", async (req, res) => {
  const userId =
    req.user?.userId ??
    req.user?.user_id ??
    req.user?.id ??
    req.user?.sub;

  const {
    conceptId,
    question,
    sessionId,
    stepId,
    subjectId,
  } = req.body ?? {};

  if (!userId) {
    return res.status(401).json({
      error: "Authentication required.",
    });
  }

  if (
    typeof conceptId !== "string" ||
    !conceptId.trim() ||
    typeof question !== "string" ||
    !question.trim()
  ) {
    return res.status(400).json({
      error: "conceptId and question are required.",
    });
  }

  const concept = conceptId.trim();

  try {
    let resolvedSubjectId = null;

    // 1. Validate an explicitly supplied subject.
    if (subjectId) {
      const result = await query(
        `SELECT DISTINCT s.subject_id
         FROM syllabi s
         WHERE s.subject_id = $1::uuid
           AND s.uploaded_by = $2
         LIMIT 1`,
        [subjectId, userId]
      );

      if (!result.rows.length) {
        return res.status(403).json({
          error:
            "Subject not found in your uploaded syllabi.",
        });
      }

      resolvedSubjectId = result.rows[0].subject_id;
    }

    // 2. Resolve the subject from a learning-path step.
    if (!resolvedSubjectId && stepId) {
      const result = await query(
        `SELECT DISTINCT s.subject_id
         FROM learning_path_steps lps
         JOIN learning_paths lp
           ON lp.learning_path_id =
              lps.learning_path_id
         JOIN syllabi s
           ON s.subject_id = lp.subject_id
         WHERE lps.step_id = $1::uuid
           AND lp.user_id = $2
           AND lps.concept_id = $3
           AND s.uploaded_by = $2
         LIMIT 1`,
        [stepId, userId, concept]
      );

      resolvedSubjectId =
        result.rows[0]?.subject_id ?? null;
    }

    // 3. Find the concept's subject from the
    // authenticated user's uploaded syllabus.
    if (!resolvedSubjectId) {
      const result = await query(
        `SELECT DISTINCT s.subject_id
         FROM topic_concepts tc
         JOIN topics t
           ON t.topic_id = tc.topic_id
         JOIN units u
           ON u.unit_id = t.unit_id
         JOIN syllabi s
           ON s.syllabus_id = u.syllabus_id
         WHERE tc.concept_id = $1
           AND s.uploaded_by = $2`,
        [concept, userId]
      );

      if (result.rows.length === 1) {
        resolvedSubjectId =
          result.rows[0].subject_id;
      }
    }

    // 4. Fallback only if the student has
    // exactly one uploaded subject.
    if (!resolvedSubjectId) {
      const result = await query(
        `SELECT DISTINCT subject_id
         FROM syllabi
         WHERE uploaded_by = $1`,
        [userId]
      );

      if (result.rows.length === 1) {
        resolvedSubjectId =
          result.rows[0].subject_id;
      }
    }

    // Never guess when multiple subjects exist.
    if (!resolvedSubjectId) {
      return res.status(400).json({
        error:
          "Unable to identify a unique syllabus for this concept. Please open the concept from a subject-linked learning path.",
      });
    }

    // 5. Send the question to FastAPI RAG.
    const answer = await aiService.askDoubt({
      userId,
      conceptId: concept,
      question: question.trim(),
      subjectId: resolvedSubjectId,
    });

    // 6. Save the interaction.
    await query(
      `INSERT INTO ai_interactions
       (
         user_id,
         concept_id,
         session_id,
         interaction_type,
         user_message,
         ai_response,
         retrieved_context
       )
       VALUES ($1, $2, $3, 'doubt', $4, $5, $6)`,
      [
        userId,
        concept,
        sessionId || null,
        question.trim(),
        answer.text,
        JSON.stringify(answer.sources || []),
      ]
    );

    return res.json(answer);

  } catch (err) {
    const status =
      err.response?.status ?? err.status;

    console.error("Ask doubt error:", {
      status,
      details:
        err.response?.data || err.message,
    });

    if (status === 429) {
      return res.status(429).json({
        error:
          "AI service rate limit exceeded.",
      });
    }

    if (status === 503) {
      return res.status(503).json({
        error:
          "RAG or AI service is unavailable.",
      });
    }

    return res.status(500).json({
      error: "Failed to answer doubt.",
    });
  }
});


// ------------------------------------------------------
// 3. RE-TEACHING AFTER POOR PERFORMANCE
// ------------------------------------------------------

teachingRouter.post("/reteach", async (req, res) => {
  const userId = getUserId(req);

  const {
    conceptId,
    weakSubConceptId,
    lastAttemptSummary,
  } = req.body ?? {};

  if (!userId) {
    return res.status(401).json({
      error: "Authenticated user ID was not found.",
    });
  }

  if (
    typeof conceptId !== "string" ||
    !conceptId.trim()
  ) {
    return res.status(400).json({
      error: "conceptId is required.",
    });
  }

  try {
    const result = await aiService.reteach({
      userId,
      conceptId: conceptId.trim(),
      weakSubConceptId,
      lastAttemptSummary,
    });

    await query(
      `INSERT INTO ai_interactions
         (
           user_id,
           concept_id,
           interaction_type,
           ai_response
         )
       VALUES ($1, $2, 'reteach', $3)`,
      [
        userId,
        conceptId.trim(),
        result.text,
      ]
    );

    return res.json(result);
  } catch (err) {
    return handleTeachingError(
      err,
      res,
      "Generate re-teaching content"
    );
  }
});
