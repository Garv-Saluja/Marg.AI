import { Router } from "express";
import { query } from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";
import { aiService } from "../services/aiServiceClient.js";

export const practiceRouter = Router();
practiceRouter.use(requireAuth);

// Get practice questions for a concept (bank first, AI-generated fallback — see ai-service)
practiceRouter.post("/questions", async (req, res) => {
  const { userId } = req.user;
  const { conceptId, count } = req.body;

  try {
    const bank = await query(
      `SELECT q.* FROM questions q
       JOIN question_concepts qc ON qc.question_id = q.question_id
       WHERE qc.concept_id = $1 ORDER BY random() LIMIT $2`,
      [conceptId, count || 5]
    );

    if (bank.rowCount >= (count || 5)) {
      return res.json({ source: "bank", questions: bank.rows });
    }

    // Not enough bank questions -> ask ai-service to generate the remainder
    const needed = (count || 5) - bank.rowCount;
    const generated = await aiService.getPracticeQuestions({ userId, conceptId, count: needed });
    res.json({ source: "mixed", questions: [...bank.rows, ...generated.questions] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch practice questions" });
  }
});

// Record a practice attempt (separate from formal assessments, still feeds mastery updates
// via the same mastery_history/concept_mastery tables through a lightweight increment here;
// a full re-estimate happens at the next formal assessment)
practiceRouter.post("/attempt", async (req, res) => {
  const { userId } = req.user;
  const { conceptId, questionId, studentAnswer, isCorrect } = req.body;

  try {
    // TODO(Backend/AI): `attempts.assessment_id` is NOT NULL in the current schema, which
    // assumes every attempt belongs to a formal assessment. Practice attempts don't.
    // Add a `practice_attempts` table (mirrors `attempts` minus the assessment_id FK) and
    // insert into it here; then have the AI service's mastery estimator optionally read
    // recent practice_attempts too (lower weight than formal assessments).
    console.log("Practice attempt received (not yet persisted):", {
      userId,
      conceptId,
      questionId,
      studentAnswer,
      isCorrect,
    });
    res.status(201).json({ recorded: false, note: "See TODO: add practice_attempts table" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record practice attempt" });
  }
});
