"""
Step 9: Practice question generation (fallback when the question bank is thin).

Recommended MVP approach (Section 9 of the brief): use a PRE-CREATED question
bank as the primary source (fast, reliable, human-quality-checked), and only
fall back to AI-generated questions when the bank doesn't have enough for a
given concept/difficulty. This endpoint implements that fallback.

Difficulty selection: default to "medium" unless the caller's current mastery
suggests otherwise (low mastery -> easier questions to build confidence first;
see the simple mapping in `_difficulty_for_mastery`).
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import json

from app.llm_client import llm

router = APIRouter(prefix="/practice", tags=["practice"])


class GenerateRequest(BaseModel):
    userId: str
    conceptId: str
    count: int = 3
    currentMastery: Optional[float] = None


class GeneratedQuestion(BaseModel):
    question_type: str = "mcq"
    body: str
    options: Optional[List[dict]] = None
    correct_answer: Optional[str] = None
    difficulty: str = "medium"
    source: str = "ai_generated"


class GenerateResponse(BaseModel):
    questions: List[GeneratedQuestion]


def _difficulty_for_mastery(mastery: Optional[float]) -> str:
    if mastery is None:
        return "medium"
    if mastery < 40:
        return "easy"
    if mastery < 75:
        return "medium"
    return "hard"


@router.post("/select", response_model=GenerateResponse)
def generate_questions(req: GenerateRequest):
    difficulty = _difficulty_for_mastery(req.currentMastery)

    system = (
        "You are a CS exam-question setter. Generate multiple-choice questions as a JSON "
        "array. Each item must have exactly: question (string), options (array of 4 "
        "strings), correct_index (0-3). Return ONLY the JSON array, no other text."
    )
    user = f"Generate {req.count} {difficulty}-difficulty MCQ questions about: {req.conceptId}"

    raw = llm.complete(system=system, user=user, max_tokens=800)

    # TODO: the mock LLM provider won't return valid JSON — this parse will fail
    # until a real provider (anthropic/openai) is configured. Handle parse errors
    # gracefully in the meantime so the practice flow doesn't crash during demos.
    try:
        parsed = json.loads(raw)
        questions = [
            GeneratedQuestion(
                body=item["question"],
                options=[{"id": chr(97 + i), "text": opt} for i, opt in enumerate(item["options"])],
                correct_answer=chr(97 + item["correct_index"]),
                difficulty=difficulty,
            )
            for item in parsed
        ]
    except Exception:
        questions = [
            GeneratedQuestion(
                body=f"[PLACEHOLDER — configure a real LLM_PROVIDER to generate real questions "
                f"about {req.conceptId}]",
                options=[{"id": "a", "text": "Option A"}, {"id": "b", "text": "Option B"}],
                correct_answer="a",
                difficulty=difficulty,
            )
            for _ in range(req.count)
        ]

    return GenerateResponse(questions=questions)
