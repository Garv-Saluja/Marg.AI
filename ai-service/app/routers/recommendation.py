
import hashlib
import json
import logging
import re
from heapq import heappop, heappush
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.llm_client import llm
from app.neo4j_client import run_query

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recommend", tags=["recommend"])

MASTERY_THRESHOLD = 75
REVISION_BAND = (65, 75)
MAX_PREREQUISITE_DEPTH = 5
MAX_GENERATED_CONCEPTS = 30


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
    targetConceptId: str | None = None


# ---------------------------------------------------------------------
# Topic resolution and AI-generated prerequisite graph
# ---------------------------------------------------------------------

def _slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.casefold()).strip("_") or "concept"


def _generated_id(label: str) -> str:
    """Stable ID with a hash to reduce slug collisions."""
    slug = _slugify(label)[:60]
    digest = hashlib.sha256(label.casefold().encode("utf-8")).hexdigest()[:10]
    return f"generated.{slug}_{digest}"


def _resolve_existing_concept(topic: str) -> dict | None:
    """Match an existing concept by ID or label."""
    rows = run_query(
        """
        MATCH (c:Concept)
        WHERE toLower(c.id) = toLower($topic)
           OR toLower(c.label) = toLower($topic)
        RETURN c.id AS id, c.label AS label
        ORDER BY CASE
            WHEN toLower(c.id) = toLower($topic) THEN 0
            ELSE 1
        END
        LIMIT 1
        """,
        topic=topic.strip(),
    )
    return rows[0] if rows else None


def _generate_prerequisite_data(topic: str) -> list[dict]:
    """Ask the configured LLM for a structured prerequisite graph."""
    system_prompt = """
You are an expert academic tutor and knowledge graph designer.

Return only a JSON object with this shape:
{
  "concepts": [
    {
      "label": "Concept name",
      "prerequisites": ["Name of prerequisite"]
    }
  ]
}

Rules:
- Include the exact requested topic as a concept label.
- Include only genuine, useful prerequisites.
- A prerequisite label must refer to another concept in this response.
- Concepts may depend on concepts listed later; the server orders them.
- Do not invent prerequisites merely to lengthen the path.
- Avoid duplicates, self-dependencies, and cycles.
- Keep the graph focused, with no more than 30 concepts.
- If no prerequisite is needed, return just the target concept.
- Return JSON only, without Markdown or explanations.
"""

    try:
        content = llm.complete(
            system=system_prompt,
            user=(
                "Create a prerequisite graph for the following topic. "
                "The target concept label must match the requested topic exactly.\n\n"
                f"Topic: {topic}"
            ),
            max_tokens=2500,
            response_format="json_object",
        )
        result = json.loads(content)
    except Exception as exc:
        logger.exception("Prerequisite generation failed")
        raise HTTPException(
            status_code=502,
            detail="AI could not generate prerequisites for this topic.",
        ) from exc

    concepts = result.get("concepts") if isinstance(result, dict) else None

    if (
        not isinstance(concepts, list)
        or not concepts
        or len(concepts) > MAX_GENERATED_CONCEPTS
    ):
        raise HTTPException(
            status_code=502,
            detail="AI returned an invalid prerequisite graph.",
        )

    normalized = {}
    for item in concepts:
        if not isinstance(item, dict):
            raise HTTPException(
                status_code=502,
                detail="AI returned invalid concept data.",
            )

        label = item.get("label")
        prerequisites = item.get("prerequisites", [])

        if (
            not isinstance(label, str)
            or not label.strip()
            or not isinstance(prerequisites, list)
            or not all(
                isinstance(p, str) and p.strip()
                for p in prerequisites
            )
        ):
            raise HTTPException(
                status_code=502,
                detail="AI returned malformed concept data.",
            )

        label = label.strip()
        key = label.casefold()

        if key in normalized:
            raise HTTPException(
                status_code=502,
                detail="AI returned duplicate concept labels.",
            )

        normalized[key] = {
            "label": label,
            "prerequisites": [p.strip() for p in prerequisites],
        }

    target_key = topic.casefold()

    if target_key not in normalized:
        raise HTTPException(
            status_code=502,
            detail="AI did not include the requested topic in its response.",
        )

    # Every prerequisite must be represented in the returned graph.
    for item in normalized.values():
        for prerequisite in item["prerequisites"]:
            if prerequisite.casefold() not in normalized:
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "AI returned a prerequisite without defining it: "
                        f"{prerequisite}"
                    ),
                )

    return list(normalized.values())


