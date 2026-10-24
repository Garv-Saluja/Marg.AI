
import { Router } from "express";
import { query } from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";
import { aiService } from "../services/aiServiceClient.js";

export const teachingRouter = Router();
teachingRouter.use(requireAuth);

// Explanation modes: simple|detailed|example|step_by_step|exam_oriented
teachingRouter.post("/explain", async (req, res) => {
  const userId =
    req.user?.userId ??
    req.user?.user_id ??
    req.user?.id ??
    req.user?.sub;

  const { conceptId, explanationMode, sessionId } = req.body;

  if (!userId || !conceptId) {
    return res.status(400).json({
      error: "conceptId is required.",
    });
  }

  try {
    const masteryRow = await query(
      `SELECT mastery_score
       FROM concept_mastery
       WHERE user_id = $1 AND concept_id = $2`,
      [userId, conceptId]
    );

    const currentMastery = masteryRow.rows[0]?.mastery_score ?? 0;

    const explanation = await aiService.teachConcept({
      userId,
      conceptId,
      explanationMode: explanationMode || "simple",
      currentMastery,
    });

    await query(
      `INSERT INTO ai_interactions
         (user_id, concept_id, session_id, interaction_type, ai_response)
       VALUES ($1, $2, $3, 'explanation', $4)`,
      [userId, conceptId, sessionId || null, explanation.text]
    );

    return res.json(explanation);
  } catch (err) {
    console.error(
      "Generate explanation error:",
      err.response?.status,
      err.response?.data || err.message
    );

    return res.status(500).json({
      error: "Failed to generate explanation",
    });
  }
});

// RAG-backed doubt support

teachingRouter.post("/ask", async (req, res) => {
  const userId =
    req.user?.userId ??
    req.user?.user_id ??
    req.user?.id ??
    req.user?.sub;

  const { conceptId, question, sessionId, stepId, subjectId } =
    req.body ?? {};

  if (!userId) {
    return res.status(401).json({
      error: "Authenticated user ID was not found.",
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

  try {
    let resolvedSubjectId = subjectId || null;

    // Resolve the subject from this user's learning path.
    if (!resolvedSubjectId && stepId) {
      const stepResult = await query(
        `SELECT COALESCE(
           lp.subject_id,
           (
             SELECT s.subject_id
             FROM topic_concepts tc
             JOIN topics t ON t.topic_id = tc.topic_id
             JOIN units u ON u.unit_id = t.unit_id
             JOIN syllabi s ON s.syllabus_id = u.syllabus_id
             WHERE tc.concept_id = lps.concept_id
             ORDER BY s.uploaded_at DESC
             LIMIT 1
           )
         ) AS subject_id
         FROM learning_path_steps lps
         JOIN learning_paths lp
           ON lp.learning_path_id = lps.learning_path_id
         WHERE lps.step_id = $1::uuid
           AND lp.user_id = $2
           AND lps.concept_id = $3`,
        [stepId, userId, conceptId.trim()]
      );

      resolvedSubjectId = stepResult.rows[0]?.subject_id || null;
    }

    if (!resolvedSubjectId) {
      return res.status(400).json({
        error:
          "Could not determine the subject for this concept. Open it from a valid learning path or provide its subjectId.",
      });
    }

    const answer = await aiService.askDoubt({
      userId,
      conceptId: conceptId.trim(),
      question: question.trim(),
      subjectId: resolvedSubjectId,
    });

    await query(
      `INSERT INTO ai_interactions
         (user_id, concept_id, session_id, interaction_type,
          user_message, ai_response, retrieved_context)
       VALUES ($1, $2, $3, 'doubt', $4, $5, $6)`,
      [
        userId,
        conceptId.trim(),
        sessionId || null,
        question.trim(),
        answer.text,
        JSON.stringify(answer.sources || []),
      ]
    );

    return res.json(answer);
  } catch (err) {
    console.error(
      "Ask doubt error:",
      err.response?.status,
      err.response?.data || err.message
    );

    return res.status(500).json({
      error: "Failed to answer doubt",
    });
  }
});


// Re-teaching after poor post-teaching performance
teachingRouter.post("/reteach", async (req, res) => {
  const userId =
    req.user?.userId ??
    req.user?.user_id ??
    req.user?.id ??
    req.user?.sub;

  const { conceptId, weakSubConceptId, lastAttemptSummary } = req.body;

  if (!userId || !conceptId) {
    return res.status(400).json({
      error: "conceptId is required.",
    });
  }

  try {
    const result = await aiService.reteach({
      userId,
      conceptId,
      weakSubConceptId,
      lastAttemptSummary,
    });

    await query(
      `INSERT INTO ai_interactions
         (user_id, concept_id, interaction_type, ai_response)
       VALUES ($1, $2, 'reteach', $3)`,
      [userId, conceptId, result.text]
    );

    return res.json(result);
  } catch (err) {
    console.error(
      "Re-teach error:",
      err.response?.status,
      err.response?.data || err.message
    );

    return res.status(500).json({
      error: "Failed to generate re-teaching content",
    });
  }
});
