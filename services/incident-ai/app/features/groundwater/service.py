import logging
import time
from pathlib import Path

from app.core.config import get_settings
from app.core.errors import LLMError
from app.core.llm_client import get_llm_client
from app.core.structured_output import call_structured
from app.features.groundwater.aquifer_lookup import get_aquifer_vulnerability
from app.features.groundwater.schemas import (
    GroundwaterImpactRequest,
    GroundwaterImpactResponse,
    LLMGroundwaterOutput,
)

SYSTEM_PROMPT = (Path(__file__).parent / "prompts" / "system_prompt.md").read_text()

# groundwater_impact_score to report when the AI never produces a usable
# answer. Paired with confidence=0.0 + status="ai_unavailable", same
# guaranteed-value pattern already proven on the criticality endpoint - one
# bad incident should never be able to take down a caller's whole batch run.
FALLBACK_SCORE = 1
FALLBACK_REASONING = (
    "AI assessment failed after retries. This is a fallback placeholder, not a real "
    "assessment — confidence is 0 and this incident should be excluded from automated "
    "risk scoring and reviewed manually."
)

logger = logging.getLogger("groundwater")


def _sanitize_for_log(value: str | None) -> str | None:
    """Strip newlines so a crafted value can't forge extra log lines."""
    if value is None:
        return None
    return value.replace("\n", " ").replace("\r", " ")


def _log_result(request: GroundwaterImpactRequest, response: GroundwaterImpactResponse, latency_s: float) -> None:
    logger.info(
        "groundwater incident_id=%s status=%s score=%s confidence=%.2f avi_index=%s "
        "avi_status=%s latency_ms=%.0f",
        _sanitize_for_log(request.incident_id),
        response.status,
        response.groundwater_impact_score,
        response.confidence,
        response.avi_index,
        response.avi_status,
        latency_s * 1000,
    )


def _is_insufficient(request: GroundwaterImpactRequest) -> bool:
    """A release that was never liquid, or has no known substance, has no
    groundwater pathway for this endpoint to assess."""
    if request.release_type != "Liquid":
        return True
    return not (request.released_substance_type or "").strip()


def _escape_for_tag(text: str) -> str:
    """Prevent incident text from closing/opening tags and restructuring the prompt."""
    return text.replace("<", "&lt;").replace(">", "&gt;")


def _optional_tag(tag: str, value: str | float | None) -> str:
    """Build a context tag only when the value is present - nulls and
    whitespace-only values are both treated as absent, not sent as an
    empty/near-empty tag that could confuse the model."""
    if value is None:
        return ""
    stripped = str(value).strip()
    if not stripped:
        return ""
    return f"<{tag}>{_escape_for_tag(stripped)}</{tag}>\n"


def _avi_content(avi_index: int | None, avi_status: str) -> str:
    """The AVI reading goes in as a real tagged number when we have one.
    When we don't, this is plain language, not a sentinel number - missing
    data is not the same as a safe/low reading."""
    if avi_status == "available":
        return f"<avi_index>{avi_index}</avi_index>\n"
    return "AVI groundwater vulnerability data is not available for this location.\n"


def _build_user_content(request: GroundwaterImpactRequest, avi_index: int | None, avi_status: str) -> str:
    return (
        f"{_optional_tag('released_substance_type', request.released_substance_type)}"
        f"{_optional_tag('released_volume_m3', request.released_volume_m3)}"
        f"{_optional_tag('incident_type', request.incident_type)}"
        f"{_optional_tag('residual_effects_on_environment', request.residual_effects_on_environment)}"
        f"{_optional_tag('land_use', request.land_use)}"
        f"{_avi_content(avi_index, avi_status)}"
        "Assess this incident's long-term groundwater impact using the provided schema."
    )


def score_groundwater_impact(request: GroundwaterImpactRequest) -> GroundwaterImpactResponse:
    start = time.monotonic()

    if _is_insufficient(request):
        response = GroundwaterImpactResponse(
            groundwater_impact_score=1,
            reasoning="Not a liquid release with a known substance — no groundwater pathway to assess.",
            confidence=0.0,
            status="insufficient_input",
            avi_index=None,
            avi_status="no_coverage",
            incident_id=request.incident_id,
        )
        _log_result(request, response, time.monotonic() - start)
        return response

    avi_index, avi_status = get_aquifer_vulnerability(request.latitude, request.longitude)

    settings = get_settings()
    try:
        llm_output: LLMGroundwaterOutput = call_structured(
            client=get_llm_client(),
            model=settings.databricks_model,
            system_prompt=SYSTEM_PROMPT,
            user_content=_build_user_content(request, avi_index, avi_status),
            response_model=LLMGroundwaterOutput,
        )
    except LLMError as e:
        logger.error(
            "groundwater AI call failed after retries, returning fallback value: incident_id=%s error=%s",
            _sanitize_for_log(request.incident_id),
            e,
        )
        response = GroundwaterImpactResponse(
            groundwater_impact_score=FALLBACK_SCORE,
            reasoning=FALLBACK_REASONING,
            confidence=0.0,
            status="ai_unavailable",
            # The AVI lookup is deterministic and already succeeded before
            # the LLM call failed - preserve that real reading rather than
            # discarding it along with the failed AI assessment.
            avi_index=avi_index,
            avi_status=avi_status,
            incident_id=request.incident_id,
        )
        _log_result(request, response, time.monotonic() - start)
        return response

    response = GroundwaterImpactResponse(
        groundwater_impact_score=llm_output.groundwater_impact_score,
        reasoning=llm_output.reasoning,
        confidence=llm_output.confidence,
        status="scored",
        avi_index=avi_index,
        avi_status=avi_status,
        incident_id=request.incident_id,
    )
    _log_result(request, response, time.monotonic() - start)
    return response
