
from fastapi import HTTPException

from app.routers.recommendation import _topological_sort


def test_prerequisite_comes_before_dependent():
    rows = [
        {
            "id": "third_normal_form",
            "label": "Third Normal Form",
            "dependsOn": ["second_normal_form"],
        },
        {
            "id": "second_normal_form",
            "label": "Second Normal Form",
            "dependsOn": [],
        },
    ]

    result = _topological_sort(rows, raise_on_cycle=True)
    positions = {node["id"]: i for i, node in enumerate(result)}

    assert positions["second_normal_form"] < positions["third_normal_form"]


def test_cycle_raises_http_409():
    rows = [
        {
            "id": "concept_a",
            "label": "Concept A",
            "dependsOn": ["concept_b"],
        },
        {
            "id": "concept_b",
            "label": "Concept B",
            "dependsOn": ["concept_a"],
        },
    ]

    try:
        _topological_sort(rows, raise_on_cycle=True)
        assert False, "Expected HTTP 409 for a dependency cycle"
    except HTTPException as exc:
        assert exc.status_code == 409
        assert set(exc.detail["unresolvedConceptIds"]) == {
            "concept_a",
            "concept_b",
        }


def test_independent_concepts_are_all_returned():
    rows = [
        {"id": "concept_a", "label": "Concept A", "dependsOn": []},
        {"id": "concept_b", "label": "Concept B", "dependsOn": []},
    ]

    result = _topological_sort(rows, raise_on_cycle=True)

    assert {node["id"] for node in result} == {"concept_a", "concept_b"}
from app.routers.recommendation import _single_topic_path


def test_mastered_prerequisite_is_skipped():
    mastery = {
        "dbms.intro_to_dbms": 75,
    }

    steps = _single_topic_path(
        "dbms.third_normal_form",
        mastery,
    )

    concept_ids = {step.conceptId for step in steps}

    assert "dbms.intro_to_dbms" not in concept_ids


def test_revision_band_uses_quick_revision():
    mastery = {
        "dbms.normalization": 70,
    }

    steps = _single_topic_path(
        "dbms.third_normal_form",
        mastery,
    )

    normalization = next(
        step for step in steps
        if step.conceptId == "dbms.normalization"
    )

    assert normalization.reason == "quick_revision"