from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.core.errors import (
    LLMRateLimitError,
    LLMResponseValidationError,
    LLMTimeoutError,
    LLMUpstreamError,
)
from app.main import app
from tests.conftest import TEST_API_KEY

client = TestClient(app, headers={"X-API-Key": TEST_API_KEY})

VALID_PAYLOAD = {
    "latitude": 53.5461,
    "longitude": -113.4938,
    "release_type": "Liquid",
    "released_substance_type": "Crude Oil - Sweet",
}


@pytest.mark.parametrize(
    "exc_cls",
    [LLMRateLimitError, LLMTimeoutError, LLMUpstreamError, LLMResponseValidationError],
)
def test_llm_error_returns_fallback_value_not_an_http_error(exc_cls):
    """Same guaranteed-200 contract as the criticality endpoint, verified through
    the full HTTP stack (app.main.app) for all four LLMError subtypes - a caller
    batch-processing many incidents should never have one bad response abort the
    whole run."""
    with (
        patch("app.features.groundwater.service.get_aquifer_vulnerability", return_value=(3, "available")),
        patch("app.features.groundwater.service.call_structured", side_effect=exc_cls("boom")),
    ):
        response = client.post("/api/v1/groundwater/impact", json=VALID_PAYLOAD)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ai_unavailable"
    assert body["groundwater_impact_score"] == 1
    assert body["confidence"] == 0.0
    # The AVI lookup already succeeded before the LLM call failed - the real
    # reading should still come through even though the AI assessment didn't.
    assert body["avi_index"] == 3
    assert body["avi_status"] == "available"
