from unittest.mock import patch

from fastapi.testclient import TestClient

from app.features.criticality.schemas import LLMCriticalityOutput, ThreatCategory
from app.main import app
from tests.conftest import TEST_API_KEY

client = TestClient(app, headers={"X-API-Key": TEST_API_KEY})


def test_score_valid_request_returns_200():
    fake_llm_output = LLMCriticalityOutput(
        criticality_score=3,
        reasoning="Third-party damage with no clear pattern.",
        threat_category=ThreatCategory.THIRD_PARTY_MECHANICAL_DAMAGE,
        confidence=0.7,
    )
    with patch(
        "app.features.criticality.service.call_structured", return_value=fake_llm_output
    ):
        response = client.post(
            "/api/v1/criticality/score",
            json={
                "detailed_what_happened": "Excavator struck the line.",
                "detailed_why_it_happened": "No locate request was made before digging.",
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert body["criticality_score"] == 3
    assert body["threat_category"] == "third-party/mechanical damage"
    assert body["status"] == "scored"


def test_score_missing_field_returns_422():
    response = client.post(
        "/api/v1/criticality/score", json={"detailed_what_happened": "only one field"}
    )
    assert response.status_code == 422


VALID_PAYLOAD = {
    "detailed_what_happened": "Excavator struck the line.",
    "detailed_why_it_happened": "No locate request was made before digging.",
}


def test_score_missing_api_key_returns_401():
    unauthenticated_client = TestClient(app)  # no X-API-Key header at all
    response = unauthenticated_client.post("/api/v1/criticality/score", json=VALID_PAYLOAD)
    assert response.status_code == 401


def test_score_wrong_api_key_returns_401():
    wrong_key_client = TestClient(app, headers={"X-API-Key": "not-the-right-key"})
    response = wrong_key_client.post("/api/v1/criticality/score", json=VALID_PAYLOAD)
    assert response.status_code == 401


def test_health_does_not_require_api_key():
    unauthenticated_client = TestClient(app)
    response = unauthenticated_client.get("/health")
    assert response.status_code == 200
