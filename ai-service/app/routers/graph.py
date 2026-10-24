
import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from app.neo4j_client import run_query

router = APIRouter(prefix="/graph", tags=["graph"])
logger = logging.getLogger(__name__)

MAX_CONCEPTS = 150


def contains_cycle(edges: set[tuple[str, str]]) -> bool:
    """Check whether directed prerequisite edges contain a cycle."""
    adjacency: dict[str, list[str]] = {}

    for source, target in edges:
        adjacency.setdefault(source, []).append(target)

    state: dict[str, int] = {}

    def visit(node: str) -> bool:
        if state.get(node) == 1:
            return True
        if state.get(node) == 2:
            return False

        state[node] = 1

        for neighbor in adjacency.get(node, []):
            if visit(neighbor):
                return True

        state[node] = 2
        return False

    nodes = set(adjacency)
    for neighbors in adjacency.values():
        nodes.update(neighbors)

    return any(
        state.get(node, 0) == 0 and visit(node)
        for node in nodes
    )


def get_subject_concepts(subject_id: str) -> list[dict[str, Any]]:
    rows = run_query(
        """
        MATCH (s:Subject {id: $subjectId})
              -[:HAS_UNIT]->(u:Unit)
              -[:HAS_TOPIC]->(t:Topic)
              -[:HAS_CONCEPT]->(c:Concept)
        RETURN DISTINCT
            c.id AS id,
            c.label AS label,
            u.title AS unit,
            t.title AS topic,
            coalesce(u.order, 999999) AS unitOrder,
            coalesce(t.order, 999999) AS topicOrder
        ORDER BY unitOrder, topicOrder, c.label
        """,
        subjectId=subject_id,
    )

    concepts = [
        {
            "id": str(row["id"]),
            "label": str(row.get("label") or row["id"]),
            "unit": str(row.get("unit") or ""),
            "topic": str(row.get("topic") or ""),
            "unitOrder": row.get("unitOrder", 999999),
            "topicOrder": row.get("topicOrder", 999999),
        }
        for row in rows
        if row.get("id") is not None
    ]

    logger.info(
        "Loaded subject concepts: subject=%s count=%d",
        subject_id,
        len(concepts),
    )
    return concepts


def get_existing_edges(subject_id: str) -> set[tuple[str, str]]:
    rows = run_query(
        """
        MATCH (s:Subject {id: $subjectId})
              -[:HAS_UNIT]->(:Unit)
              -[:HAS_TOPIC]->(:Topic)
              -[:HAS_CONCEPT]->(c:Concept)
        MATCH (c)-[:REQUIRES]->(p:Concept)
        RETURN DISTINCT c.id AS source, p.id AS target
        """,
        subjectId=subject_id,
    )

    return {
        (str(row["source"]), str(row["target"]))
        for row in rows
        if row.get("source") is not None
        and row.get("target") is not None
    }


# =========================================================
# GET TRANSITIVE PREREQUISITES
# =========================================================

@router.get("/prerequisites/{concept_id}")
def get_prerequisites(concept_id: str):
    target = run_query(
        """
        MATCH (c:Concept {id: $conceptId})
        RETURN c.id AS id, c.label AS label
        """,
        conceptId=concept_id,
    )

    if not target:
        raise HTTPException(
            status_code=404,
            detail="Concept not found",
        )

    prerequisites = run_query(
        """
        MATCH (c:Concept {id: $conceptId})
              -[:REQUIRES*1..5]->(p:Concept)
        RETURN DISTINCT
            p.id AS id,
            p.label AS label,
            coalesce(p.difficulty, 3) AS difficulty
        ORDER BY difficulty DESC, label
        """,
        conceptId=concept_id,
    )

    return {
        "target": target[0],
        "prerequisites": prerequisites,
        "count": len(prerequisites),
    }


# =========================================================
# GET SUBJECT GRAPH
# =========================================================

