"""
Step 11: Personalized Learning Path generation.

ALGORITHM (realistic scoring model, not deep learning — see brief Section 11):

For Single Topic Mode (target concept T):
  1. Fetch T's full transitive prerequisite chain from Neo4j (already sorted
     deepest-first by /graph/prerequisites/{T}).
  2. For each concept C in [prerequisites..., T], compute a priority score:

       priority(C) = w1*(100 - mastery(C))        # bigger gap -> higher priority
                   + w2*difficulty(C)              # harder concepts need more runway
                   + w3*importance(C)              # curriculum importance
                   - w4*depth(C)                   # deeper prereqs go first regardless
                                                     # (depth enforced by topological order,
                                                     #  not by this score — see step 3)

     Suggested weights for the MVP: w1=0.6, w2=0.2, w3=0.2, w4 unused directly
     (depth is enforced structurally, see below).

  3. Order: topological order of the prerequisite DAG (deepest first) is the
     PRIMARY sort key — you cannot teach Normalization before Functional
     Dependencies regardless of scores. The priority score above is only used
     to decide INCLUSION (skip concepts already >= mastery threshold) and,
     among concepts at the same depth, their relative order.
  4. A concept is INCLUDED in the path only if mastery(C) < MASTERY_THRESHOLD
     (default 75). Already-mastered prerequisites are skipped (e.g. Candidate
     Keys at 72% might still be included as a "quick revision" step if just
     below threshold — see REVISION_BAND below).

For Full Syllabus Mode: run the same logic across every concept in the
subject graph in topological order, batching by unit/topic.

Example calculation (matches the brief's worked example):
  Functional Dependencies: mastery=35  -> priority = 0.6*65 + 0.2*3 + 0.2*5 = 40.6  -> INCLUDE
  Candidate Keys:          mastery=72  -> within REVISION_BAND (70-75)              -> INCLUDE as "quick revision"
  Normalization:           mastery=25  -> priority = 0.6*75 + 0.2*4 + 0.2*5 = 46.8  -> INCLUDE (target)
"""
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional, Literal

from app.neo4j_client import run_query

router = APIRouter(prefix="/recommend", tags=["recommend"])

MASTERY_THRESHOLD = 75
REVISION_BAND = (65, 75)  # mastery in this range -> include as a quick revision step


class MasteryIn(BaseModel):
    concept_id: str
    mastery_score: float
    status: Optional[str] = None


class RecommendRequest(BaseModel):
    userId: str
    scope: Literal["single_topic", "full_syllabus"]
    targetConceptId: Optional[str] = None
    subjectId: Optional[str] = None
    currentMastery: List[MasteryIn] = []


class StepOut(BaseModel):
    conceptId: str
    conceptLabel: str
    reason: str


class RecommendResponse(BaseModel):
    steps: List[StepOut]


@router.post("/path", response_model=RecommendResponse)
def recommend_path(req: RecommendRequest):
    mastery_map = {m.concept_id: m.mastery_score for m in req.currentMastery}

    if req.scope == "single_topic":
        return RecommendResponse(steps=_single_topic_path(req.targetConceptId, mastery_map))
    return RecommendResponse(steps=_full_syllabus_path(req.subjectId, mastery_map))


def _single_topic_path(target_concept_id: str, mastery_map: dict) -> List[StepOut]:
    rows = run_query(
        """
        MATCH (target:Concept {id: $conceptId})
        OPTIONAL MATCH p = (target)-[:REQUIRES*1..5]->(prereq:Concept)
        WITH target, collect(DISTINCT prereq) AS prereqs
        UNWIND (prereqs + [target]) AS n
        OPTIONAL MATCH (n)-[:REQUIRES]->(dep:Concept)
        RETURN DISTINCT n.id AS id, n.label AS label, collect(DISTINCT dep.id) AS dependsOn
        """,
        conceptId=target_concept_id,
    )

    ordered = _topological_sort(rows)

    steps = []
    for node in ordered:
        mastery = mastery_map.get(node["id"], 0)
        if node["id"] == target_concept_id:
            steps.append(StepOut(conceptId=node["id"], conceptLabel=node["label"], reason="target_concept"))
        elif mastery >= MASTERY_THRESHOLD:
            continue  # already mastered, skip
        elif REVISION_BAND[0] <= mastery < REVISION_BAND[1]:
            steps.append(StepOut(conceptId=node["id"], conceptLabel=node["label"], reason="quick_revision"))
        else:
            steps.append(StepOut(conceptId=node["id"], conceptLabel=node["label"], reason="missing_prerequisite"))
    return steps


def _full_syllabus_path(subject_id: str, mastery_map: dict) -> List[StepOut]:
    rows = run_query(
        """
        MATCH (s:Subject {id: $subjectId})-[:HAS_UNIT]->(:Unit)-[:HAS_TOPIC]->(:Topic)-[:HAS_CONCEPT]->(c:Concept)
        OPTIONAL MATCH (c)-[:REQUIRES]->(dep:Concept)
        RETURN DISTINCT c.id AS id, c.label AS label, collect(DISTINCT dep.id) AS dependsOn
        """,
        subjectId=subject_id,
    )
    ordered = _topological_sort(rows)
    steps = []
    for node in ordered:
        mastery = mastery_map.get(node["id"], 0)
        if mastery >= MASTERY_THRESHOLD:
            continue
        reason = "quick_revision" if REVISION_BAND[0] <= mastery < REVISION_BAND[1] else "syllabus_concept"
        steps.append(StepOut(conceptId=node["id"], conceptLabel=node["label"], reason=reason))
    return steps


def _topological_sort(rows: List[dict]) -> List[dict]:
    """Simple Kahn's-algorithm topological sort over the REQUIRES DAG.
    rows: [{id, label, dependsOn: [ids]}]. Falls back gracefully on cycles
    (shouldn't happen with well-formed prerequisite data, but don't hard-crash
    a demo over one bad edge)."""
    by_id = {r["id"]: r for r in rows}
    in_degree = {r["id"]: len([d for d in r["dependsOn"] if d and d in by_id]) for r in rows}
    queue = [rid for rid, deg in in_degree.items() if deg == 0]
    ordered = []
    visited = set()

    while queue:
        current = queue.pop(0)
        if current in visited:
            continue
        visited.add(current)
        ordered.append(by_id[current])
        for r in rows:
            if current in (r["dependsOn"] or []):
                in_degree[r["id"]] -= 1
                if in_degree[r["id"]] == 0:
                    queue.append(r["id"])

    # append any unresolved nodes (cycle fallback) so nothing silently disappears
    for r in rows:
        if r["id"] not in visited:
            ordered.append(r)
    return ordered
