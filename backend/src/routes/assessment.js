import { Router } from "express";
import { pool } from "../db/postgres.js";
import { requireAuth } from "../middleware/auth.js";
import { aiService } from "../services/aiServiceClient.js";

export const assessmentRouter = Router();

assessmentRouter.use(requireAuth);

const VALID_ASSESSMENT_TYPES = new Set([
  "diagnostic",
  "post_teaching",
  "reassessment",
]);

const VALID_SCOPES = new Set(["full_syllabus", "single_topic"]);

const VALID_MASTERY_STATUSES = new Set([
  "not_started",
  "weak",
  "in_progress",
  "mastered",
]);

const VALID_HISTORY_REASONS = new Set([
  "diagnostic",
  "post_teaching",
  "reassessment",
]);

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

async function getOwnedAssessment(client, assessmentId, userId) {
  const result = await client.query(
    `SELECT *
     FROM assessments
     WHERE assessment_id = $1 AND user_id = $2
     FOR UPDATE`,
    [assessmentId, userId]
  );

  return result.rows[0] ?? null;
}

// Start an assessment using AI-generated questions.
assessmentRouter.post("/start", async (req, res) => {
  const { userId } = req.user;

  const {
    assessmentType,
    scope,
    subjectId,
    targetConceptId,
    conceptIds,
  } = req.body ?? {};

  if (!VALID_ASSESSMENT_TYPES.has(assessmentType)) {
    return res.status(400).json({
      error:
        "assessmentType must be diagnostic, post_teaching, or reassessment",
    });
  }

  if (!VALID_SCOPES.has(scope)) {
    return res.status(400).json({
      error: "scope must be full_syllabus or single_topic",
    });
  }

  if (scope === "full_syllabus" && !isNonEmptyString(subjectId)) {
    return res.status(400).json({
      error: "subjectId is required for full_syllabus assessments",
    });
  }

  if (
    scope === "single_topic" &&
    !isNonEmptyString(targetConceptId)
  ) {
    return res.status(400).json({
      error: "targetConceptId is required for single_topic assessments",
    });
  }

  if (
    conceptIds !== undefined &&
    (!Array.isArray(conceptIds) ||
      conceptIds.some((id) => !isNonEmptyString(id)))
  ) {
    return res.status(400).json({
      error: "conceptIds must be an array of non-empty strings",
    });
  }

  const client = await pool.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    let targetConcepts = [
      ...new Set(
        (conceptIds?.length
          ? conceptIds
          : [targetConceptId].filter(Boolean)
        ).map((id) => id.trim())
      ),
    ];

    // Verify subject and find its concepts for full-syllabus assessments.
    if (scope === "full_syllabus") {
      const subjectResult = await client.query(
        `SELECT subject_id
         FROM subjects
         WHERE subject_id = $1`,
        [subjectId]
      );

      if (subjectResult.rowCount === 0) {
        await client.query("ROLLBACK");
        transactionOpen = false;

        return res.status(404).json({
          error: "Subject not found",
        });
      }

      if (targetConcepts.length === 0) {
        const conceptsResult = await client.query(
          `SELECT DISTINCT tc.concept_id
           FROM syllabi sy
           JOIN units u ON u.syllabus_id = sy.syllabus_id
           JOIN topics t ON t.unit_id = u.unit_id
           JOIN topic_concepts tc ON tc.topic_id = t.topic_id
           WHERE sy.subject_id = $1
           ORDER BY tc.concept_id`,
          [subjectId]
        );

        targetConcepts = conceptsResult.rows.map(
          (row) => row.concept_id
        );
      }
    }

    if (targetConcepts.length === 0) {
      await client.query("ROLLBACK");
      transactionOpen = false;

      return res.status(400).json({
        error:
          scope === "full_syllabus"
            ? "No concepts are linked to this subject yet. Process its syllabus first."
            : "Provide conceptIds or targetConceptId for the assessment.",
      });
    }

    // Create the assessment.
    const assessmentResult = await client.query(
      `INSERT INTO assessments
         (user_id, assessment_type, scope, subject_id, target_concept_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [
        userId,
        assessmentType,
        scope,
        scope === "full_syllabus" ? subjectId : null,
        scope === "single_topic" ? targetConceptId.trim() : null,
      ]
    );

    const assessment = assessmentResult.rows[0];

    // Generate up to 10 questions through the Python AI service.
    const generatedQuestions = [];
    const questionLimit = 10;

    for (
      let conceptIndex = 0;
      conceptIndex < targetConcepts.length &&
      generatedQuestions.length < questionLimit;
      conceptIndex += 1
    ) {
      const conceptId = targetConcepts[conceptIndex];
      const remaining = questionLimit - generatedQuestions.length;
      const conceptsLeft = targetConcepts.length - conceptIndex;

      const count = Math.min(
        10,
        Math.ceil(remaining / conceptsLeft)
      );

      // Use current mastery to adapt question difficulty.
      const masteryResult = await client.query(
        `SELECT mastery_score
         FROM concept_mastery
         WHERE user_id = $1 AND concept_id = $2`,
        [userId, conceptId]
      );

      const currentMastery = masteryResult.rowCount > 0
        ? Number(masteryResult.rows[0].mastery_score)
        : null;

      let aiResult;

      try {
        aiResult = await aiService.getPracticeQuestions({
          userId,
          conceptId,
          count,
          currentMastery,
        });
      } catch (aiError) {
        console.error(
          `AI question generation failed for concept ${conceptId}:`,
          aiError.response?.data || aiError.message
        );

        await client.query("ROLLBACK");
        transactionOpen = false;

        return res.status(502).json({
          error:
            "AI question generation failed. Check that the Python AI service is running and try again.",
        });
      }

      if (
        !Array.isArray(aiResult?.questions) ||
        aiResult.questions.length === 0
      ) {
        await client.query("ROLLBACK");
        transactionOpen = false;

        return res.status(502).json({
          error: `AI returned no questions for concept ${conceptId}`,
        });
      }

      for (const question of aiResult.questions) {
        if (generatedQuestions.length >= questionLimit) {
          break;
        }

        const validOptions =
          Array.isArray(question.options) &&
          question.options.length === 4 &&
          question.options.every(
            (option) =>
              option &&
              ["a", "b", "c", "d"].includes(option.id) &&
              isNonEmptyString(option.text)
          ) &&
          new Set(question.options.map((option) => option.id)).size === 4;

        if (
          !isNonEmptyString(question.body) ||
          !validOptions ||
          !["a", "b", "c", "d"].includes(question.correct_answer)
        ) {
          throw new Error(
            `AI returned an invalid question for concept ${conceptId}`
          );
        }

        generatedQuestions.push({
          ...question,
          conceptId,
        });
      }
    }

    if (generatedQuestions.length === 0) {
      await client.query("ROLLBACK");
      transactionOpen = false;

      return res.status(502).json({
        error: "AI did not generate any assessment questions.",
      });
    }

    const safeQuestions = [];

    // Save generated questions and their concept mappings.
    for (const [index, question] of generatedQuestions.entries()) {
      const insertedQuestion = await client.query(
        `INSERT INTO questions
           (concept_id, question_type, difficulty, body,
            options, correct_answer, source)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
         RETURNING
           question_id,
           concept_id,
           question_type,
           difficulty,
           body,
           options,
           source`,
        [
          question.conceptId,
          question.question_type || "mcq",
          question.difficulty || "medium",
          question.body,
          JSON.stringify(question.options),
          question.correct_answer,
          "ai_generated",
        ]
      );

      const savedQuestion = insertedQuestion.rows[0];

      // Used by the mastery-estimation endpoint.
      await client.query(
        `INSERT INTO question_concepts
           (question_id, concept_id, weight)
         VALUES ($1, $2, $3)`,
        [savedQuestion.question_id, question.conceptId, 1.0]
      );

      // Attach question to the assessment.
      await client.query(
        `INSERT INTO assessment_questions
           (assessment_id, question_id, order_index)
         VALUES ($1, $2, $3)`,
        [assessment.assessment_id, savedQuestion.question_id, index]
      );

      // Never send the answer key to the frontend.
      safeQuestions.push(savedQuestion);
    }

    await client.query("COMMIT");
    transactionOpen = false;

    return res.status(201).json({
      assessment,
      questions: safeQuestions,
    });
  } catch (err) {
    if (transactionOpen) {
      await client.query("ROLLBACK").catch(() => {});
    }

    console.error("Start assessment failed:", err);

    return res.status(500).json({
      error: "Failed to start assessment",
    });
  } finally {
    client.release();
  }
});

// Submit an answer. Only one answer per question per assessment is allowed.
assessmentRouter.post("/:assessmentId/answer", async (req, res) => {
  const { userId } = req.user;
  const { assessmentId } = req.params;

  const { questionId, studentAnswer, timeTakenSec } = req.body ?? {};

  if (
    !isNonEmptyString(questionId) ||
    typeof studentAnswer !== "string"
  ) {
    return res.status(400).json({
      error: "questionId and a string studentAnswer are required",
    });
  }

  if (
    timeTakenSec !== undefined &&
    timeTakenSec !== null &&
    (!Number.isInteger(timeTakenSec) || timeTakenSec < 0)
  ) {
    return res.status(400).json({
      error: "timeTakenSec must be a non-negative integer",
    });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const assessment = await getOwnedAssessment(
      client,
      assessmentId,
      userId
    );

    if (!assessment) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Assessment not found",
      });
    }

    if (assessment.status !== "in_progress") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "This assessment is no longer in progress",
      });
    }

    const questionResult = await client.query(
      `SELECT q.question_id, q.question_type, q.correct_answer
       FROM assessment_questions aq
       JOIN questions q ON q.question_id = aq.question_id
       WHERE aq.assessment_id = $1
         AND aq.question_id = $2`,
      [assessmentId, questionId]
    );

    if (questionResult.rowCount === 0) {
      await client.query("ROLLBACK");

      return res.status(400).json({
        error: "Question does not belong to this assessment",
      });
    }

    const question = questionResult.rows[0];

    const previousAttempt = await client.query(
      `SELECT attempt_id
       FROM attempts
       WHERE assessment_id = $1
         AND question_id = $2
         AND user_id = $3`,
      [assessmentId, questionId, userId]
    );

    if (previousAttempt.rowCount > 0) {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "An answer has already been submitted for this question",
      });
    }

    const isCorrect =
      question.question_type === "mcq"
        ? studentAnswer.trim() === question.correct_answer?.trim()
        : null;

    const attemptResult = await client.query(
      `INSERT INTO attempts
         (assessment_id, question_id, user_id, student_answer,
          is_correct, time_taken_sec)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        assessmentId,
        questionId,
        userId,
        studentAnswer,
        isCorrect,
        timeTakenSec ?? null,
      ]
    );

    await client.query("COMMIT");

    return res.status(201).json(attemptResult.rows[0]);
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Submit assessment answer failed:", err);

    return res.status(500).json({
      error: "Failed to record answer",
    });
  } finally {
    client.release();
  }
});

