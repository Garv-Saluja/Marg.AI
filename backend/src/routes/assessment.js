import { Router } from "express";
import { query } from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";
import { aiService } from "../services/aiServiceClient.js";

export const assessmentRouter = Router();
assessmentRouter.use(requireAuth);

// Start a new assessment (diagnostic | post_teaching | reassessment) for either
// scope=full_syllabus (subjectId) or scope=single_topic (targetConceptId)
assessmentRouter.post("/start", async (req, res) => {
  const { userId } = req.user;
  const { assessmentType, scope, subjectId, targetConceptId, conceptIds } = req.body;

  try {
    const assessment = await query(
      `INSERT INTO assessments (user_id, assessment_type, scope, subject_id, target_concept_id)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [userId, assessmentType, scope, subjectId || null, targetConceptId || null]
    );

    // TODO(AI/NLP + Backend): real adaptive question selection.
    // For MVP: pull N questions per concept from `questions`/`question_concepts`
    // filtered by difficulty; ai-service can later suggest difficulty per concept
    // based on prior mastery (see PLAN in ai-service/app/routers/question_generation.py).
    const targetConcepts = conceptIds && conceptIds.length ? conceptIds : [targetConceptId].filter(Boolean);
    let questions = [];
    if (targetConcepts.length) {
      const result = await query(
        `SELECT q.* FROM questions q
         JOIN question_concepts qc ON qc.question_id = q.question_id
         WHERE qc.concept_id = ANY($1::text[])
         ORDER BY random() LIMIT 10`,
        [targetConcepts]
      );
      questions = result.rows;
    }

    for (const [idx, question] of questions.entries()) {
      await query(
        `INSERT INTO assessment_questions (assessment_id, question_id, order_index)
         VALUES ($1,$2,$3)`,
        [assessment.rows[0].assessment_id, question.question_id, idx]
      );
    }

    res.status(201).json({ assessment: assessment.rows[0], questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to start assessment" });
  }
});

// Submit one answer
assessmentRouter.post("/:assessmentId/answer", async (req, res) => {
  const { userId } = req.user;
  const { assessmentId } = req.params;
  const { questionId, studentAnswer, timeTakenSec } = req.body;

  try {
    const questionResult = await query("SELECT * FROM questions WHERE question_id = $1", [questionId]);
    const question = questionResult.rows[0];
    // TODO: for non-MCQ types, correctness should be judged by ai-service (semantic match / LLM grading)
    const isCorrect = question?.question_type === "mcq" ? studentAnswer === question.correct_answer : null;

    const attempt = await query(
      `INSERT INTO attempts (assessment_id, question_id, user_id, student_answer, is_correct, time_taken_sec)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [assessmentId, questionId, userId, studentAnswer, isCorrect, timeTakenSec || null]
    );
    res.status(201).json(attempt.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to record answer" });
  }
});

// Complete assessment -> ask ai-service to compute concept-level mastery, persist to Postgres
assessmentRouter.post("/:assessmentId/complete", async (req, res) => {
  const { userId } = req.user;
  const { assessmentId } = req.params;

  try {
    const attempts = await query(
      `SELECT a.*, qc.concept_id, qc.weight FROM attempts a
       JOIN question_concepts qc ON qc.question_id = a.question_id
       WHERE a.assessment_id = $1`,
      [assessmentId]
    );

    const estimate = await aiService.estimateKnowledge({
      userId,
      assessmentId,
      attempts: attempts.rows,
    });
    // estimate shape (contract with ai-service):
    // { conceptScores: [{ conceptId, conceptLabel, masteryScore, confidence, status }] }

    for (const c of estimate.conceptScores) {
      await query(
        `INSERT INTO concept_mastery (user_id, concept_id, concept_label, mastery_score, confidence,
           attempts_count, correct_count, status, last_assessed_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now(), now())
         ON CONFLICT (user_id, concept_id) DO UPDATE SET
           mastery_score = EXCLUDED.mastery_score,
           confidence = EXCLUDED.confidence,
           attempts_count = concept_mastery.attempts_count + EXCLUDED.attempts_count,
           correct_count = concept_mastery.correct_count + EXCLUDED.correct_count,
           status = EXCLUDED.status,
           last_assessed_at = now(),
           updated_at = now()`,
        [
          userId,
          c.conceptId,
          c.conceptLabel,
          c.masteryScore,
          c.confidence,
          c.attemptsCount || 0,
          c.correctCount || 0,
          c.status,
        ]
      );
      await query(
        `INSERT INTO mastery_history (user_id, concept_id, mastery_score, reason)
         VALUES ($1,$2,$3,$4)`,
        [userId, c.conceptId, c.masteryScore, req.body.reason || "diagnostic"]
      );
    }

    await query(
      `UPDATE assessments SET status = 'completed', completed_at = now() WHERE assessment_id = $1`,
      [assessmentId]
    );

    res.json({ assessmentId, conceptScores: estimate.conceptScores });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to complete assessment" });
  }
});
