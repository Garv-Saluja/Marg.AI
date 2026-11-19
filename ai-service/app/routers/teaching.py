
"""
Step 7: AI Teaching Module.

Provides:
- POST /teach/explain
- POST /teach/reteach

Teaching responses are plain text, so JSON response mode is disabled.

Handles:
- Groq API rate limits (429)
- Temporary AI service failures (503)
- Unexpected generation errors (500)
"""

import logging
from typing import Literal, Optional

from fastapi import APIRouter, HTTPException
from openai import (
    APIConnectionError,
    APITimeoutError,
    APIStatusError,
    RateLimitError,
)
from pydantic import BaseModel, Field

from app.llm_client import llm

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/teach", tags=["teach"])


EXPLANATION_MODE_INSTRUCTIONS = {
    "simple": (
        "Explain simply, avoid jargon, and use one relatable analogy."
    ),
    "detailed": (
        "Give a thorough, technically accurate explanation suitable "
        "for university exam preparation."
    ),
    "example": (
        "Focus on two concrete worked examples, explaining each step."
    ),
    "step_by_step": (
        "Explain the concept in clear, numbered steps."
    ),
    "exam_oriented": (
        "Give an exam-oriented explanation with a definition, key points, "
        "an example, and a short conclusion."
    ),
}


def handle_llm_error(exc: Exception, operation: str):
    """
    Translate LLM provider errors into meaningful
    HTTP responses for the Express backend.
    """

    if isinstance(exc, RateLimitError):
        logger.warning(
            "%s failed: Groq rate limit exceeded",
            operation,
        )

        headers = {}

        response = getattr(exc, "response", None)

        if response is not None:
            retry_after = response.headers.get(
                "retry-after"
            )

            if retry_after:
                headers["Retry-After"] = retry_after

        raise HTTPException(
            status_code=429,
            detail=(
                "AI rate limit exceeded. "
                "Please try again later."
            ),
            headers=headers,
        ) from exc

    if isinstance(
        exc,
        (APIConnectionError, APITimeoutError),
    ):
        logger.error(
            "%s failed: AI provider connection error: %s",
            operation,
            str(exc),
        )

        raise HTTPException(
            status_code=503,
            detail=(
                "AI provider is temporarily unavailable. "
                "Please try again later."
            ),
        ) from exc

    if isinstance(exc, APIStatusError):
        logger.error(
            "%s failed: Groq API status=%s",
            operation,
            exc.status_code,
        )

        if exc.status_code in (500, 502, 503, 504):
            raise HTTPException(
                status_code=503,
                detail=(
                    "AI provider is temporarily unavailable. "
                    "Please try again later."
                ),
            ) from exc

        raise HTTPException(
            status_code=502,
            detail="AI provider rejected the generation request.",
        ) from exc

    logger.exception(
        "%s failed due to an unexpected error",
        operation,
    )

    raise HTTPException(
        status_code=500,
        detail="Failed to generate AI teaching content.",
    ) from exc


class ExplainRequest(BaseModel):
    userId: str
    conceptId: str
    explanationMode: Literal[
        "simple",
        "detailed",
        "example",
        "step_by_step",
        "exam_oriented",
    ] = "simple"
    currentMastery: float = Field(
        default=0,
        ge=0,
        le=100,
    )


class ExplainResponse(BaseModel):
    text: str
    conceptId: str
    explanationMode: str


@router.post(
    "/explain",
    response_model=ExplainResponse,
)
def explain_concept(req: ExplainRequest):

    if req.currentMastery < 40:
        level_hint = (
            "The student is a beginner. "
            "Start with the fundamentals "
            "and define unfamiliar terms."
        )
    else:
        level_hint = (
            "The student has some understanding. "
            "Build on the fundamentals "
            "and introduce appropriate technical detail."
        )

    system = (
        "You are an expert, encouraging computer science tutor "
        "for a B.Tech student. "
        "Return a natural-language explanation, not JSON. "
        f"{EXPLANATION_MODE_INSTRUCTIONS[req.explanationMode]} "
        f"{level_hint} "
        "Keep the explanation focused and useful."
    )

    user = (
        "Explain this computer science concept: "
        f"{req.conceptId}"
    )

    try:
        text = llm.complete(
            system=system,
            user=user,
            max_tokens=1000,
            response_format=None,
        )

        return ExplainResponse(
            text=text,
            conceptId=req.conceptId,
            explanationMode=req.explanationMode,
        )

    except Exception as exc:
        handle_llm_error(
            exc,
            "Generate explanation",
        )


class ReteachRequest(BaseModel):
    userId: str
    conceptId: str
    weakSubConceptId: Optional[str] = None
    lastAttemptSummary: Optional[str] = None


class ReteachResponse(BaseModel):
    text: str


@router.post(
    "/reteach",
    response_model=ReteachResponse,
)
def reteach(req: ReteachRequest):

    system = (
        "You are a patient computer science tutor. "
        "The student struggled with this concept previously. "
        "Explain it using a different, simple analogy "
        "and one concrete example. "
        "Directly address the likely misconception. "
        "Return natural-language text, not JSON. "
        "Be concise: use at most five short paragraphs. "
        "Avoid repeating the same explanation."
    )

    user = (
        f"Concept: {req.conceptId}\n"
        f"Weak sub-concept: "
        f"{req.weakSubConceptId or 'unspecified'}\n"
        "Student's previous difficulty: "
        f"{req.lastAttemptSummary or 'not provided'}"
    )

    try:
        text = llm.complete(
            system=system,
            user=user,
            max_tokens=1000,
            response_format=None,
        )

        return ReteachResponse(
            text=text,
        )

    except Exception as exc:
        handle_llm_error(
            exc,
            "Generate re-teaching content",
        )
