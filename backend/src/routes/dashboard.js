import { Router } from "express";
import { query } from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";

export const dashboardRouter = Router();
dashboardRouter.use(requireAuth);

// Overview: subjects touched, concepts learned/mastered, overall progress
dashboardRouter.get("/overview", async (req, res) => {
  const { userId } = req.user;
  const mastery = await query(
    `SELECT status, COUNT(*) AS count FROM concept_mastery WHERE user_id = $1 GROUP BY status`,
    [userId]
  );
  // TODO: join subjects the user has active learning paths/syllabi in
  res.json({
    conceptCounts: Object.fromEntries(mastery.rows.map((r) => [r.status, Number(r.count)])),
  });
});

// Knowledge profile: concept-wise mastery, strong/weak concepts
dashboardRouter.get("/knowledge-profile", async (req, res) => {
  const { userId } = req.user;
  const result = await query(
    `SELECT concept_id, concept_label, mastery_score, confidence, status, last_assessed_at
     FROM concept_mastery WHERE user_id = $1 ORDER BY mastery_score ASC`,
    [userId]
  );
  res.json({
    weakConcepts: result.rows.filter((r) => Number(r.mastery_score) < 50),
    strongConcepts: result.rows.filter((r) => Number(r.mastery_score) >= 75),
    all: result.rows,
  });
});

// Current learning: active learning path + current step

 // Current learning: return all saved learning paths and their steps
dashboardRouter.get("/current-learning", async (req, res) => {
  try {
    const { userId } = req.user;

    // Fetch all paths belonging to this user, not just the newest active path.
    const pathsResult = await query(
      `SELECT *
       FROM learning_paths
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );

    // Fetch the steps belonging to each path.
    const learningPaths = await Promise.all(
      pathsResult.rows.map(async (path) => {
        const stepsResult = await query(
          `SELECT *
           FROM learning_path_steps
           WHERE learning_path_id = $1
           ORDER BY order_index`,
          [path.learning_path_id]
        );

        return {
          ...path,
          steps: stepsResult.rows,
        };
      })
    );

    res.json({ learningPaths });
  } catch (error) {
    console.error("Failed to fetch learning paths:", error);

    res.status(500).json({
      error: "Failed to fetch learning paths",
    });
  }
});

// Assessment history
dashboardRouter.get("/assessments", async (req, res) => {
  const { userId } = req.user;
  const result = await query(
    `SELECT assessment_id, assessment_type, scope, target_concept_id, started_at, completed_at, status
     FROM assessments WHERE user_id = $1 ORDER BY started_at DESC LIMIT 50`,
    [userId]
  );
  res.json(result.rows);
});

// Progress over time (for charts)
dashboardRouter.get("/progress", async (req, res) => {
  const { userId } = req.user;
  const result = await query(
    `SELECT concept_id, mastery_score, reason, recorded_at
     FROM mastery_history WHERE user_id = $1 ORDER BY recorded_at ASC`,
    [userId]
  );
  res.json(result.rows);
});
