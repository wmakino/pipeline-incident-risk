from functools import lru_cache

from openai import OpenAI

from app.core.config import get_settings


@lru_cache
def get_llm_client() -> OpenAI:
    settings = get_settings()
    return OpenAI(
        api_key=settings.databricks_token,
        base_url=f"{settings.databricks_host}/serving-endpoints",
    )
