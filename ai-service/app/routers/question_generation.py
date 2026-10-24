
"""
Step 9: Practice question generation.

Generates MCQs through the configured LLM when a question bank
does not have enough questions available.

The endpoint validates the generated content and fails explicitly
rather than silently returning placeholder assessment questions.
"""

import json
import logging
from typing import Literal, List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, field_validator

from app.llm_client import llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/practice", tags=["practice"])


class GenerateRequest(BaseModel):
    userId: str = Field(min_length=1, max_length=128)
    conceptId: str = Field(min_length=1, max_length=256)
    count: int = Field(default=3, ge=1, le=10)
    currentMastery: Optional[float] = Field(
        default=None, ge=0, le=100
    )


class Option(BaseModel):
    id: Literal["a", "b", "c", "d"]
    text: str = Field(min_length=1, max_length=500)


class GeneratedQuestion(BaseModel):
    question_type: Literal["mcq"] = "mcq"
    body: str = Field(min_length=1, max_length=2000)
    options: List[Option] = Field(min_length=4, max_length=4)
    correct_answer: Literal["a", "b", "c", "d"]
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    source: Literal["ai_generated"] = "ai_generated"

    @field_validator("options")
    @classmethod
    def validate_options(cls, options):
        ids = [option.id for option in options]
        if len(set(ids)) != 4 or set(ids) != {"a", "b", "c", "d"}:
            raise ValueError(
                "Options must have unique IDs a, b, c, and d"
            )

        texts = [option.text.strip().casefold() for option in options]
        if len(set(texts)) != 4:
            raise ValueError("All four option texts must be different")

        return options


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


def _parse_questions(raw: str, count: int, difficulty: str):
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("The LLM did not return valid JSON") from exc

    if not isinstance(parsed, list):
        raise ValueError("The LLM response must be a JSON array")

    if len(parsed) != count:
        raise ValueError(
            f"Expected {count} questions, received {len(parsed)}"
        )

    questions = []

    for index, item in enumerate(parsed):
        if not isinstance(item, dict):
            raise ValueError(f"Question {index + 1} must be an object")

        question = item.get("question")
        options = item.get("options")
        correct_index = item.get("correct_index")

        if not isinstance(question, str) or not question.strip():
            raise ValueError(
                f"Question {index + 1} has an invalid question body"
            )

        if (
            not isinstance(options, list)
            or len(options) != 4
            or any(
                not isinstance(option, str) or not option.strip()
                for option in options
            )
        ):
            raise ValueError(
                f"Question {index + 1} must have four non-empty options"
            )

        if len({option.strip().casefold() for option in options}) != 4:
            raise ValueError(
                f"Question {index + 1} contains duplicate options"
            )

        # bool is a subclass of int in Python, so explicitly exclude it.
        if (
            isinstance(correct_index, bool)
            or not isinstance(correct_index, int)
            or not 0 <= correct_index <= 3
        ):
            raise ValueError(
                f"Question {index + 1} has an invalid correct_index"
            )

        questions.append(
            GeneratedQuestion(
                body=question.strip(),
                options=[
                    Option(id=chr(97 + i), text=option.strip())
                    for i, option in enumerate(options)
                ],
                correct_answer=chr(97 + correct_index),
                difficulty=difficulty,
            )
        )

    return questions


@router.post("/select", response_model=GenerateResponse)
def generate_questions(req: GenerateRequest):
    difficulty = _difficulty_for_mastery(req.currentMastery)

    system = (
        "You are a careful computer science exam-question setter. "
        "Return ONLY a valid JSON array, with no Markdown or commentary. "
        "Generate distinct multiple-choice questions about the requested "
        "concept. Each array item must be an object with exactly these keys: "
        '"question" (string), "options" (array of exactly four distinct '
        'strings), and "correct_index" (integer from 0 to 3). '
        "There must be exactly one unambiguously correct answer per question. "
        "The correct_index must point to that answer. Avoid ambiguous wording "
        "and ensure the other options are plausible but incorrect."
    )

    user = (
        f"Generate exactly {req.count} {difficulty}-difficulty MCQs about "
        f"the computer science concept: {req.conceptId}. "
        "Return the JSON array only."
    )

    try:
        raw = llm.complete(
            system=system,
            user=user,
            max_tokens=1600,
            response_format=None,
        )
        questions = _parse_questions(
            raw=raw,
            count=req.count,
            difficulty=difficulty,
        )
    except ValueError as exc:
        logger.warning(
            "Invalid generated questions for concept=%s: %s",
            req.conceptId,
            exc,
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "The AI returned invalid question data. "
                "Please retry the request."
            ),
        ) from exc
    except Exception as exc:
        logger.exception(
            "Question generation failed for concept=%s",
            req.conceptId,
        )
        raise HTTPException(
            status_code=502,
            detail=(
                "Question generation is temporarily unavailable. "
                "Please retry later."
            ),
        ) from exc

    return GenerateResponse(questions=questions)
