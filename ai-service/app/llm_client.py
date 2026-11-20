
import logging
import os
import random
import time

from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from threading import Lock

from openai import (
    APIStatusError,
    OpenAI,
    RateLimitError,
)

logger = logging.getLogger(__name__)


class LLMClient:
    def __init__(self):
        self.provider = os.getenv(
            "LLM_PROVIDER", "groq"
        ).strip().lower()

        self.model = os.getenv(
            "GROQ_MODEL", "openai/gpt-oss-20b"
        ).strip()

        self.timeout = float(
            os.getenv("LLM_TIMEOUT_SECONDS", "60")
        )

        self.max_retries = int(
            os.getenv("LLM_MAX_RETRIES", "3")
        )

        self.max_retry_wait = float(
            os.getenv(
                "LLM_MAX_RETRY_WAIT_SECONDS", "30"
            )
        )

        if self.timeout <= 0:
            raise ValueError(
                "LLM_TIMEOUT_SECONDS must be positive"
            )

        if self.max_retries < 1:
            raise ValueError(
                "LLM_MAX_RETRIES must be at least 1"
            )

        if self.max_retry_wait < 0:
            raise ValueError(
                "LLM_MAX_RETRY_WAIT_SECONDS cannot be negative"
            )

        self._client = None
        self._lock = Lock()

    def _get_client(self):
        if self._client is not None:
            return self._client

        with self._lock:
            if self._client is None:
                if self.provider != "groq":
                    raise RuntimeError(
                        f"Unsupported LLM_PROVIDER: "
                        f"{self.provider}"
                    )

                api_key = os.getenv(
                    "GROQ_API_KEY", ""
                ).strip()

                if not api_key:
                    raise RuntimeError(
                        "GROQ_API_KEY is missing "
                        "from the environment"
                    )

                self._client = OpenAI(
                    api_key=api_key,
                    base_url=(
                        "https://api.groq.com/openai/v1"
                    ),
                    timeout=self.timeout,
                    max_retries=0,
                )

        return self._client

    def _get_retry_after(self, exc):
        response = getattr(
            exc, "response", None
        )

        if response is None:
            return None

        headers = getattr(
            response, "headers", None
        )

        if headers is None:
            return None

        value = headers.get("retry-after")

        if not value:
            return None

        try:
            return max(0.0, float(value))
        except (ValueError, TypeError):
            pass

        try:
            retry_date = parsedate_to_datetime(
                value
            )

            if retry_date.tzinfo is None:
                retry_date = retry_date.replace(
                    tzinfo=timezone.utc
                )

            return max(
                0.0,
                (
                    retry_date
                    - datetime.now(timezone.utc)
                ).total_seconds(),
            )

        except (
            ValueError,
            TypeError,
            OverflowError,
        ):
            logger.warning(
                "Invalid Retry-After header: %s",
                value,
            )
            return None

    def _retry_delay(self, exc, attempt):
        retry_after = self._get_retry_after(
            exc
        )

        if retry_after is not None:
            return retry_after

        return (
            min(2 ** attempt, 8)
            + random.uniform(0, 0.5)
        )

    def _wait_or_raise(self, exc, attempt):
        if attempt >= self.max_retries:
            logger.error(
                "LLM request failed after "
                "%d attempts",
                attempt,
            )
            raise exc

        delay = self._retry_delay(
            exc, attempt
        )

        if delay > self.max_retry_wait:
            logger.warning(
                "Retry delay %.2fs exceeds "
                "configured maximum %.2fs",
                delay,
                self.max_retry_wait,
            )
            raise exc

        logger.warning(
            "Retrying LLM request in "
            "%.2f seconds (attempt %d/%d)",
            delay,
            attempt + 1,
            self.max_retries,
        )

        time.sleep(delay)

    def complete(
        self,
        system,
        user,
        max_tokens=1024,
        response_format="json_object",
    ):
        if max_tokens < 1:
            raise ValueError(
                "max_tokens must be positive"
            )

        client = self._get_client()

        token_limit = max_tokens
        truncation_retries = 0

        # Preserve the existing behavior:
        # Retry truncated output only once.
        while True:
            request = {
                "model": self.model,
                "messages": [
                    {
                        "role": "system",
                        "content": system,
                    },
                    {
                        "role": "user",
                        "content": user,
                    },
                ],
                "max_completion_tokens": (
                    token_limit
                ),
                "temperature": 0,
            }

            # Reduce reasoning-token consumption
            # for supported GPT-OSS models.
            if self.model in (
                "openai/gpt-oss-20b",
                "openai/gpt-oss-120b",
            ):
                request["reasoning_effort"] = (
                    "low"
                )

            if response_format:
                request["response_format"] = {
                    "type": response_format
                }

            truncated = False

            for attempt in range(
                1,
                self.max_retries + 1,
            ):
                try:
                    logger.info(
                        "LLM request: provider=%s "
                        "model=%s attempt=%d/%d "
                        "max_completion_tokens=%d",
                        self.provider,
                        self.model,
                        attempt,
                        self.max_retries,
                        token_limit,
                    )

                    response = (
                        client.chat.completions.create(
                            **request
                        )
                    )

                    if not response.choices:
                        raise RuntimeError(
                            "LLM returned no choices"
                        )

                    choice = (
                        response.choices[0]
                    )

                    content = (
                        choice.message.content or ""
                    )

                    finish_reason = (
                        choice.finish_reason
                    )

                    usage = response.usage

                    logger.info(
                        "LLM response: model=%s "
                        "finish_reason=%s "
                        "prompt_tokens=%s "
                        "completion_tokens=%s",
                        self.model,
                        finish_reason,
                        getattr(
                            usage,
                            "prompt_tokens",
                            None,
                        ),
                        getattr(
                            usage,
                            "completion_tokens",
                            None,
                        ),
                    )

                    if finish_reason == "length":
                        if truncation_retries == 0:
                            truncation_retries = 1

                            token_limit = (
                                max_tokens * 2
                            )

                            logger.warning(
                                "LLM output truncated. "
                                "Retrying once with "
                                "max_completion_tokens=%d",
                                token_limit,
                            )

                            truncated = True
                            break

                        raise RuntimeError(
                            "LLM output was truncated "
                            "twice. Initial token "
                            f"limit={max_tokens}; "
                            "retry token limit="
                            f"{token_limit}."
                        )

                    if not content.strip():
                        raise RuntimeError(
                            "LLM returned empty content; "
                            f"finish_reason={finish_reason}"
                        )

                    return content.strip()

                except RateLimitError as exc:
                    logger.warning(
                        "Groq rate limit exceeded: "
                        "attempt=%d/%d",
                        attempt,
                        self.max_retries,
                    )

                    self._wait_or_raise(
                        exc,
                        attempt,
                    )

                except APIStatusError as exc:
                    logger.error(
                        "LLM API error: status=%s "
                        "attempt=%d/%d",
                        exc.status_code,
                        attempt,
                        self.max_retries,
                    )

                    retryable = (
                        exc.status_code
                        in (500, 502, 503, 504)
                    )

                    if not retryable:
                        raise

                    self._wait_or_raise(
                        exc,
                        attempt,
                    )

            if truncated:
                continue

            raise RuntimeError(
                "LLM request failed after "
                "all retry attempts"
            )


llm = LLMClient()
