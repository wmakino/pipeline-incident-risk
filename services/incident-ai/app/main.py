import logging

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.core.errors import (
    LLMRateLimitError,
    LLMResponseValidationError,
    LLMTimeoutError,
    LLMUpstreamError,
)
from app.core.schemas import ErrorResponse
from app.features.criticality.router import router as criticality_router
from app.features.groundwater.router import router as groundwater_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger("app.errors")

app = FastAPI(title="Pipeline Incident AI Microservice")


def _error_handler(status_code: int, error_type: str, public_message: str):
    async def handler(request: Request, exc: Exception) -> JSONResponse:
        # Full detail goes to the server log only — never echoed back to the caller.
        logger.error("request failed: path=%s error_type=%s detail=%s", request.url.path, error_type, exc)
        return JSONResponse(
            status_code=status_code,
            content=ErrorResponse(detail=public_message, error_type=error_type).model_dump(),
        )

    return handler


# The criticality feature catches LLMError itself and always returns a fallback
# value (see service.py), so these won't fire for it — kept registered for any
# future feature that prefers a hard HTTP failure over a guessed value.
app.add_exception_handler(
    LLMRateLimitError,
    _error_handler(429, "rate_limited", "The AI service is temporarily rate-limited. Please retry shortly."),
)
app.add_exception_handler(
    LLMTimeoutError,
    _error_handler(504, "upstream_timeout", "The AI service did not respond in time. Please retry."),
)
app.add_exception_handler(
    LLMUpstreamError,
    _error_handler(502, "upstream_error", "The AI service is currently unavailable. Please retry shortly."),
)
app.add_exception_handler(
    LLMResponseValidationError,
    _error_handler(502, "invalid_model_response", "The AI service returned an unexpected response. Please retry."),
)


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


app.include_router(criticality_router, prefix="/api/v1")
app.include_router(groundwater_router, prefix="/api/v1")
