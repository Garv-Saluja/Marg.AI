import { Router } from "express";
import { query } from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";
import { aiService } from "../services/aiServiceClient.js";

export const learningPathRouter = Router();
learningPathRouter.use(requireAuth);

// Generate a personalized learning path.
// scope = 'single_topic' -> body: { targetConceptId }
// scope = 'full_syllabus' -> body: { subjectId }
learningPathRouter.post("/generate", async (req, res) => {
  const { userId } = req.user;
  const { scope, targetConceptId, subjectId } = req.body;

  try {
    // Pull the student's current mastery so the AI service can reason about gaps
    const mastery = await query(
      `SELECT concept_id, mastery_score, status FROM concept_mastery WHERE user_id = $1`,
      [userId]
    );

    const recommendation = await aiService.recommendPath({
      userId,
      scope,
      targetConceptId,
      subjectId,
      currentMastery: mastery.rows,
    });
    // recommendation shape (contract with ai-service):
    // { steps: [{ conceptId, conceptLabel, reason }] }  -- already topologically ordered

    const pathRow = await query(
      `INSERT INTO learning_paths (user_id, scope, subject_id, target_concept_id)
       VALUES ($1,$2,$3,$4) RETURNING *`,
      [userId, scope, subjectId || null, targetConceptId || null]
    );

    for (const [idx, step] of recommendation.steps.entries()) {
      await query(
        `INSERT INTO learning_path_steps (learning_path_id, concept_id, concept_label, order_index, reason)
         VALUES ($1,$2,$3,$4,$5)`,
        [pathRow.rows[0].learning_path_id, step.conceptId, step.conceptLabel, idx, step.reason]
      );
    }

    res.status(201).json({ learningPath: pathRow.rows[0], steps: recommendation.steps });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate learning path" });
  }
});

learningPathRouter.get("/:pathId", async (req, res) => {
  try {
    const path = await query("SELECT * FROM learning_paths WHERE learning_path_id = $1", [req.params.pathId]);
    if (path.rowCount === 0) return res.status(404).json({ error: "Not found" });
    const steps = await query(
      `SELECT * FROM learning_path_steps WHERE learning_path_id = $1 ORDER BY order_index`,
      [req.params.pathId]
    );
    res.json({ path: path.rows[0], steps: steps.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch learning path" });
  }
});

learningPathRouter.patch("/steps/:stepId", async (req, res) => {
  const { status } = req.body; // pending|in_progress|completed|skipped
  try {
    const result = await query(
      `UPDATE learning_path_steps SET status = $1 WHERE step_id = $2 RETURNING *`,
      [status, req.params.stepId]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update step" });
  }
});
