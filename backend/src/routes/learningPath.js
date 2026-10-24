
  import { Router } from "express";
  import { pool, query } from "../db/postgres.js";
  import { requireAuth } from "../middleware/auth.js";
  import { aiService } from "../services/aiServiceClient.js";

  export const learningPathRouter = Router();

  learningPathRouter.use(requireAuth);

  const VALID_SCOPES = new Set(["single_topic", "full_syllabus"]);

  const VALID_STATUSES = new Set([
    "pending",
    "in_progress",
    "completed",
    "skipped",
  ]);

  // Generate a personalized learning path.
  learningPathRouter.post("/generate", async (req, res) => {
    const userId = req.user.userId;
    const { scope, targetConceptId, subjectId } = req.body ?? {};

    if (!VALID_SCOPES.has(scope)) {
      return res.status(400).json({
        error: "scope must be single_topic or full_syllabus",
      });
    }

    if (scope === "single_topic" && !targetConceptId) {
      return res.status(400).json({
        error: "targetConceptId is required for single_topic",
      });
    }

    if (scope === "full_syllabus" && !subjectId) {
      return res.status(400).json({
        error: "subjectId is required for full_syllabus",
      });
    }

    try {
      // Fetch the student's current mastery information.
      const masteryResult = await query(
        `SELECT concept_id, mastery_score, status
        FROM concept_mastery
        WHERE user_id = $1`,
        [userId]
      );

      // Request a personalized recommendation from the AI service.
      
        const recommendation = await aiService.recommendPath({
          userId,
          scope,
          targetConceptId:
            scope === "single_topic" ? targetConceptId : undefined,
          subjectId: scope === "full_syllabus" ? subjectId : undefined,
          currentMastery: masteryResult.rows,
        });

        const resolvedTargetConceptId =
          scope === "single_topic"
            ? recommendation?.targetConceptId
            : null;

        if (scope === "single_topic" && !resolvedTargetConceptId) {
          return res.status(502).json({
            error: "The learning service did not resolve the target topic",
          });
        }


      // Validate the recommendation before saving it.
      if (
        !recommendation ||
        !Array.isArray(recommendation.steps) ||
        recommendation.steps.some(
          (step) =>
            !step ||
            !step.conceptId ||
            !step.conceptLabel ||
            !step.reason
        )
      ) {
        console.error(
          "AI service returned an invalid learning path"
        );

        return res.status(502).json({
          error:
            "The learning service returned an invalid recommendation",
        });
      }

      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const pathResult = await client.query(
          `INSERT INTO learning_paths
            (user_id, scope, subject_id, target_concept_id)
          VALUES ($1, $2, $3, $4)
          RETURNING *`,
          [
            userId,
            scope,
            scope === "full_syllabus" ? subjectId : null,
            scope === "single_topic" ? resolvedTargetConceptId : null,
          ]
        );

        const path = pathResult.rows[0];
        const savedSteps = [];

        for (const [index, step] of recommendation.steps.entries()) {
          const stepResult = await client.query(
            `INSERT INTO learning_path_steps
              (learning_path_id, concept_id, concept_label,
              order_index, reason)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *`,
            [
              path.learning_path_id,
              step.conceptId,
              step.conceptLabel,
              index,
              step.reason,
            ]
          );

          savedSteps.push(stepResult.rows[0]);
        }

        await client.query("COMMIT");

        return res.status(201).json({
          learningPath: path,
          steps: savedSteps,
        });
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error(
        "Learning path generation failed:",{
        message: error.message,
        status: error.response?.status,
        response: error.response?.data,
        url: error.config?.url,
    });

      return res.status(500).json({
        error: "Failed to generate learning path",
      });
    }
  });

  // Fetch a learning path owned by the authenticated user.
  learningPathRouter.get("/:pathId", async (req, res) => {
    const userId = req.user.userId;
    const { pathId } = req.params;

    try {
      const pathResult = await query(
        `SELECT *
        FROM learning_paths
        WHERE learning_path_id = $1
          AND user_id = $2`,
        [pathId, userId]
      );

      if (pathResult.rowCount === 0) {
        return res.status(404).json({
          error: "Learning path not found",
        });
      }

      const path = pathResult.rows[0];

      const stepsResult = await query(
        `SELECT *
        FROM learning_path_steps
        WHERE learning_path_id = $1
        ORDER BY order_index`,
        [path.learning_path_id]
      );

      return res.json({
        path,
        steps: stepsResult.rows,
      });
    } catch (error) {
      console.error(
        "Learning path fetch failed:",
        error.message
      );

      return res.status(500).json({
        error: "Failed to fetch learning path",
      });
    }
  });

  // Update a step and synchronize the overall path status.
  learningPathRouter.patch("/steps/:stepId", async (req, res) => {
    const userId = req.user.userId;
    const { stepId } = req.params;
    const { status } = req.body ?? {};

    if (!VALID_STATUSES.has(status)) {
      return res.status(400).json({
        error:
          "status must be pending, in_progress, completed, or skipped",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Update only a step belonging to the authenticated user's path.
      const result = await client.query(
        `UPDATE learning_path_steps AS step
        SET status = $1
        FROM learning_paths AS path
        WHERE step.step_id = $2
          AND step.learning_path_id = path.learning_path_id
          AND path.user_id = $3
        RETURNING step.*`,
        [status, stepId, userId]
      );

      if (result.rowCount === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          error: "Learning step not found",
        });
      }

      const updatedStep = result.rows[0];
      const pathId = updatedStep.learning_path_id;

      // Count all steps in this learning path.
      const totalResult = await client.query(
        `SELECT COUNT(*)::int AS total
        FROM learning_path_steps
        WHERE learning_path_id = $1`,
        [pathId]
      );

      const total = totalResult.rows[0].total;

      // Count steps that are not completed or skipped.
      const remainingResult = await client.query(
        `SELECT COUNT(*)::int AS remaining
        FROM learning_path_steps
        WHERE learning_path_id = $1
          AND status NOT IN ('completed', 'skipped')`,
        [pathId]
      );

      const remaining = remainingResult.rows[0].remaining;

      // An empty path must not be marked completed.
      const pathStatus =
        total > 0 && remaining === 0 ? "completed" : "active";

      // Synchronize the overall learning path status.
      await client.query(
        `UPDATE learning_paths
        SET status = $1
        WHERE learning_path_id = $2
          AND user_id = $3`,
        [pathStatus, pathId, userId]
      );

      await client.query("COMMIT");

      return res.json(updatedStep);
    } catch (error) {
      await client.query("ROLLBACK");

      console.error(
        "Learning step update failed:",
        error.message
      );

      return res.status(500).json({
        error: "Failed to update learning step",
      });
    } finally {
      client.release();
    }
  });
