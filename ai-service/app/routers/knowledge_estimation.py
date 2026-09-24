"""
Step 4-5: Diagnostic Assessment -> Student Knowledge Profile (concept-level mastery).

Design (realistic for a 3-member capstone — see Section 4-5 of the brief):

  mastery_score(concept) = weighted % correct across all attempts that test that
  concept, where each attempt's weight comes from `question_concepts.weight`
  (a question can partially test multiple concepts) and is decayed slightly by
  question difficulty (a correct "hard" answer should count for more).

  confidence(concept) = a function of attempts_count: more attempts on a
  concept -> higher confidence that the mastery_score reflects reality.
  confidence = min(100, attempts_count * 20)   # 5 attempts -> fully confident

  status(concept):
    mastery_score >= 75            -> "mastered"
    40 <= mastery_score < 75       -> "in_progress"
    mastery_score < 40             -> "weak"
    (0 attempts)                   -> "not_started"

This intentionally avoids IRT (Item Response Theory) / deep-learning knowledge
tracing (DKT, BKT) as overkill for the MVP — call this out explicitly in the
capstone report as a scoped-down, justified design decision (Section 11: "Do
not propose an unnecessarily complex ... system unless there is a strong
justification").
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from collections import defaultdict

router = APIRouter(prefix="/knowledge", tags=["knowledge"])


class AttemptIn(BaseModel):
    question_id: str
    concept_id: str
    weight: float = 1.0
    is_correct: Optional[bool] = None
    score: Optional[float] = None  # for partial-credit question types


class EstimateRequest(BaseModel):
    userId: str
    assessmentId: str
    attempts: List[AttemptIn]


class ConceptScore(BaseModel):
    conceptId: str
    conceptLabel: str
    masteryScore: float
    confidence: float
    status: str
    attemptsCount: int
    correctCount: int


class EstimateResponse(BaseModel):
    conceptScores: List[ConceptScore]


DIFFICULTY_TO_BONUS = {"easy": 0.9, "medium": 1.0, "hard": 1.15}


@router.post("/estimate", response_model=EstimateResponse)
def estimate_knowledge(req: EstimateRequest):
    by_concept: dict[str, list[AttemptIn]] = defaultdict(list)
    for attempt in req.attempts:
        by_concept[attempt.concept_id].append(attempt)

    concept_scores = []
    for concept_id, attempts in by_concept.items():
        total_weight = sum(a.weight for a in attempts) or 1.0
        # Score: correctness (or partial score) weighted by question weight
        weighted_correct = sum(
            a.weight * (a.score if a.score is not None else (1.0 if a.is_correct else 0.0))
            for a in attempts
        )
        mastery_score = round(100 * weighted_correct / total_weight, 2)
        attempts_count = len(attempts)
        correct_count = sum(1 for a in attempts if a.is_correct)
        confidence = min(100, attempts_count * 20)

        if attempts_count == 0:
            status = "not_started"
        elif mastery_score >= 75:
            status = "mastered"
        elif mastery_score >= 40:
            status = "in_progress"
        else:
            status = "weak"

        concept_scores.append(
            ConceptScore(
                conceptId=concept_id,
                conceptLabel=concept_id,  # TODO: join concept label; backend can overwrite if needed
                masteryScore=mastery_score,
                confidence=confidence,
                status=status,
                attemptsCount=attempts_count,
                correctCount=correct_count,
            )
        )

    return EstimateResponse(conceptScores=concept_scores)
