import logging
import time
from pathlib import Path

from app.core.config import get_settings
from app.core.errors import LLMError
from app.core.llm_client import get_llm_client
from app.core.structured_output import call_structured
from app.features.criticality.schemas import (
    CriticalityRequest,
    CriticalityResponse,
    LLMCriticalityOutput,
    ThreatCategory,
)

SYSTEM_PROMPT = (Path(__file__).parent / "prompts" / "system_prompt.md").read_text()

INSUFFICIENT_INPUT_MIN_LENGTH = 5

# criticality_score to report when the AI never produces a usable answer.
# Paired with confidence=0.0 + status="ai_unavailable" so a consumer that
# checks confidence can tell this apart from a real assessment. We always
# return a value here (never a raw error) because a missing/failed score for
# one incident shouldn't be able to take down a caller's whole batch run.
FALLBACK_SCORE = 1
FALLBACK_REASONING = (
    "AI classification failed after retries. This is a fallback placeholder, not a real "
    "assessment — confidence is 0 and this incident should be excluded from automated "
    "risk scoring and reviewed manually."
)

logger = logging.getLogger("criticality")


def _sanitize_for_log(value: str | None) -> str | None:
    """Strip newlines so a crafted value can't forge extra log lines."""
    if value is None:
        return None
    return value.replace("\n", " ").replace("\r", " ")


def _log_result(request: CriticalityRequest, response: CriticalityResponse, latency_s: float) -> None:
    preview = _sanitize_for_log(request.detailed_what_happened.strip())[:80]
    logger.info(
        "criticality incident_id=%s status=%s score=%s category=%r confidence=%.2f "
        "latency_ms=%.0f input=%r",
        _sanitize_for_log(request.incident_id),
        response.status,
        response.criticality_score,
        response.threat_category.value,
        response.confidence,
        latency_s * 1000,
        preview,
    )


def _is_insufficient(request: CriticalityRequest) -> bool:
    return (
        len(request.detailed_what_happened.strip()) < INSUFFICIENT_INPUT_MIN_LENGTH
        and len(request.detailed_why_it_happened.strip()) < INSUFFICIENT_INPUT_MIN_LENGTH
    )


def _escape_for_tag(text: str) -> str:
    """Prevent incident text from closing/opening tags and restructuring the prompt."""
    return text.replace("<", "&lt;").replace(">", "&gt;")


def _optional_tag(tag: str, value: str | None) -> str:
    """Build a context tag only when the value is present and non-blank — nulls and
    whitespace-only values are both treated as absent, not sent as an empty/near-empty
    tag that could confuse the model."""
    stripped = (value or "").strip()
    if not stripped:
        return ""
    return f"<{tag}>{_escape_for_tag(stripped)}</{tag}>\n"


def _build_user_content(request: CriticalityRequest) -> str:
    what_happened = _escape_for_tag(request.detailed_what_happened)
    why_it_happened = _escape_for_tag(request.detailed_why_it_happened)
    return (
        f"<what_happened>{what_happened}</what_happened>\n"
        f"<why_it_happened>{why_it_happened}</why_it_happened>\n"
        f"{_optional_tag('incident_type', request.incident_types)}"
        f"{_optional_tag('substance_carried', request.substance_carried)}"
        f"{_optional_tag('duration_of_interruption', request.duration_of_interruption)}"
        f"{_optional_tag('equipment_or_component_involved', request.equipment_or_component_involved)}"
        f"{_optional_tag('pipeline_outside_diameter_nps', request.pipeline_outside_diameter_nps)}"
        f"{_optional_tag('nominal_pipe_size', request.nominal_pipe_size)}"
        f"{_optional_tag('emergency_level', request.emergency_level)}"
        "Classify this incident using the provided schema."
    )


def score_incident(request: CriticalityRequest) -> CriticalityResponse:
    start = time.monotonic()

    if _is_insufficient(request):
        response = CriticalityResponse(
            criticality_score=1,
            reasoning="Insufficient free-text input provided to classify.",
            threat_category=ThreatCategory.AMBIGUOUS,
            confidence=0.0,
            status="insufficient_input",
            incident_id=request.incident_id,
        )
        _log_result(request, response, time.monotonic() - start)
        return response

    settings = get_settings()
    try:
        llm_output: LLMCriticalityOutput = call_structured(
            client=get_llm_client(),
            model=settings.databricks_model,
            system_prompt=SYSTEM_PROMPT,
            user_content=_build_user_content(request),
            response_model=LLMCriticalityOutput,
        )
    except LLMError as e:
        logger.error(
            "criticality AI call failed after retries, returning fallback value: incident_id=%s error=%s",
            _sanitize_for_log(request.incident_id),
            e,
        )
        response = CriticalityResponse(
            criticality_score=FALLBACK_SCORE,
            reasoning=FALLBACK_REASONING,
            threat_category=ThreatCategory.AMBIGUOUS,
            confidence=0.0,
            status="ai_unavailable",
            incident_id=request.incident_id,
        )
        _log_result(request, response, time.monotonic() - start)
        return response

    response = CriticalityResponse(
        criticality_score=llm_output.criticality_score,
        reasoning=llm_output.reasoning,
        threat_category=llm_output.threat_category,
        confidence=llm_output.confidence,
        status="scored",
        incident_id=request.incident_id,
    )
    _log_result(request, response, time.monotonic() - start)
    return response
