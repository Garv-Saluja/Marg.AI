
import logging
import os
import time
from typing import List, Optional

import psycopg
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import HashingVectorizer

from app.llm_client import llm

router = APIRouter(prefix="/teach", tags=["teach"])

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("margai.rag")

DATABASE_URL = os.getenv("DATABASE_URL")
EMBEDDING_PROVIDER = os.getenv("EMBEDDING_PROVIDER", "local").lower()

# Lightweight, deterministic 384-dimensional vectors.
# No PyTorch, model download, external embedding API, or API key required.
_vectorizer = HashingVectorizer(
    n_features=384,
    alternate_sign=False,
    norm="l2",
    lowercase=True,
    ngram_range=(1, 2),
    dtype="float32",
)


def log_stage(message: str):
    logger.info("[RAG] %s", message)


def _embed(text: str) -> tuple:
    """Generate a deterministic 384-dimensional text vector."""
    vector = _vectorizer.transform([text]).toarray()[0]
    return tuple(float(value) for value in vector)


def _vector_literal(text: str) -> str:
    return "[" + ",".join(str(value) for value in _embed(text)) + "]"


def _db():
    if not DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not configured for the AI service")

    return psycopg.connect(DATABASE_URL, connect_timeout=15)


def _chunks(text: str, max_chars: int = 1600, overlap: int = 200):
    """Split syllabus text into overlapping chunks."""
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
    """Replace syllabus chunks using lightweight incremental indexing."""
    started = time.monotonic()

    log_stage(
        f"INDEX START syllabus={req.syllabusId} "
        f"subject={req.subjectId} chars={len(req.rawText)}"
    )

    chunks = _chunks(req.rawText)
    log_stage(f"CHUNKING COMPLETE count={len(chunks)}")

    if not chunks:
        raise HTTPException(status_code=400, detail="No text to index.")

    batch_size = 4
    indexed_count = 0

    try:
        log_stage("DB CONNECT START")

        # The context manager commits on success and rolls back on failure.
        with _db() as conn:
            with conn.cursor() as cur:
                log_stage("DB CONNECTED; validating syllabus")

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

                log_stage("VALIDATION OK; deleting previous chunks")

                cur.execute(
                    """
                    DELETE FROM rag_chunks
                    WHERE syllabus_id = %s::uuid
                    """,
                    (req.syllabusId,),
                )

                for start in range(0, len(chunks), batch_size):
                    batch = chunks[start:start + batch_size]
                    batch_number = start // batch_size + 1

                    log_stage(
                        f"BATCH {batch_number} START count={len(batch)}"
                    )

                    embed_started = time.monotonic()
                    embeddings = [_embed(chunk) for chunk in batch]

                    log_stage(
                        f"BATCH {batch_number} EMBEDDING COMPLETE "
                        f"seconds={time.monotonic() - embed_started:.3f}"
                    )

                    prepared = [
                        (
                            req.syllabusId,
                            req.subjectId,
                            start + offset,
                            content,
                            "[" + ",".join(
                                str(value) for value in embedding
                            ) + "]",
                            req.sourceFilename,
                        )
                        for offset, (content, embedding)
                        in enumerate(zip(batch, embeddings))
                    ]

                    cur.executemany(
                        """
                        INSERT INTO rag_chunks
                            (syllabus_id, subject_id, chunk_index,
                             content, embedding, source_filename)
                        VALUES
                            (%s::uuid, %s::uuid, %s, %s,
                             %s::vector, %s)
                        """,
                        prepared,
                    )

                    indexed_count += len(prepared)

                    log_stage(
                        f"BATCH {batch_number} INSERT COMPLETE "
                        f"total_indexed={indexed_count}"
                    )

                    del prepared, embeddings, batch

        log_stage(
            f"INDEX SUCCESS syllabus={req.syllabusId} "
            f"chunks={indexed_count} "
            f"seconds={time.monotonic() - started:.3f}"
        )

        return {
            "message": "Syllabus indexed successfully.",
            "syllabusId": req.syllabusId,
            "subjectId": req.subjectId,
            "chunksIndexed": indexed_count,
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "[RAG] INDEX FAILED syllabus=%s elapsed=%.2fs",
            req.syllabusId,
            time.monotonic() - started,
        )
        raise HTTPException(
            status_code=500,
            detail="Failed to index syllabus.",
        )


def retrieve(
    question: str,
    subject_id: str,
    k: int = 4,
) -> List[dict]:
    """Retrieve the closest indexed chunks for a subject."""
    if not subject_id:
        raise ValueError("subjectId is required")

    log_stage("RETRIEVAL START")
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

    log_stage(f"RETRIEVAL COMPLETE results={len(rows)}")

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
    except Exception:
        logger.exception("[RAG] RETRIEVAL FAILED")
        raise HTTPException(
            status_code=503,
            detail="RAG retrieval is unavailable.",
        )

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
    except Exception:
        logger.exception("[RAG] LLM ANSWER FAILED")
        raise HTTPException(
            status_code=502,
            detail="Failed to generate the answer.",
        )

    return RagResponse(text=answer, sources=retrieved)
