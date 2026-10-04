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
    "detailed_what_happened": "Excavator struck the line.",
    "detailed_why_it_happened": "No locate request was made before digging.",
}


@pytest.mark.parametrize(
    "exc_cls",
    [LLMRateLimitError, LLMTimeoutError, LLMUpstreamError, LLMResponseValidationError],
)
def test_llm_error_returns_fallback_value_not_an_http_error(exc_cls):
    """The criticality endpoint always returns a well-formed score, even when the
    AI call fails after retries — a caller batch-processing many incidents should
    never have one bad response abort the whole run."""
    with patch(
        "app.features.criticality.service.call_structured",
        side_effect=exc_cls("boom"),
    ):
        response = client.post("/api/v1/criticality/score", json=VALID_PAYLOAD)

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ai_unavailable"
    assert body["criticality_score"] == 1
    assert body["confidence"] == 0.0
    assert body["threat_category"] == "Ambiguous"
