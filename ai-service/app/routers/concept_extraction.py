"""
Step 1-3: Syllabus text -> structured concepts -> Knowledge Graph (Neo4j).

PLAN for the real implementation (Member 3 / AI-NLP):
  1. Text cleanup: strip headers/footers/page numbers, normalize whitespace.
  2. Unit/Topic segmentation: syllabi are usually already semi-structured
     ("UNIT 1: ...", "1.1 ..."). Use regex/heuristics first; fall back to an
     LLM prompt ("split this syllabus into units and topics as JSON") for
     messy documents.
  3. Concept extraction per topic: noun-phrase extraction (spaCy) filtered by
     a domain stopword list, OR an LLM prompt that returns a concept list per
     topic. LLM is more robust for a capstone timeline; cite this as a design
     choice (Section 13 "LLM assistance where appropriate").
  4. Concept de-duplication / normalization: embed each candidate concept
     (sentence-transformers or an embedding API), cluster near-duplicates by
     cosine similarity (e.g. "Normalisation" vs "Normalization"), keep one
     canonical label + id per cluster.
  5. Prerequisite inference: for concepts within the same subject, ask the
     LLM "does understanding X require Y first?" pairwise for topic-adjacent
     concepts only (don't do O(n^2) over the whole subject — restrict to
     concepts in the same or an earlier unit to keep this tractable). Cross-
     check a sample manually before trusting it for the demo.
  6. Write nodes/edges to Neo4j (see write_concepts_to_graph below).

This file currently returns/writes a MOCK structure so the rest of the
pipeline (backend, frontend) can be built and tested against a stable
contract before step 3-5 above are implemented for real.
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

from app.neo4j_client import run_query
from app.llm_client import llm

router = APIRouter(prefix="/concepts", tags=["concepts"])


class ExtractRequest(BaseModel):
    syllabusId: str
    subjectId: str
    rawText: str


class ConceptOut(BaseModel):
    id: str
    label: str


class TopicOut(BaseModel):
    title: str
    order: int
    concepts: List[ConceptOut]


class UnitOut(BaseModel):
    title: str
    order: int
    topics: List[TopicOut]


class ExtractResponse(BaseModel):
    units: List[UnitOut]


@router.post("/extract", response_model=ExtractResponse)
def extract_concepts(req: ExtractRequest):
    # TODO: replace with the real pipeline described in the module docstring.
    # For now: a fixed DBMS example so Full Syllabus Mode is demoable end-to-end
    # regardless of what was actually in the uploaded file.
    mock_units = [
        UnitOut(
            title="Relational Model & Keys",
            order=0,
            topics=[
                TopicOut(
                    title="Keys & Dependencies",
                    order=0,
                    concepts=[
                        ConceptOut(id="dbms.relational_model", label="Relational Model"),
                        ConceptOut(id="dbms.functional_dependencies", label="Functional Dependencies"),
                        ConceptOut(id="dbms.candidate_keys", label="Candidate Keys"),
                        ConceptOut(id="dbms.normalization", label="Normalization"),
                    ],
                )
            ],
        )
    ]

    write_concepts_to_graph(req.subjectId, mock_units)
    return ExtractResponse(units=mock_units)


def write_concepts_to_graph(subject_id: str, units: List[UnitOut]):
    """Idempotent MERGE-based write. Prerequisite edges are NOT created here —
    that's a separate step (see infer_prerequisites, TODO) since it needs
    cross-topic reasoning, not just a per-topic concept list."""
    run_query(
        "MERGE (s:Subject {id: $subjectId})",
        subjectId=subject_id,
    )
    for u_idx, unit in enumerate(units):
        unit_id = f"{subject_id}.u{u_idx}"
        run_query(
            """
            MERGE (u:Unit {id: $unitId})
            SET u.title = $title, u.order = $order
            WITH u
            MATCH (s:Subject {id: $subjectId})
            MERGE (s)-[:HAS_UNIT]->(u)
            """,
            unitId=unit_id,
            title=unit.title,
            order=unit.order,
            subjectId=subject_id,
        )
        for t_idx, topic in enumerate(unit.topics):
            topic_id = f"{unit_id}.t{t_idx}"
            run_query(
                """
                MERGE (t:Topic {id: $topicId})
                SET t.title = $title, t.order = $order
                WITH t
                MATCH (u:Unit {id: $unitId})
                MERGE (u)-[:HAS_TOPIC]->(t)
                """,
                topicId=topic_id,
                title=topic.title,
                order=topic.order,
                unitId=unit_id,
            )
            for concept in topic.concepts:
                run_query(
                    """
                    MERGE (c:Concept {id: $conceptId})
                    SET c.label = $label
                    WITH c
                    MATCH (t:Topic {id: $topicId})
                    MERGE (t)-[:HAS_CONCEPT]->(c)
                    """,
                    conceptId=concept.id,
                    label=concept.label,
                    topicId=topic_id,
                )


# TODO: implement and expose as a follow-up endpoint, e.g. POST /concepts/infer-prerequisites
def infer_prerequisites(concept_ids: List[str]) -> List[dict]:
    """
    PLAN: for each pair of concepts in the same subject (restricted to topic-adjacent
    pairs to keep this tractable), prompt the LLM:

        system = "You are a curriculum expert. Answer with only 'yes' or 'no'."
        user = f"To understand '{concept_b}', must a student first understand
                 '{concept_a}'? Answer yes only if {concept_a} is a genuine
                 prerequisite, not just related."

    Log borderline/uncertain answers for manual review before writing REQUIRES
    edges — this is exactly the kind of thing worth calling out as a limitation
    in the capstone report (Section 27, "Risks and limitations").
    """
    raise NotImplementedError
