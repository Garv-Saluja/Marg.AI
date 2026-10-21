
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.routers.recommendation import _full_syllabus_path


SUBJECT_ID = "test-subject"


@patch("app.routers.recommendation.run_query")
def test_external_prerequisite_is_included(mock_query):
    # Query 1: concepts in the selected syllabus.
    # Query 2: syllabus concepts plus reachable prerequisites.
    # Query 3: direct dependency rows for all included concepts.
    mock_query.side_effect = [
        [
            {
                "id": "target",
                "label": "Target",
                "unitOrder": 1,
                "topicOrder": 1,
            }
        ],
        [
            {
                "syllabusIds": ["target"],
                "prerequisiteIds": ["external"],
            }
        ],
        [
            {
                "id": "external",
                "label": "External prerequisite",
                "dependsOn": [],
            },
            {
                "id": "target",
                "label": "Target",
                "dependsOn": ["external"],
            },
        ],
    ]

    steps = _full_syllabus_path(SUBJECT_ID, {})
    ids = [step.conceptId for step in steps]

    assert "external" in ids
    assert "target" in ids
    assert ids.index("external") < ids.index("target")
    assert next(s for s in steps if s.conceptId == "external").reason == (
        "missing_prerequisite"
    )
    assert next(s for s in steps if s.conceptId == "target").reason == (
        "syllabus_concept"
    )


@patch("app.routers.recommendation.run_query")
def test_full_syllabus_cycle_returns_409(mock_query):
    mock_query.side_effect = [
        [
            {
                "id": "concept_a",
                "label": "Concept A",
                "unitOrder": 1,
                "topicOrder": 1,
            }
        ],
        [
            {
                "syllabusIds": ["concept_a"],
                "prerequisiteIds": ["concept_b"],
            }
        ],
        [
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
        ],
    ]

    with pytest.raises(HTTPException) as exc_info:
        _full_syllabus_path(SUBJECT_ID, {})

    assert exc_info.value.status_code == 409
    assert set(exc_info.value.detail["unresolvedConceptIds"]) == {
        "concept_a",
        "concept_b",
    }
