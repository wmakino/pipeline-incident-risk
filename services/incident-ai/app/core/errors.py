class LLMError(Exception):
    """Base class for all LLM-call failures."""


class LLMRateLimitError(LLMError):
    """Databricks returned a 429."""


class LLMTimeoutError(LLMError):
    """The call to Databricks timed out."""


class LLMUpstreamError(LLMError):
    """Databricks returned a 5xx, or the connection failed."""


class LLMResponseValidationError(LLMError):
    """The model's response could not be parsed/validated against the expected schema."""
