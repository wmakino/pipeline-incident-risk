from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    databricks_host: str
    databricks_token: str
    databricks_model: str = "databricks-meta-llama-3-3-70b-instruct"
    api_key: str


@lru_cache
def get_settings() -> Settings:
    return Settings()
