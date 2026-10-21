
from heapq import heappop, heappush
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.neo4j_client import run_query

router = APIRouter(prefix="/recommend", tags=["recommend"])

MASTERY_THRESHOLD = 75
REVISION_BAND = (65, 75)
MAX_PREREQUISITE_DEPTH = 5


class MasteryIn(BaseModel):
    concept_id: str
    mastery_score: float
    status: str | None = None


class RecommendRequest(BaseModel):
    userId: str
    scope: Literal["single_topic", "full_syllabus"]
    targetConceptId: str | None = None
    subjectId: str | None = None
    currentMastery: list[MasteryIn] = Field(default_factory=list)


class StepOut(BaseModel):
    conceptId: str
    conceptLabel: str
    reason: str


class RecommendResponse(BaseModel):
    steps: list[StepOut]


def _load_dependency_rows(concept_ids: list[str]) -> list[dict]:
    """Load concepts, direct dependencies, and optional syllabus ordering."""
    if not concept_ids:
        return []

    return run_query(
        """
        UNWIND $conceptIds AS conceptId
        MATCH (n:Concept {id: conceptId})
        OPTIONAL MATCH (n)-[:REQUIRES]->(dep:Concept)
        RETURN n.id AS id,
               n.label AS label,
               collect(DISTINCT dep.id) AS dependsOn
        """,
        conceptIds=concept_ids,
    )


def _single_topic_path(
    target_concept_id: str,
    mastery_map: dict[str, float],
) -> list[StepOut]:
    """Keep existing single-topic behavior."""
    target_rows = run_query(
        """
        MATCH (target:Concept {id: $conceptId})
        RETURN target.id AS id, target.label AS label
        """,
        conceptId=target_concept_id,
    )

    if not target_rows:
        raise HTTPException(
            status_code=404,
            detail="Target concept not found",
        )

    rows = run_query(
        """
        MATCH (target:Concept {id: $conceptId})
        OPTIONAL MATCH (target)-[:REQUIRES*1..5]->(prereq:Concept)
        WITH collect(DISTINCT target) + collect(DISTINCT prereq) AS concepts
        UNWIND concepts AS n
        WITH DISTINCT n
        OPTIONAL MATCH (n)-[:REQUIRES]->(dep:Concept)
        RETURN n.id AS id,
               n.label AS label,
               collect(DISTINCT dep.id) AS dependsOn
        """,
        conceptId=target_concept_id,
    )

    ordered = _topological_sort(rows, raise_on_cycle=False)
    steps: list[StepOut] = []

    for node in ordered:
        concept_id = node["id"]
        mastery = mastery_map.get(concept_id, 0)

        if concept_id == target_concept_id:
            reason = "target_concept"
        elif mastery >= MASTERY_THRESHOLD:
            continue
        elif REVISION_BAND[0] <= mastery < REVISION_BAND[1]:
            reason = "quick_revision"
        else:
            reason = "missing_prerequisite"

        steps.append(
            StepOut(
                conceptId=concept_id,
                conceptLabel=node["label"],
                reason=reason,
            )
        )

    return steps


def _full_syllabus_path(
    subject_id: str,
    mastery_map: dict[str, float],
) -> list[StepOut]:
    """Build a prerequisite-safe path with syllabus-order tie-breaking."""
    syllabus_rows = run_query(
        """
        MATCH (s:Subject {id: $subjectId})
              -[:HAS_UNIT]->(u:Unit)
              -[:HAS_TOPIC]->(t:Topic)
              -[:HAS_CONCEPT]->(c:Concept)
        RETURN DISTINCT
               c.id AS id,
               c.label AS label,
               coalesce(u.order, 999999) AS unitOrder,
               coalesce(t.order, 999999) AS topicOrder
        """,
        subjectId=subject_id,
    )

    if not syllabus_rows:
        subject_exists = run_query(
            """
            MATCH (s:Subject {id: $subjectId})
            RETURN s.id AS id
            """,
            subjectId=subject_id,
        )
        if not subject_exists:
            raise HTTPException(
                status_code=404,
                detail="Subject not found",
            )
        return []

    # Record stable curriculum positions for concepts in this subject.
    syllabus_order: dict[str, tuple[int, int, str]] = {}
    syllabus_labels: dict[str, str] = {}

    for row in syllabus_rows:
        concept_id = row.get("id")
        if not concept_id:
            continue

        syllabus_order[str(concept_id)] = (
            int(row.get("unitOrder", 999999)),
            int(row.get("topicOrder", 999999)),
            str(row.get("label") or concept_id).casefold(),
        )
        syllabus_labels[str(concept_id)] = str(
            row.get("label") or concept_id
        )

    syllabus_ids = set(syllabus_order)

    # Include prerequisites reachable from syllabus concepts.
    closure_rows = run_query(
        """
        MATCH (s:Subject {id: $subjectId})
              -[:HAS_UNIT]->(:Unit)
              -[:HAS_TOPIC]->(:Topic)
              -[:HAS_CONCEPT]->(c:Concept)
        OPTIONAL MATCH (c)-[:REQUIRES*1..5]->(p:Concept)
        RETURN collect(DISTINCT c.id) AS syllabusIds,
               collect(DISTINCT p.id) AS prerequisiteIds
        """,
        subjectId=subject_id,
    )

    if not closure_rows:
        return []

    all_ids = set(closure_rows[0].get("syllabusIds") or [])
    all_ids.update(closure_rows[0].get("prerequisiteIds") or [])
    all_ids.discard(None)

    rows = _load_dependency_rows(sorted(all_ids))

    # Apply syllabus order only as a tie-breaker among currently eligible nodes.
    ordered = _topological_sort(
        rows,
        raise_on_cycle=True,
        preferred_order=syllabus_order,
    )

    steps: list[StepOut] = []

    for node in ordered:
        concept_id = node["id"]
        mastery = mastery_map.get(concept_id, 0)

        if mastery >= MASTERY_THRESHOLD:
            continue

        if REVISION_BAND[0] <= mastery < REVISION_BAND[1]:
            reason = "quick_revision"
        elif concept_id in syllabus_ids:
            reason = "syllabus_concept"
        else:
            reason = "missing_prerequisite"

        steps.append(
            StepOut(
                conceptId=concept_id,
                conceptLabel=node["label"],
                reason=reason,
            )
        )

    return steps


