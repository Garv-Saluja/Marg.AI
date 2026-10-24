
import { Router } from "express";
import { query } from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";
import { aiService } from "../services/aiServiceClient.js";

export const practiceRouter = Router();

practiceRouter.use(requireAuth);

// Get practice questions for a concept.
// Fetch database questions first, then ask the AI service for any remainder.
practiceRouter.post("/questions", async (req, res) => {
  const { userId } = req.user;
  const { conceptId, count } = req.body ?? {};

  if (typeof conceptId !== "string" || !conceptId.trim()) {
    return res.status(400).json({
      error: "conceptId is required",
    });
  }

  const questionCount = count === undefined ? 5 : Number(count);

  if (
    !Number.isInteger(questionCount) ||
    questionCount < 1 ||
    questionCount > 20
  ) {
    return res.status(400).json({
      error: "count must be an integer between 1 and 20",
    });
  }

  try {
    // EXISTS avoids duplicate questions caused by multiple matching links.
    // No SELECT DISTINCT is needed, so ORDER BY random() works in PostgreSQL.
    const bank = await query(
      `SELECT q.*
       FROM questions q
       WHERE EXISTS (
         SELECT 1
         FROM question_concepts qc
         WHERE qc.question_id = q.question_id
           AND qc.concept_id = $1
       )
       ORDER BY random()
       LIMIT $2`,
      [conceptId.trim(), questionCount]
    );

    if (bank.rowCount >= questionCount) {
      return res.json({
        source: "bank",
        questions: bank.rows,
      });
    }

    const needed = questionCount - bank.rowCount;

    const generated = await aiService.getPracticeQuestions({
      userId,
      conceptId: conceptId.trim(),
      count: needed,
    });

    const generatedQuestions = Array.isArray(generated?.questions)
      ? generated.questions
      : [];

    return res.json({
      source: bank.rowCount > 0 ? "mixed" : "ai",
      questions: [...bank.rows, ...generatedQuestions],
    });
  } catch (err) {
    console.error("Fetching practice questions failed:", err.message);

    return res.status(500).json({
      error: "Failed to fetch practice questions",
    });
  }
});

// Record a practice attempt.
// The backend calculates correctness using the stored answer key.
practiceRouter.post("/attempt", async (req, res) => {
  const { userId } = req.user;
  const { conceptId, questionId, studentAnswer } = req.body ?? {};

  if (
    typeof conceptId !== "string" ||
    !conceptId.trim() ||
    typeof questionId !== "string" ||
    !questionId.trim() ||
    typeof studentAnswer !== "string" ||
    !studentAnswer.trim()
  ) {
    return res.status(400).json({
      error: "conceptId, questionId, and studentAnswer are required",
    });
  }

  try {
    // Confirm the question exists and is associated with this concept.
    const questionResult = await query(
      `SELECT q.question_id, q.correct_answer
       FROM questions q
       WHERE q.question_id = $1
         AND (
           q.concept_id = $2
           OR EXISTS (
             SELECT 1
             FROM question_concepts qc
             WHERE qc.question_id = q.question_id
               AND qc.concept_id = $2
           )
         )
       LIMIT 1`,
      [questionId.trim(), conceptId.trim()]
    );

    if (questionResult.rowCount === 0) {
      return res.status(404).json({
        error:
          "Stored practice question not found for this concept. AI-generated questions must be saved to the database before their attempts can be recorded.",
      });
    }

    const correctAnswer = questionResult.rows[0].correct_answer;

    if (correctAnswer == null) {
      return res.status(422).json({
        error:
          "This question does not have an answer key for automatic grading",
      });
    }

    const isCorrect =
      studentAnswer.trim() === String(correctAnswer).trim();

    const attemptResult = await query(
      `INSERT INTO practice_attempts
         (user_id, question_id, concept_id, student_answer, is_correct)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING
         practice_attempt_id,
         question_id,
         concept_id,
         is_correct,
         answered_at`,
      [
        userId,
        questionResult.rows[0].question_id,
        conceptId.trim(),
        studentAnswer.trim(),
        isCorrect,
      ]
    );

    return res.status(201).json({
      recorded: true,
      attempt: attemptResult.rows[0],
    });
  } catch (err) {
    console.error("Recording practice attempt failed:", err.message);

    return res.status(500).json({
      error: "Failed to record practice attempt",
    });
  }
});