@router.get("/subject/{subject_id}")
def get_subject_graph(subject_id: str):
    subjects = run_query(
        """
        MATCH (s:Subject {id: $subjectId})
        RETURN s.id AS id, s.name AS name
        """,
        subjectId=subject_id,
    )

    if not subjects:
        raise HTTPException(
            status_code=404,
            detail="Subject not found",
        )

    rows = run_query(
        """
        MATCH (s:Subject {id: $subjectId})
              -[:HAS_UNIT]->(u:Unit)
        OPTIONAL MATCH (u)-[:HAS_TOPIC]->(t:Topic)
        OPTIONAL MATCH (t)-[:HAS_CONCEPT]->(c:Concept)
        RETURN
            s.id AS sid,
            s.name AS sname,
            u.id AS uid,
            u.title AS utitle,
            t.id AS tid,
            t.title AS ttitle,
            c.id AS cid,
            c.label AS clabel,
            c.difficulty AS difficulty
        ORDER BY u.title, t.title, c.label
        """,
        subjectId=subject_id,
    )

    nodes: dict[str, dict[str, Any]] = {}
    edges: dict[tuple[str, str, str], dict[str, str]] = {}

    subject_node_id = str(subjects[0]["id"])

    nodes[subject_node_id] = {
        "id": subject_node_id,
        "label": subjects[0].get("name") or "Subject",
        "type": "Subject",
    }

    for row in rows:
        unit_id = (
            str(row["uid"])
            if row.get("uid") is not None
            else None
        )
        topic_id = (
            str(row["tid"])
            if row.get("tid") is not None
            else None
        )
        concept_id = (
            str(row["cid"])
            if row.get("cid") is not None
            else None
        )

        if unit_id:
            nodes[unit_id] = {
                "id": unit_id,
                "label": row.get("utitle") or unit_id,
                "type": "Unit",
            }

            edges[(subject_node_id, unit_id, "HAS_UNIT")] = {
                "source": subject_node_id,
                "target": unit_id,
                "type": "HAS_UNIT",
            }

        if topic_id:
            nodes[topic_id] = {
                "id": topic_id,
                "label": row.get("ttitle") or topic_id,
                "type": "Topic",
            }

            if unit_id:
                edges[(unit_id, topic_id, "HAS_TOPIC")] = {
                    "source": unit_id,
                    "target": topic_id,
                    "type": "HAS_TOPIC",
                }

        if concept_id:
            difficulty = row.get("difficulty")

            nodes[concept_id] = {
                "id": concept_id,
                "label": row.get("clabel") or concept_id,
                "type": "Concept",
                "difficulty": (
                    difficulty if difficulty is not None else 3
                ),
            }

            if topic_id:
                edges[(topic_id, concept_id, "HAS_CONCEPT")] = {
                    "source": topic_id,
                    "target": concept_id,
                    "type": "HAS_CONCEPT",
                }

    prerequisite_rows = run_query(
        """
        MATCH (s:Subject {id: $subjectId})
              -[:HAS_UNIT]->(:Unit)
              -[:HAS_TOPIC]->(:Topic)
              -[:HAS_CONCEPT]->(c:Concept)
        MATCH (c)-[:REQUIRES]->(p:Concept)
        RETURN DISTINCT
            c.id AS source,
            p.id AS target,
            p.label AS label,
            p.difficulty AS difficulty
        """,
        subjectId=subject_id,
    )

    for row in prerequisite_rows:
        source = str(row["source"])
        target = str(row["target"])

        if target not in nodes:
            difficulty = row.get("difficulty")

            nodes[target] = {
                "id": target,
                "label": row.get("label") or target,
                "type": "Concept",
                "difficulty": (
                    difficulty if difficulty is not None else 3
                ),
            }

        edges[(source, target, "REQUIRES")] = {
            "source": source,
            "target": target,
            "type": "REQUIRES",
        }

    node_list = list(nodes.values())
    edge_list = list(edges.values())

    return {
        "subjectId": subject_id,
        "nodes": node_list,
        "edges": edge_list,
        "summary": {
            "subjects": sum(
                node["type"] == "Subject" for node in node_list
            ),
            "units": sum(
                node["type"] == "Unit" for node in node_list
            ),
            "topics": sum(
                node["type"] == "Topic" for node in node_list
            ),
            "concepts": sum(
                node["type"] == "Concept" for node in node_list
            ),
            "hierarchyEdges": sum(
                edge["type"] in {
                    "HAS_UNIT",
                    "HAS_TOPIC",
                    "HAS_CONCEPT",
                }
                for edge in edge_list
            ),
            "prerequisiteEdges": sum(
                edge["type"] == "REQUIRES"
                for edge in edge_list
            ),
        },
    }


# =========================================================
# FAST PREREQUISITE STATUS
# =========================================================

@router.post("/subject/{subject_id}/infer-prerequisites")
def infer_subject_prerequisites(subject_id: str):
    """
    Fast mode: inspect existing prerequisite relationships without
    making per-concept LLM calls or inventing prerequisite edges.

    New prerequisite relationships must come from trusted metadata,
    curated rules, or a separately validated inference process.
    """

    subject = run_query(
        """
        MATCH (s:Subject {id: $subjectId})
        RETURN s.id AS id
        """,
        subjectId=subject_id,
    )

    if not subject:
        raise HTTPException(
            status_code=404,
            detail="Subject not found",
        )

    concepts = get_subject_concepts(subject_id)

    if len(concepts) > MAX_CONCEPTS:
        raise HTTPException(
            status_code=413,
            detail=f"Maximum supported concepts: {MAX_CONCEPTS}",
        )

    existing = get_existing_edges(subject_id)

    concept_ids = {concept["id"] for concept in concepts}
    subject_edges = {
        edge for edge in existing
        if edge[0] in concept_ids
    }

    # Existing edges are checked for cycles, but are not modified.
    has_cycle = contains_cycle(subject_edges)

    logger.info(
        "Prerequisite status checked: subject=%s concepts=%d "
        "existing_edges=%d has_cycle=%s",
        subject_id,
        len(concepts),
        len(subject_edges),
        has_cycle,
    )

    return {
        "subjectId": subject_id,
        "conceptCount": len(concepts),
        "candidateRelationships": 0,
        "createdRelationships": 0,
        "existingRelationships": len(subject_edges),
        "rejectedCycles": 0,
        "failedTargets": [],
        "complete": not has_cycle,
        "inferenceEnabled": False,
        "message": (
            "No new edges inferred. Existing prerequisite relationships "
            "were checked without LLM calls. Add trusted prerequisite "
            "metadata or enable a separately validated inference process "
            "to create new relationships."
        ),
    }
