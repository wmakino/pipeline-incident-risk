from unittest.mock import patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.features.groundwater.router import router as groundwater_router
from app.features.groundwater.schemas import LLMGroundwaterOutput
from tests.conftest import TEST_API_KEY

# Mounted in its own test app (not app.main.app) so this test doesn't depend
# on main.py already being wired in - that's a separate task.
app_under_test = FastAPI()
app_under_test.include_router(groundwater_router, prefix="/api/v1")
client = TestClient(app_under_test, headers={"X-API-Key": TEST_API_KEY})

VALID_PAYLOAD = {
    "latitude": 53.5461,
    "longitude": -113.4938,
    "release_type": "Liquid",
    "released_substance_type": "Crude Oil - Sweet",
}


def test_impact_valid_request_returns_200():
    fake_llm_output = LLMGroundwaterOutput(
        groundwater_impact_score=3,
        reasoning="Moderate pathway vulnerability with a mobile substance.",
        confidence=0.75,
    )
    with (
        patch("app.features.groundwater.service.get_aquifer_vulnerability", return_value=(3, "available")),
        patch("app.features.groundwater.service.call_structured", return_value=fake_llm_output),
    ):
        response = client.post("/api/v1/groundwater/impact", json=VALID_PAYLOAD)

    assert response.status_code == 200
    body = response.json()
    assert body["groundwater_impact_score"] == 3
    assert body["avi_index"] == 3
    assert body["status"] == "scored"


def test_impact_missing_required_field_returns_422():
    payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "release_type"}

    response = client.post("/api/v1/groundwater/impact", json=payload)

    assert response.status_code == 422


def test_impact_missing_api_key_returns_401():
    unauthenticated_client = TestClient(app_under_test)

    response = unauthenticated_client.post("/api/v1/groundwater/impact", json=VALID_PAYLOAD)

    assert response.status_code == 401


def test_impact_wrong_api_key_returns_401():
    wrong_key_client = TestClient(app_under_test, headers={"X-API-Key": "not-the-right-key"})

    response = wrong_key_client.post("/api/v1/groundwater/impact", json=VALID_PAYLOAD)

    assert response.status_code == 401