def _topological_sort(
    rows: list[dict],
    *,
    raise_on_cycle: bool = False,
    preferred_order: dict[str, tuple[int, int, str]] | None = None,
) -> list[dict]:
    """
    Return prerequisites before dependent concepts.
    Preferred curriculum order breaks ties without violating dependencies.
    """
    preferred_order = preferred_order or {}
    by_id: dict[str, dict] = {}

    for row in rows:
        concept_id = row.get("id")
        if not concept_id:
            continue

        by_id[str(concept_id)] = {
            "id": str(concept_id),
            "label": str(row.get("label") or concept_id),
            "dependsOn": list(row.get("dependsOn") or []),
        }

    in_degree: dict[str, int] = {}
    dependents: dict[str, list[str]] = {
        concept_id: [] for concept_id in by_id
    }

    for concept_id, node in by_id.items():
        dependencies = {
            dep for dep in node["dependsOn"]
            if dep and dep in by_id
        }
        node["dependsOn"] = sorted(dependencies)
        in_degree[concept_id] = len(dependencies)

        for dependency in dependencies:
            dependents[dependency].append(concept_id)

    def priority(concept_id: str) -> tuple:
        node = by_id[concept_id]
        curriculum = preferred_order.get(
            concept_id,
            (999999, 999999, node["label"].casefold()),
        )
        return (*curriculum, node["label"].casefold(), concept_id)

    queue: list[tuple[tuple, str]] = []

    for concept_id, degree in in_degree.items():
        if degree == 0:
            heappush(queue, (priority(concept_id), concept_id))

    ordered: list[dict] = []

    while queue:
        _, concept_id = heappop(queue)
        ordered.append(by_id[concept_id])

        for dependent_id in dependents[concept_id]:
            in_degree[dependent_id] -= 1
            if in_degree[dependent_id] == 0:
                heappush(
                    queue,
                    (priority(dependent_id), dependent_id),
                )

    if len(ordered) != len(by_id):
        unresolved = sorted(
            concept_id
            for concept_id, degree in in_degree.items()
            if degree > 0
        )

        if raise_on_cycle:
            raise HTTPException(
                status_code=409,
                detail={
                    "message": (
                        "Prerequisite graph contains a cycle; "
                        "a valid learning path cannot be generated."
                    ),
                    "unresolvedConceptIds": unresolved,
                },
            )

        # Preserve existing single-topic fallback behavior.
        for concept_id in unresolved:
            ordered.append(by_id[concept_id])

    return ordered


@router.post("/path", response_model=RecommendResponse)
def recommend_path(req: RecommendRequest):
    mastery_map = {
        mastery.concept_id: mastery.mastery_score
        for mastery in req.currentMastery
    }

    if req.scope == "single_topic":
        if not req.targetConceptId:
            raise HTTPException(
                status_code=422,
                detail="targetConceptId is required for single_topic mode",
            )

        steps = _single_topic_path(
            req.targetConceptId,
            mastery_map,
        )
    else:
        if not req.subjectId:
            raise HTTPException(
                status_code=422,
                detail="subjectId is required for full_syllabus mode",
            )

        steps = _full_syllabus_path(
            req.subjectId,
            mastery_map,
        )

    return RecommendResponse(steps=steps)
