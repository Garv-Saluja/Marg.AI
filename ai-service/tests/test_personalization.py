
from unittest.mock import patch

from app.routers.recommendation import _single_topic_path


def make_query_results():
    """Synthetic graph: A -> B -> C, where each concept requires the next."""
    return [
        [{"id": "concept_a", "label": "Concept A"}],
        [
            {
                "id": "concept_a",
                "label": "Concept A",
                "dependsOn": ["concept_b"],
            },
            {
                "id": "concept_b",
                "label": "Concept B",
                "dependsOn": ["concept_c"],
            },
            {
                "id": "concept_c",
                "label": "Concept C",
                "dependsOn": [],
            },
        ],
    ]


@patch("app.routers.recommendation.run_query")
def test_mastered_prerequisite_is_skipped(mock_query):
    mock_query.side_effect = make_query_results()

    steps = _single_topic_path(
        "concept_a",
        {
            "concept_b": 90,
        },
    )

    ids = [step.conceptId for step in steps]

    assert "concept_b" not in ids
    assert "concept_c" in ids
    assert "concept_a" in ids


@patch("app.routers.recommendation.run_query")
def test_revision_band_marks_quick_revision(mock_query):
    mock_query.side_effect = make_query_results()

    steps = _single_topic_path(
        "concept_a",
        {
            "concept_b": 70,
        },
    )

    step_b = next(step for step in steps if step.conceptId == "concept_b")
    assert step_b.reason == "quick_revision"


@patch("app.routers.recommendation.run_query")
def test_different_mastery_profiles_produce_different_paths(mock_query):
    mock_query.side_effect = make_query_results() * 2

    beginner_steps = _single_topic_path("concept_a", {})
    experienced_steps = _single_topic_path(
        "concept_a",
        {
            "concept_b": 90,
            "concept_c": 95,
        },
    )

    beginner_ids = [step.conceptId for step in beginner_steps]
    experienced_ids = [step.conceptId for step in experienced_steps]

    assert beginner_ids != experienced_ids
    assert "concept_b" in beginner_ids
    assert "concept_b" not in experienced_ids
    assert "concept_c" not in experienced_ids