def _generate_topic_graph(topic: str) -> str:
    """
    Generate missing concepts, reuse concepts already in Neo4j,
    validate dependencies, and persist the nodes and relationships.
    """
    generated = _generate_prerequisite_data(topic)

    # Resolve every generated label to an existing concept when possible.
    concepts_by_label = {}
    for item in generated:
        existing = _resolve_existing_concept(item["label"])

        concepts_by_label[item["label"].casefold()] = {
            "id": existing["id"] if existing else _generated_id(item["label"]),
            "label": existing["label"] if existing else item["label"],
            "prerequisites": item["prerequisites"],
            "is_new": existing is None,
        }

    edges = []
    for item in concepts_by_label.values():
        for prerequisite_label in item["prerequisites"]:
            prerequisite = concepts_by_label[prerequisite_label.casefold()]

            if prerequisite["id"] == item["id"]:
                raise HTTPException(
                    status_code=502,
                    detail="AI generated a self-dependent concept.",
                )

            edges.append((item["id"], prerequisite["id"]))

    # Topological sorting validates the graph before any graph writes.
    rows = [
        {
            "id": item["id"],
            "label": item["label"],
            "dependsOn": [
                prerequisite_id
                for dependent_id, prerequisite_id in edges
                if dependent_id == item["id"]
            ],
        }
        for item in concepts_by_label.values()
    ]

    _topological_sort(rows, raise_on_cycle=True)

    # Create missing nodes. MERGE makes retries idempotent for stable IDs.
    for item in concepts_by_label.values():
        if item["is_new"]:
            run_query(
                """
                MERGE (c:Concept {id: $id})
                ON CREATE SET c.label = $label
                """,
                id=item["id"],
                label=item["label"],
            )

    # Relationship direction matches the existing application:
    # (target)-[:REQUIRES]->(prerequisite)
    for target_id, prerequisite_id in edges:
        run_query(
            """
            MATCH (target:Concept {id: $targetId})
            MATCH (prerequisite:Concept {id: $prerequisiteId})
            MERGE (target)-[:REQUIRES]->(prerequisite)
            """,
            targetId=target_id,
            prerequisiteId=prerequisite_id,
        )

    return concepts_by_label[topic.casefold()]["id"]


# ---------------------------------------------------------------------
# Single-topic path
# ---------------------------------------------------------------------

def _single_topic_path(
    target_concept_id: str,
    mastery_map: dict[str, float],
) -> list[StepOut]:
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
            detail="Target concept not found after resolution.",
        )

    rows = run_query(
        """
        MATCH (target:Concept {id: $conceptId})
        OPTIONAL MATCH (target)-[:REQUIRES*1..5]->(prereq:Concept)
        WITH collect(DISTINCT target) +
             collect(DISTINCT prereq) AS concepts
        UNWIND concepts AS n
        WITH DISTINCT n
        OPTIONAL MATCH (n)-[:REQUIRES]->(dep:Concept)
        RETURN n.id AS id,
               n.label AS label,
               collect(DISTINCT dep.id) AS dependsOn
        """,
        conceptId=target_concept_id,
    )

    ordered = _topological_sort(rows, raise_on_cycle=True)
    steps = []

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


# ---------------------------------------------------------------------
# Full-syllabus path (existing behavior preserved)
# ---------------------------------------------------------------------

def _load_dependency_rows(concept_ids: list[str]) -> list[dict]:
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


def _full_syllabus_path(
    subject_id: str,
    mastery_map: dict[str, float],
) -> list[StepOut]:
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

    syllabus_order = {}
    for row in syllabus_rows:
        concept_id = row.get("id")
        if not concept_id:
            continue

        syllabus_order[str(concept_id)] = (
            int(row.get("unitOrder", 999999)),
            int(row.get("topicOrder", 999999)),
            str(row.get("label") or concept_id).casefold(),
        )

    syllabus_ids = set(syllabus_order)

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
    ordered = _topological_sort(
        rows,
        raise_on_cycle=True,
        preferred_order=syllabus_order,
    )

    steps = []
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


# ---------------------------------------------------------------------
# Topological ordering
# ---------------------------------------------------------------------

def _topological_sort(
    rows: list[dict],
    *,
    raise_on_cycle: bool = False,
    preferred_order: dict[str, tuple[int, int, str]] | None = None,
) -> list[dict]:
    """Return prerequisites before concepts that depend on them."""
    preferred_order = preferred_order or {}
    by_id = {}

    for row in rows:
        concept_id = row.get("id")
        if not concept_id:
            continue

        by_id[str(concept_id)] = {
            "id": str(concept_id),
            "label": str(row.get("label") or concept_id),
            "dependsOn": list(row.get("dependsOn") or []),
        }

    in_degree = {}
    dependents = {concept_id: [] for concept_id in by_id}

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

    queue = []
    for concept_id, degree in in_degree.items():
        if degree == 0:
            heappush(queue, (priority(concept_id), concept_id))

    ordered = []
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

        for concept_id in unresolved:
            ordered.append(by_id[concept_id])

    return ordered


# ---------------------------------------------------------------------
# API endpoint
# ---------------------------------------------------------------------

@router.post("/path", response_model=RecommendResponse)
def recommend_path(req: RecommendRequest):
    mastery_map = {
        mastery.concept_id: mastery.mastery_score
        for mastery in req.currentMastery
    }

    target_concept_id = None

    if req.scope == "single_topic":
        topic = (req.targetConceptId or "").strip()

        if not topic:
            raise HTTPException(
                status_code=422,
                detail="A topic name or target concept ID is required.",
            )

        existing = _resolve_existing_concept(topic)

        if existing:
            target_concept_id = existing["id"]
        else:
            target_concept_id = _generate_topic_graph(topic)

        steps = _single_topic_path(
            target_concept_id,
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

    return RecommendResponse(
        steps=steps,
        targetConceptId=target_concept_id,
    )
