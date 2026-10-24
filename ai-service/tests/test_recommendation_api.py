
from fastapi.testclient import TestClient

from app.main import app
from app.routers import recommendation


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_single_topic_missing_target_returns_422():
    response = client.post(
        "/recommend/path",
        json={
            "userId": "test-user",
            "scope": "single_topic",
            "currentMastery": [],
        },
    )

    assert response.status_code == 422


def test_full_syllabus_missing_subject_returns_422():
    response = client.post(
        "/recommend/path",
        json={
            "userId": "test-user",
            "scope": "full_syllabus",
            "currentMastery": [],
        },
    )

    assert response.status_code == 422


def test_single_topic_cycle_returns_409(monkeypatch):
    def fake_single_topic_path(target_concept_id, mastery):
        raise recommendation.HTTPException(
            status_code=409,
            detail={
                "message": "Prerequisite graph contains a cycle.",
                "unresolvedConceptIds": ["concept_a", "concept_b"],
            },
        )

    monkeypatch.setattr(
        recommendation,
        "_single_topic_path",
        fake_single_topic_path,
    )

    response = client.post(
        "/recommend/path",
        json={
            "userId": "test-user",
            "scope": "single_topic",
            "targetConceptId": "concept_a",
            "currentMastery": [],
        },
    )

    assert response.status_code == 409
    assert "cycle" in response.json()["detail"]["message"].lower()


def test_single_topic_returns_recommendation_steps(monkeypatch):
    def fake_single_topic_path(target_concept_id, mastery):
        return [
            recommendation.StepOut(
                conceptId="concept_a",
                conceptLabel="Concept A",
                reason="target_concept",
            )
        ]

    monkeypatch.setattr(
        recommendation,
        "_single_topic_path",
        fake_single_topic_path,
    )

    response = client.post(
        "/recommend/path",
        json={
            "userId": "test-user",
            "scope": "single_topic",
            "targetConceptId": "concept_a",
            "currentMastery": [],
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "steps": [
            {
                "conceptId": "concept_a",
                "conceptLabel": "Concept A",
                "reason": "target_concept",
            }
        ]
    }


def test_full_syllabus_returns_recommendation_steps(monkeypatch):
    def fake_full_syllabus_path(subject_id, mastery):
        return [
            recommendation.StepOut(
                conceptId="concept_a",
                conceptLabel="Concept A",
                reason="syllabus_concept",
            )
        ]

    monkeypatch.setattr(
        recommendation,
        "_full_syllabus_path",
        fake_full_syllabus_path,
    )

    response = client.post(
        "/recommend/path",
        json={
            "userId": "test-user",
            "scope": "full_syllabus",
            "subjectId": "test-subject",
            "currentMastery": [],
        },
    )

    assert response.status_code == 200
    assert response.json()["steps"][0]["conceptId"] == "concept_a"

def test_api_passes_mastery_scores_to_recommendation(monkeypatch):
    captured = {}

    def fake_single_topic_path(target_concept_id, mastery):
        captured["target"] = target_concept_id
        captured["mastery"] = mastery
        return [
            recommendation.StepOut(
                conceptId=target_concept_id,
                conceptLabel="Concept A",
                reason="target_concept",
            )
        ]

    monkeypatch.setattr(
        recommendation,
        "_single_topic_path",
        fake_single_topic_path,
    )

    response = client.post(
        "/recommend/path",
        json={
            "userId": "test-user",
            "scope": "single_topic",
            "targetConceptId": "concept_a",
            "currentMastery": [
                {
                    "concept_id": "concept_b",
                    "mastery_score": 90,
                    "status": "mastered",
                }
            ],
        },
    )

    assert response.status_code == 200
    assert captured["target"] == "concept_a"
    assert captured["mastery"] == {"concept_b": 90.0}


def test_api_returns_complete_recommendation_response(monkeypatch):
    def fake_single_topic_path(target_concept_id, mastery):
        return [
            recommendation.StepOut(
                conceptId="concept_a",
                conceptLabel="Concept A",
                reason="target_concept",
            ),
            recommendation.StepOut(
                conceptId="concept_b",
                conceptLabel="Concept B",
                reason="quick_revision",
            ),
        ]

    monkeypatch.setattr(
        recommendation,
        "_single_topic_path",
        fake_single_topic_path,
    )

    response = client.post(
        "/recommend/path",
        json={
            "userId": "test-user",
            "scope": "single_topic",
            "targetConceptId": "concept_a",
            "currentMastery": [],
        },
    )

    assert response.status_code == 200
    assert response.json() == {
        "steps": [
            {
                "conceptId": "concept_a",
                "conceptLabel": "Concept A",
                "reason": "target_concept",
            },
            {
                "conceptId": "concept_b",
                "conceptLabel": "Concept B",
                "reason": "quick_revision",
            },
        ]
    }
        