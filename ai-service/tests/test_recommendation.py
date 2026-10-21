
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.routers.recommendation import (
    _single_topic_path,
    _topological_sort,
)


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
        {"id": "concept_a", "label": "Concept A", "dependsOn": ["concept_b"]},
        {"id": "concept_b", "label": "Concept B", "dependsOn": ["concept_a"]},
    ]

    with pytest.raises(HTTPException) as exc_info:
        _topological_sort(rows, raise_on_cycle=True)

    assert exc_info.value.status_code == 409
    assert set(exc_info.value.detail["unresolvedConceptIds"]) == {
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


@patch("app.routers.recommendation.run_query")
def test_mastered_prerequisite_is_skipped(mock_query):
    mock_query.side_effect = [
        [{"id": "target", "label": "Target Concept"}],
        [
            {"id": "target", "label": "Target Concept"},
            {"id": "prerequisite", "label": "Prerequisite Concept"},
        ],
        [
            {
                "id": "target",
                "label": "Target Concept",
                "dependsOn": ["prerequisite"],
            },
            {
                "id": "prerequisite",
                "label": "Prerequisite Concept",
                "dependsOn": [],
            },
        ],
    ]

    steps = _single_topic_path(
        "target",
        {"prerequisite": 75},
    )

    ids = [step.conceptId for step in steps]

    assert "prerequisite" not in ids
    assert "target" in ids


@patch("app.routers.recommendation.run_query")
def test_revision_band_uses_quick_revision(mock_query):
    mock_query.side_effect = [
        [{"id": "target", "label": "Target Concept"}],
        [
            {"id": "target", "label": "Target Concept"},
            {"id": "revision", "label": "Revision Concept"},
        ],
        [
            {
                "id": "target",
                "label": "Target Concept",
                "dependsOn": ["revision"],
            },
            {
                "id": "revision",
                "label": "Revision Concept",
                "dependsOn": [],
            },
        ],
    ]

    steps = _single_topic_path("target", {"revision": 70})
    revision_step = next(step for step in steps if step.conceptId == "revision")

    assert revision_step.reason == "quick_revision"
