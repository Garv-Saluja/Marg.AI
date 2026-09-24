from fastapi import FastAPI

from app.routers import (
    concept_extraction,
    graph,
    knowledge_estimation,
    recommendation,
    teaching,
    rag,
    question_generation,
)

app = FastAPI(title="Marg.ai AI Service", version="0.1.0")


@app.get("/health")
def health():
    return {"status": "ok", "service": "ai-service"}


app.include_router(concept_extraction.router)
app.include_router(graph.router)
app.include_router(knowledge_estimation.router)
app.include_router(recommendation.router)
app.include_router(teaching.router)
app.include_router(rag.router)
app.include_router(question_generation.router)
