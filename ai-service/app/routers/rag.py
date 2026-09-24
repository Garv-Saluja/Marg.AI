"""
Step 7-G/8: RAG (Retrieval-Augmented Generation) for AI doubt support.

Pipeline (Section 8 of the brief):
  Documents -> Text Extraction -> Chunking -> Embeddings -> Vector DB -> Retrieval
  -> Relevant Context -> LLM -> Personalized Explanation

For an MVP scale (a handful of subjects, a few hundred pages of notes total):
  - Chunking: ~300-500 tokens per chunk, naive fixed-size or paragraph-based.
    No need for fancy semantic chunking for a capstone.
  - Embeddings: sentence-transformers (all-MiniLM-L6-v2) run locally — free,
    fast enough, no API cost. Swap EMBEDDING_PROVIDER=openai if you'd rather
    use an API and skip the ~90MB model download.
  - Vector DB: an in-memory list of (chunk, embedding) pairs is genuinely fine
    for a capstone (few thousand chunks max). Don't reach for Pinecone/Weaviate
    unless you want the extra infra complexity for its own sake. `pgvector`
    (a Postgres extension) is the natural "upgrade" if you want persistence
    without adding a new database.
  - Retrieval: cosine similarity, top-k (k=3-5), optionally filtered to chunks
    tagged with the current concept_id so a DBMS question doesn't retrieve OS notes.

This file ships a minimal in-memory store (`_VECTOR_STORE`) and a mock
embedding function so the /teach/rag-answer contract is stable immediately;
swap `_embed` and `_VECTOR_STORE` for the real pipeline without changing the
request/response shape the backend depends on.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
import os
import math
import random

from app.llm_client import llm

router = APIRouter(prefix="/teach", tags=["teach"])

EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "mock")

# In-memory vector store: list of {conceptId, text, embedding, source}
# TODO: replace with pgvector or a real vector DB once resources are uploaded
# at scale. Seed a few example chunks so /rag-answer has something to retrieve.
_VECTOR_STORE: List[dict] = [
    {
        "conceptId": "dbms.functional_dependencies",
        "text": "A functional dependency X -> Y means that the value of attribute set X "
        "uniquely determines the value of attribute set Y in a relation.",
        "source": "seed_notes.md",
    },
    {
        "conceptId": "dbms.normalization",
        "text": "Normalization is the process of organizing columns and tables to minimize "
        "data redundancy and avoid update/insert/delete anomalies.",
        "source": "seed_notes.md",
    },
]


def _embed(text: str) -> List[float]:
    if EMBEDDING_PROVIDER == "mock":
        # Deterministic pseudo-embedding (hash-based) so cosine similarity is at
        # least stable/repeatable for demo purposes. NOT semantically meaningful.
        random.seed(hash(text) % (2**32))
        return [random.random() for _ in range(16)]
    # TODO: real embeddings
    #   if EMBEDDING_PROVIDER == "local": use sentence-transformers
    #   if EMBEDDING_PROVIDER == "openai": call the OpenAI embeddings endpoint
    raise NotImplementedError(f"Embedding provider '{EMBEDDING_PROVIDER}' not implemented yet")


def _cosine(a: List[float], b: List[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(x * x for x in b))
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


def retrieve(concept_id: str, question: str, k: int = 3) -> List[dict]:
    candidates = [c for c in _VECTOR_STORE if c["conceptId"] == concept_id] or _VECTOR_STORE
    if EMBEDDING_PROVIDER == "mock":
        # mock embeddings aren't meaningful, so just return the concept-filtered chunks
        return candidates[:k]
    q_emb = _embed(question)
    scored = [(c, _cosine(q_emb, _embed(c["text"]))) for c in candidates]
    scored.sort(key=lambda x: x[1], reverse=True)
    return [c for c, _ in scored[:k]]


class RagRequest(BaseModel):
    userId: str
    conceptId: str
    question: str


class RagResponse(BaseModel):
    text: str
    sources: List[dict]


@router.post("/rag-answer", response_model=RagResponse)
def rag_answer(req: RagRequest):
    retrieved = retrieve(req.conceptId, req.question)
    context = "\n".join(f"- {c['text']} (source: {c['source']})" for c in retrieved)

    system = (
        "You are a CS tutor answering a student's doubt. Use ONLY the provided context "
        "where relevant; if the context doesn't cover the question, say so honestly rather "
        "than inventing facts. Keep the answer focused and concise."
    )
    user = f"Context:\n{context}\n\nStudent's question about {req.conceptId}: {req.question}"

    text = llm.complete(system=system, user=user, max_tokens=600)
    return RagResponse(text=text, sources=retrieved)
