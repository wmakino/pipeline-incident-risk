import hmac

from fastapi import Depends, HTTPException, Security
from fastapi.security import APIKeyHeader

from app.core.config import get_settings

_api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


def require_api_key(provided: str | None = Security(_api_key_header)) -> None:
    settings = get_settings()
    if provided is None or not hmac.compare_digest(provided, settings.api_key):
        raise HTTPException(status_code=401, detail="Missing or invalid API key")
