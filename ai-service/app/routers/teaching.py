"""
Step 7: AI Teaching Module.

Design: one LLM call per explanation request, with a system prompt built from:
  - the concept's label + (later) a short curated description from Neo4j/resources
  - the requested explanation mode (simple/detailed/example/step_by_step/exam_oriented)
  - the student's current mastery (adjusts vocabulary/depth — "beginner" framing
    below ~40% mastery, more technical framing above)

RAG (retrieved course material / notes) is handled in rag.py — /teach/rag-answer
is for doubt-support specifically. /teach/explain below is intentionally a
plain LLM call for the *first* explanation of a concept (no student question
to retrieve against yet); once resources are uploaded, swap this to also pull
top-k chunks the same way rag.py does before generating.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional, Literal

from app.llm_client import llm

router = APIRouter(prefix="/teach", tags=["teach"])

EXPLANATION_MODE_INSTRUCTIONS = {
    "simple": "Explain this as simply as possible, avoiding jargon, using a short analogy.",
    "detailed": "Give a thorough, technically precise explanation suitable for exam preparation.",
    "example": "Skip the theory and go straight to 2-3 worked examples of increasing difficulty.",
    "step_by_step": "Break this into small numbered steps, each building on the last.",
    "exam_oriented": "Explain this the way a topper would answer it in a university exam, "
    "including the standard structure examiners expect.",
}


class ExplainRequest(BaseModel):
    userId: str
    conceptId: str
    explanationMode: Literal["simple", "detailed", "example", "step_by_step", "exam_oriented"] = "simple"
    currentMastery: float = 0


class ExplainResponse(BaseModel):
    text: str
    conceptId: str
    explanationMode: str


@router.post("/explain", response_model=ExplainResponse)
def explain_concept(req: ExplainRequest):
    level_hint = "The student is a beginner on this concept." if req.currentMastery < 40 else (
        "The student has partial understanding; build on that rather than starting from zero."
    )
    system = (
        "You are an expert, encouraging computer science tutor for a B.Tech student. "
        f"{EXPLANATION_MODE_INSTRUCTIONS[req.explanationMode]} {level_hint}"
    )
    # TODO: replace the bare concept id with its human label + any curated
    # description/resources once those are wired up (Neo4j Concept.description,
    # or a resource lookup by concept_id).
    user = f"Explain the concept: {req.conceptId}"

    text = llm.complete(system=system, user=user, max_tokens=700)
    return ExplainResponse(text=text, conceptId=req.conceptId, explanationMode=req.explanationMode)


class ReteachRequest(BaseModel):
    userId: str
    conceptId: str
    weakSubConceptId: Optional[str] = None
    lastAttemptSummary: Optional[str] = None


class ReteachResponse(BaseModel):
    text: str


@router.post("/reteach", response_model=ReteachResponse)
def reteach(req: ReteachRequest):
    """Step 7-I: Re-teaching. Deliberately does NOT reuse the same explanation —
    the system prompt instructs the LLM to take a different angle."""
    system = (
        "You are a patient CS tutor. The student was already taught this concept once and "
        "still struggled. Do NOT repeat a similar explanation — use a different analogy, a "
        "simpler concrete example, and explicitly address the likely misconception."
    )
    user = (
        f"Concept: {req.conceptId}\n"
        f"Weak sub-concept: {req.weakSubConceptId or 'unspecified'}\n"
        f"Summary of the student's last attempt/mistakes: {req.lastAttemptSummary or 'not provided'}"
    )
    text = llm.complete(system=system, user=user, max_tokens=700)
    return ReteachResponse(text=text)
