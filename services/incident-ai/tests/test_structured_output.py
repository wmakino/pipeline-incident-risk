from unittest.mock import MagicMock, patch

import openai
import pytest
from pydantic import BaseModel

from app.core.errors import LLMRateLimitError, LLMResponseValidationError
from app.core.structured_output import call_structured


class ToyModel(BaseModel):
    category: str
    score: int


def _completion_with(content: str | None) -> MagicMock:
    message = MagicMock(content=content)
    choice = MagicMock(message=message)
    return MagicMock(choices=[choice])


def _mock_client_returning(content: str) -> MagicMock:
    client = MagicMock()
    client.chat.completions.create.return_value = _completion_with(content)
    return client


def _mock_client_with_sequence(*contents: str) -> MagicMock:
    client = MagicMock()
    client.chat.completions.create.side_effect = [_completion_with(c) for c in contents]
    return client


def test_valid_json_returns_validated_model():
    client = _mock_client_returning('{"category": "cat_a", "score": 3}')

    result = call_structured(
        client=client,
        model="fake-model",
        system_prompt="system",
        user_content="user",
        response_model=ToyModel,
    )

    assert isinstance(result, ToyModel)
    assert result.category == "cat_a"
    assert result.score == 3
    client.chat.completions.create.assert_called_once()


def test_malformed_json_retries_then_raises_validation_error():
    client = _mock_client_returning("not json at all")

    with pytest.raises(LLMResponseValidationError):
        call_structured(
            client=client,
            model="fake-model",
            system_prompt="system",
            user_content="user",
            response_model=ToyModel,
        )

    # Initial call + one corrective retry, never silently returns garbage.
    assert client.chat.completions.create.call_count == 2


def test_malformed_json_no_retry_raises_immediately():
    client = _mock_client_returning("not json at all")

    with pytest.raises(LLMResponseValidationError):
        call_structured(
            client=client,
            model="fake-model",
            system_prompt="system",
            user_content="user",
            response_model=ToyModel,
            _retry_on_validation_failure=False,
        )

    client.chat.completions.create.assert_called_once()


def test_malformed_then_valid_recovers_on_retry():
    client = _mock_client_with_sequence("not json at all", '{"category": "cat_b", "score": 5}')

    result = call_structured(
        client=client,
        model="fake-model",
        system_prompt="system",
        user_content="user",
        response_model=ToyModel,
    )

    assert isinstance(result, ToyModel)
    assert result.category == "cat_b"
    assert result.score == 5
    assert client.chat.completions.create.call_count == 2


def test_none_content_is_treated_as_validation_failure_not_unhandled_exception():
    client = _mock_client_returning(None)

    with pytest.raises(LLMResponseValidationError):
        call_structured(
            client=client,
            model="fake-model",
            system_prompt="system",
            user_content="user",
            response_model=ToyModel,
            _retry_on_validation_failure=False,
        )


def _rate_limit_error() -> openai.RateLimitError:
    response = MagicMock(status_code=429, headers={})
    return openai.RateLimitError("rate limited", response=response, body=None)


@patch("app.core.structured_output.time.sleep")
def test_transport_error_retries_then_succeeds(mock_sleep):
    client = MagicMock()
    client.chat.completions.create.side_effect = [
        _rate_limit_error(),
        _completion_with('{"category": "cat_a", "score": 2}'),
    ]

    result = call_structured(
        client=client,
        model="fake-model",
        system_prompt="system",
        user_content="user",
        response_model=ToyModel,
    )

    assert result.category == "cat_a"
    assert client.chat.completions.create.call_count == 2
    mock_sleep.assert_called_once()


@patch("app.core.structured_output.time.sleep")
def test_transport_error_exhausts_retries_and_raises(mock_sleep):
    client = MagicMock()
    client.chat.completions.create.side_effect = [_rate_limit_error(), _rate_limit_error()]

    with pytest.raises(LLMRateLimitError):
        call_structured(
            client=client,
            model="fake-model",
            system_prompt="system",
            user_content="user",
            response_model=ToyModel,
        )

    assert client.chat.completions.create.call_count == 2


@patch("app.core.structured_output.time.sleep")
def test_validation_retry_does_not_nest_a_transport_retry(mock_sleep):
    """A transport error during the *correction* attempt must not trigger its own
    transport retry — worst case is capped at 3 calls total (2 for the initial
    attempt + 1 for the correction), not 4."""
    client = MagicMock()
    client.chat.completions.create.side_effect = [
        _completion_with("not json at all"),  # initial attempt: malformed, triggers correction
        _rate_limit_error(),  # correction attempt: transport error, must NOT retry internally
    ]

    with pytest.raises(LLMRateLimitError):
        call_structured(
            client=client,
            model="fake-model",
            system_prompt="system",
            user_content="user",
            response_model=ToyModel,
        )

    assert client.chat.completions.create.call_count == 2
    mock_sleep.assert_not_called()
