import pytest

from app.core.config import get_settings

TEST_API_KEY = "test-api-key-for-tests"


@pytest.fixture(autouse=True)
def _fixed_test_settings(monkeypatch):
    """Every test gets a known, fixed API_KEY (and the other required settings)
    instead of depending on whatever happens to be in the real .env file."""
    monkeypatch.setenv("API_KEY", TEST_API_KEY)
    monkeypatch.setenv("DATABRICKS_HOST", "https://test.cloud.databricks.com")
    monkeypatch.setenv("DATABRICKS_TOKEN", "test-databricks-token")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()
