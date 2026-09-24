from fastapi import APIRouter, HTTPException
from app.neo4j_client import run_query

router = APIRouter(prefix="/graph", tags=["graph"])


@router.get("/prerequisites/{concept_id}")
def get_prerequisites(concept_id: str):
    """Direct + transitive prerequisites of a concept, deepest-first.
    Used by Single Topic Mode to build the mini learning path."""
    rows = run_query(
        """
        MATCH (target:Concept {id: $conceptId})-[:REQUIRES*1..5]->(prereq:Concept)
        RETURN DISTINCT prereq.id AS id, prereq.label AS label,
               coalesce(prereq.difficulty, 3) AS difficulty
        ORDER BY difficulty DESC
        """,
        conceptId=concept_id,
    )
    target = run_query(
        "MATCH (c:Concept {id: $conceptId}) RETURN c.id AS id, c.label AS label",
        conceptId=concept_id,
    )
    if not target:
        raise HTTPException(status_code=404, detail=f"Concept {concept_id} not found")
    return {"target": target[0], "prerequisites": rows}


@router.get("/subject/{subject_id}")
def get_subject_graph(subject_id: str):
    """Full concept graph for a subject: nodes + edges, shaped for direct use
    with a graph visualization library (React Flow / Cytoscape.js) on the frontend."""
    concept_rows = run_query(
        """
        MATCH (s:Subject {id: $subjectId})-[:HAS_UNIT]->(u:Unit)-[:HAS_TOPIC]->(t:Topic)-[:HAS_CONCEPT]->(c:Concept)
        RETURN u.title AS unit, t.title AS topic, c.id AS id, c.label AS label
        ORDER BY u.order, t.order
        """,
        subjectId=subject_id,
    )
    edge_rows = run_query(
        """
        MATCH (s:Subject {id: $subjectId})-[:HAS_UNIT]->(:Unit)-[:HAS_TOPIC]->(:Topic)-[:HAS_CONCEPT]->(a:Concept)
        MATCH (a)-[:REQUIRES]->(b:Concept)
        RETURN a.id AS source, b.id AS target
        """,
        subjectId=subject_id,
    )
    return {
        "nodes": [{"id": r["id"], "label": r["label"], "unit": r["unit"], "topic": r["topic"]} for r in concept_rows],
        "edges": [{"source": r["source"], "target": r["target"], "type": "REQUIRES"} for r in edge_rows],
    }
