"""
Generic structured-output helper shared by every AI feature in this service.

Mechanism: Databricks' pay-per-token Llama 3.3 70B endpoint was spiked
(scripts/spike_structured_output.py) against response_format=json_schema
(strict mode), forced tool-calling, and a strict-prompt fallback — all three
worked, but json_schema strict mode was the most reliable (4/4 valid,
schema-conformant runs) and needs no post-hoc parsing tricks, so it's the
one used here.
"""

import json
import time
from typing import TypeVar

import openai
from openai.types.chat import ChatCompletion
from openai import OpenAI
from pydantic import BaseModel, ValidationError

from app.core.errors import (
    LLMError,
    LLMRateLimitError,
    LLMResponseValidationError,
    LLMTimeoutError,
    LLMUpstreamError,
)

ResponseModelT = TypeVar("ResponseModelT", bound=BaseModel)

# Transport failures (rate limit, timeout, 5xx) are often transient — retry a
# bounded number of times with a short backoff before giving up. This is
# separate from the validation retry below, which replays a corrective prompt
# rather than just resending the same request.
TRANSPORT_RETRY_ATTEMPTS = 2
TRANSPORT_RETRY_BACKOFF_S = 1.5


def _create_completion(
    client: OpenAI,
    model: str,
    messages: list[dict],
    max_tokens: int,
    temperature: float,
    response_model: type[BaseModel],
    max_attempts: int = TRANSPORT_RETRY_ATTEMPTS,
) -> ChatCompletion:
    """Call the model with json_schema strict mode. Retries transport failures (up to
    max_attempts); maps SDK errors to our error types. Raises on the final attempt
    instead of deferring to a possibly-unset variable, so there's no reachable path
    where nothing was ever actually raised."""
    for attempt in range(max_attempts):
        try:
            return client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                response_format={
                    "type": "json_schema",
                    "json_schema": {
                        "name": response_model.__name__,
                        "strict": True,
                        "schema": response_model.model_json_schema(),
                    },
                },
            )
        except openai.RateLimitError as e:
            error: LLMError = LLMRateLimitError(str(e))
        except openai.APITimeoutError as e:
            error = LLMTimeoutError(str(e))
        except (openai.APIStatusError, openai.APIConnectionError) as e:
            error = LLMUpstreamError(str(e))

        if attempt == max_attempts - 1:
            raise error
        time.sleep(TRANSPORT_RETRY_BACKOFF_S)


def _parse_and_validate(raw_content: str | None, response_model: type[ResponseModelT]) -> ResponseModelT:
    """Parse + validate a completion's content. Always raises LLMResponseValidationError on failure."""
    if raw_content is None:
        raise LLMResponseValidationError("Model response had no content")
    try:
        return response_model.model_validate(json.loads(raw_content))
    except (json.JSONDecodeError, ValidationError) as e:
        raise LLMResponseValidationError(str(e)) from e


def call_structured(
    client: OpenAI,
    model: str,
    system_prompt: str,
    user_content: str,
    response_model: type[ResponseModelT],
    max_tokens: int = 350,
    temperature: float = 0,
    _retry_on_validation_failure: bool = True,
) -> ResponseModelT:
    """Call the model and validate its JSON response against response_model.

    Raises LLMRateLimitError / LLMTimeoutError / LLMUpstreamError /
    LLMResponseValidationError on failure — never returns an unvalidated result.
    """
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content},
    ]

    completion = _create_completion(client, model, messages, max_tokens, temperature, response_model)
    raw_content = completion.choices[0].message.content

    try:
        return _parse_and_validate(raw_content, response_model)
    except LLMResponseValidationError as first_error:
        if not _retry_on_validation_failure:
            raise

        # One corrective retry: show the model what it sent and why it failed.
        retry_messages = messages + [
            {"role": "assistant", "content": raw_content or ""},
            {
                "role": "user",
                "content": (
                    "Your previous response could not be parsed/validated: "
                    f"{first_error}. Respond again with ONLY valid JSON matching the schema."
                ),
            },
        ]
        # No nested transport retry here: the initial attempt already spent its
        # transport-retry budget, so a second transport failure on the
        # correction attempt goes straight to the caller's fallback instead of
        # compounding into a 4-call, multi-sleep worst case.
        retry_completion = _create_completion(
            client, model, retry_messages, max_tokens, temperature, response_model, max_attempts=1
        )
        retry_raw = retry_completion.choices[0].message.content
        return _parse_and_validate(retry_raw, response_model)