// Complete assessment and update concept-level mastery.
assessmentRouter.post("/:assessmentId/complete", async (req, res) => {
  const { userId } = req.user;
  const { assessmentId } = req.params;

  const client = await pool.connect();

  try {
    const assessmentResult = await client.query(
      `SELECT *
       FROM assessments
       WHERE assessment_id = $1 AND user_id = $2`,
      [assessmentId, userId]
    );

    if (assessmentResult.rowCount === 0) {
      return res.status(404).json({
        error: "Assessment not found",
      });
    }

    const assessment = assessmentResult.rows[0];

    if (assessment.status !== "in_progress") {
      return res.status(409).json({
        error: "Assessment has already been completed or abandoned",
      });
    }

    const attemptsResult = await client.query(
      `SELECT
         a.question_id,
         qc.concept_id,
         qc.weight::float AS weight,
         a.is_correct,
         a.score
       FROM attempts a
       JOIN assessment_questions aq
         ON aq.assessment_id = a.assessment_id
        AND aq.question_id = a.question_id
       JOIN question_concepts qc
         ON qc.question_id = a.question_id
       WHERE a.assessment_id = $1
         AND a.user_id = $2
       ORDER BY a.answered_at`,
      [assessmentId, userId]
    );

    if (attemptsResult.rowCount === 0) {
      return res.status(400).json({
        error: "Submit at least one answer before completing the assessment",
      });
    }

    const aiAttempts = attemptsResult.rows.map((attempt) => {
      const normalized = {
        question_id: attempt.question_id,
        concept_id: attempt.concept_id,
        weight: Number(attempt.weight),
        is_correct: attempt.is_correct,
      };

      if (attempt.score !== null && attempt.score !== undefined) {
        const score = Number(attempt.score);

        if (!Number.isFinite(score) || score < 0 || score > 1) {
          throw new Error(
            "Stored partial-credit score must be between 0 and 1"
          );
        }

        normalized.score = score;
      }

      return normalized;
    });

    const estimate = await aiService.estimateKnowledge({
      userId,
      assessmentId,
      attempts: aiAttempts,
    });

    if (
      !estimate ||
      !Array.isArray(estimate.conceptScores) ||
      estimate.conceptScores.length === 0
    ) {
      return res.status(502).json({
        error: "AI service returned an invalid or empty mastery estimate",
      });
    }

    for (const score of estimate.conceptScores) {
      if (
        !isNonEmptyString(score.conceptId) ||
        !Number.isFinite(Number(score.masteryScore)) ||
        Number(score.masteryScore) < 0 ||
        Number(score.masteryScore) > 100 ||
        !Number.isFinite(Number(score.confidence)) ||
        Number(score.confidence) < 0 ||
        Number(score.confidence) > 100 ||
        !Number.isInteger(score.attemptsCount) ||
        score.attemptsCount < 0 ||
        !Number.isInteger(score.correctCount) ||
        score.correctCount < 0 ||
        score.correctCount > score.attemptsCount ||
        !VALID_MASTERY_STATUSES.has(score.status)
      ) {
        return res.status(502).json({
          error: "AI service returned an invalid concept mastery score",
        });
      }
    }

    const historyReason = VALID_HISTORY_REASONS.has(
      assessment.assessment_type
    )
      ? assessment.assessment_type
      : "diagnostic";

    await client.query("BEGIN");

    const lockedAssessment = await getOwnedAssessment(
      client,
      assessmentId,
      userId
    );

    if (!lockedAssessment) {
      await client.query("ROLLBACK");

      return res.status(404).json({
        error: "Assessment not found",
      });
    }

    if (lockedAssessment.status !== "in_progress") {
      await client.query("ROLLBACK");

      return res.status(409).json({
        error: "Assessment has already been completed or abandoned",
      });
    }

    for (const concept of estimate.conceptScores) {
      const conceptLabel = isNonEmptyString(concept.conceptLabel)
        ? concept.conceptLabel.trim().slice(0, 255)
        : concept.conceptId;

      await client.query(
        `INSERT INTO concept_mastery
           (user_id, concept_id, concept_label, mastery_score, confidence,
            attempts_count, correct_count, status, last_assessed_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
         ON CONFLICT (user_id, concept_id) DO UPDATE SET
           concept_label = EXCLUDED.concept_label,
           mastery_score = EXCLUDED.mastery_score,
           confidence = EXCLUDED.confidence,
           attempts_count =
             concept_mastery.attempts_count + EXCLUDED.attempts_count,
           correct_count =
             concept_mastery.correct_count + EXCLUDED.correct_count,
           status = EXCLUDED.status,
           last_assessed_at = now(),
           updated_at = now()`,
        [
          userId,
          concept.conceptId,
          conceptLabel,
          Number(concept.masteryScore),
          Number(concept.confidence),
          concept.attemptsCount,
          concept.correctCount,
          concept.status,
        ]
      );

      await client.query(
        `INSERT INTO mastery_history
           (user_id, concept_id, mastery_score, reason)
         VALUES ($1, $2, $3, $4)`,
        [
          userId,
          concept.conceptId,
          Number(concept.masteryScore),
          historyReason,
        ]
      );
    }

    const completedResult = await client.query(
      `UPDATE assessments
       SET status = 'completed', completed_at = now()
       WHERE assessment_id = $1
         AND user_id = $2
         AND status = 'in_progress'
       RETURNING assessment_id, status, completed_at`,
      [assessmentId, userId]
    );

    if (completedResult.rowCount !== 1) {
      throw new Error("Assessment could not be marked completed");
    }

    await client.query("COMMIT");

    return res.json({
      assessment: completedResult.rows[0],
      conceptScores: estimate.conceptScores,
    });
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error("Complete assessment failed:", err);

    return res.status(500).json({
      error: "Failed to complete assessment",
    });
  } finally {
    client.release();
  }
});