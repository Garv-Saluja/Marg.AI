import { Router } from "express";
import { query } from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";
import { aiService } from "../services/aiServiceClient.js";

export const teachingRouter = Router();
teachingRouter.use(requireAuth);

// explanationMode: simple|detailed|example|step_by_step|exam_oriented
teachingRouter.post("/explain", async (req, res) => {
  const { userId } = req.user;
  const { conceptId, explanationMode, sessionId } = req.body;

  try {
    const masteryRow = await query(
      `SELECT mastery_score FROM concept_mastery WHERE user_id = $1 AND concept_id = $2`,
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
      `INSERT INTO ai_interactions (user_id, concept_id, session_id, interaction_type, ai_response)
       VALUES ($1,$2,$3,'explanation',$4)`,
      [userId, conceptId, sessionId || null, explanation.text]
    );

    res.json(explanation);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate explanation" });
  }
});

// RAG-backed doubt support
teachingRouter.post("/ask", async (req, res) => {
  const { userId } = req.user;
  const { conceptId, question, sessionId } = req.body;

  try {
    const answer = await aiService.askDoubt({ userId, conceptId, question });

    await query(
      `INSERT INTO ai_interactions (user_id, concept_id, session_id, interaction_type, user_message, ai_response, retrieved_context)
       VALUES ($1,$2,$3,'doubt',$4,$5,$6)`,
      [userId, conceptId, sessionId || null, question, answer.text, JSON.stringify(answer.sources || [])]
    );

    res.json(answer);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to answer doubt" });
  }
});

// Re-teaching after poor post-teaching performance
teachingRouter.post("/reteach", async (req, res) => {
  const { userId } = req.user;
  const { conceptId, weakSubConceptId, lastAttemptSummary } = req.body;

  try {
    const result = await aiService.reteach({ userId, conceptId, weakSubConceptId, lastAttemptSummary });

    await query(
      `INSERT INTO ai_interactions (user_id, concept_id, interaction_type, ai_response)
       VALUES ($1,$2,'reteach',$3)`,
      [userId, conceptId, result.text]
    );

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate re-teaching content" });
  }
});
