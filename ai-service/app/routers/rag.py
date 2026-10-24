
import os
from functools import lru_cache
from typing import List, Optional

import psycopg
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.llm_client import llm

router = APIRouter(prefix="/teach", tags=["teach"])

DATABASE_URL = os.getenv("DATABASE_URL")
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "mock").lower()
EMBEDDING_MODEL = os.getenv(
    "EMBEDDING_MODEL",
    "sentence-transformers/all-MiniLM-L6-v2",
)


@lru_cache(maxsize=1)
def _model():
    if EMBEDDING_PROVIDER != "local":
        raise RuntimeError("Set EMBEDDING_PROVIDER=local")

    from sentence_transformers import SentenceTransformer

    return SentenceTransformer(EMBEDDING_MODEL, device="cpu")


@lru_cache(maxsize=4096)
def _embed(text: str) -> tuple:
    vector = _model().encode(
        text,
        normalize_embeddings=True,
        convert_to_numpy=True,
    )
    return tuple(float(value) for value in vector)


def _vector_literal(text: str) -> str:
    return "[" + ",".join(str(value) for value in _embed(text)) + "]"


def _db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured for the AI service")

    return psycopg.connect(DATABASE_URL)


def _chunks(text: str, max_chars: int = 1600, overlap: int = 200):
    """Split any syllabus into overlapping text chunks."""
    text = text.strip()

    if not text:
        return []

    chunks = []
    start = 0

    while start < len(text):
        end = min(start + max_chars, len(text))

        if end < len(text):
            boundary = max(
                text.rfind("\n", start, end),
                text.rfind(". ", start, end),
            )
            if boundary > start + max_chars // 2:
                end = boundary + 1

        content = text[start:end].strip()

        if content:
            chunks.append(content)

        if end >= len(text):
            break

        start = max(start + 1, end - overlap)

    return chunks


class IndexSyllabusRequest(BaseModel):
    syllabusId: str
    subjectId: str
    rawText: str = Field(min_length=1)
    sourceFilename: Optional[str] = None


class RagRequest(BaseModel):
    userId: str
    conceptId: str
    question: str = Field(min_length=1)
    subjectId: str = Field(min_length=1)


class RagResponse(BaseModel):
    text: str
    sources: List[dict]


@router.post("/index-syllabus")
def index_syllabus(req: IndexSyllabusRequest):
    """Index or replace the chunks for one uploaded syllabus."""
    if EMBEDDING_PROVIDER != "local":
        raise HTTPException(
            status_code=503,
            detail="Real embeddings are not enabled.",
        )

    chunks = _chunks(req.rawText)

    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No text to index.",
        )

    try:
        # Validate the IDs before doing the more expensive embedding work.
        with _db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT 1
                    FROM syllabi
                    WHERE syllabus_id = %s::uuid
                      AND subject_id = %s::uuid
                    """,
                    (req.syllabusId, req.subjectId),
                )

                if cur.fetchone() is None:
                    raise HTTPException(
                        status_code=404,
                        detail="Syllabus/subject pair was not found.",
                    )

        prepared = [
            (
                req.syllabusId,
                req.subjectId,
                index,
                content,
                _vector_literal(content),
                req.sourceFilename,
            )
            for index, content in enumerate(chunks)
        ]

        # Delete and insert within one transaction so failed indexing
        # does not leave a partially replaced set of chunks.
        with _db() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    DELETE FROM rag_chunks
                    WHERE syllabus_id = %s::uuid
                    """,
                    (req.syllabusId,),
                )

                cur.executemany(
                    """
                    INSERT INTO rag_chunks
                        (syllabus_id, subject_id, chunk_index, content,
                         embedding, source_filename)
                    VALUES
                        (%s::uuid, %s::uuid, %s, %s, %s::vector, %s)
                    """,
                    prepared,
                )

        return {
            "message": "Syllabus indexed successfully.",
            "syllabusId": req.syllabusId,
            "subjectId": req.subjectId,
            "chunksIndexed": len(prepared),
        }

    except HTTPException:
        raise
    except Exception as exc:
        print(f"RAG indexing error: {exc}")
        raise HTTPException(
            status_code=500,
            detail="Failed to index syllabus.",
        ) from exc


def retrieve(
    question: str,
    subject_id: str,
    k: int = 4,
) -> List[dict]:
    """Retrieve the most relevant chunks from the requested subject."""
    if EMBEDDING_PROVIDER != "local":
        raise RuntimeError("Set EMBEDDING_PROVIDER=local")

    if not subject_id:
        raise ValueError("subjectId is required")

    query_vector = _vector_literal(question)

    with _db() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT chunk_id, syllabus_id, subject_id,
                       content, source_filename,
                       embedding <=> %s::vector AS distance
                FROM rag_chunks
                WHERE subject_id = %s::uuid
                ORDER BY embedding <=> %s::vector
                LIMIT %s
                """,
                (query_vector, subject_id, query_vector, k),
            )
            rows = cur.fetchall()

    return [
        {
            "chunkId": row[0],
            "syllabusId": str(row[1]),
            "subjectId": str(row[2]),
            "text": row[3],
            "source": row[4] or "uploaded syllabus",
            "score": 1.0 - float(row[5]),
        }
        for row in rows
    ]


@router.post("/rag-answer", response_model=RagResponse)
def rag_answer(req: RagRequest):
    try:
        retrieved = retrieve(
            question=req.question,
            subject_id=req.subjectId,
        )
    except Exception as exc:
        print(f"RAG retrieval error: {exc}")
        raise HTTPException(
            status_code=503,
            detail="RAG retrieval is unavailable.",
        ) from exc

    context = "\n".join(
        f"- {item['text']} (source: {item['source']})"
        for item in retrieved
    )

    if not context:
        context = "No indexed learning material was found for this subject."

    system = (
        "You are a helpful tutor. Answer using the provided learning context. "
        "If the context does not contain enough information, say so honestly. "
        "Do not invent facts or claim that information came from a source "
        "that was not provided. Keep the answer focused and clear."
    )

    user = (
        f"Concept: {req.conceptId}\n"
        f"Retrieved context:\n{context}\n\n"
        f"Student question: {req.question}"
    )

    try:
        answer = llm.complete(
            system=system,
            user=user,
            max_tokens=1000,
            response_format=None,
        )
    except Exception as exc:
        print(f"RAG LLM error: {exc}")
        raise HTTPException(
            status_code=502,
            detail="Failed to generate the answer.",
        ) from exc

    return RagResponse(text=answer, sources=retrieved)
