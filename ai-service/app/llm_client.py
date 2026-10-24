
import logging
import os
import time
from threading import Lock

from openai import APIStatusError, OpenAI, RateLimitError

logger = logging.getLogger(__name__)


class LLMClient:
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "groq").strip().lower()
        self.model = os.getenv(
            "GROQ_MODEL", "openai/gpt-oss-20b"
        ).strip()
        self.timeout = float(os.getenv("LLM_TIMEOUT_SECONDS", "60"))
        self.max_retries = int(os.getenv("LLM_MAX_RETRIES", "3"))

        if self.timeout <= 0:
            raise ValueError("LLM_TIMEOUT_SECONDS must be positive")
        if self.max_retries < 1:
            raise ValueError("LLM_MAX_RETRIES must be at least 1")

        self._client = None
        self._lock = Lock()

    def _get_client(self):
        if self._client is not None:
            return self._client

        with self._lock:
            if self._client is None:
                if self.provider != "groq":
                    raise RuntimeError(
                        f"Unsupported LLM_PROVIDER: {self.provider}"
                    )

                api_key = os.getenv("GROQ_API_KEY", "").strip()
                if not api_key:
                    raise RuntimeError(
                        "GROQ_API_KEY is missing from the environment"
                    )

                self._client = OpenAI(
                    api_key=api_key,
                    base_url="https://api.groq.com/openai/v1",
                    timeout=self.timeout,
                    max_retries=0,
                )

        return self._client

    def complete(
        self,
        system,
        user,
        max_tokens=1024,
        response_format="json_object",
    ):
        if max_tokens < 1:
            raise ValueError("max_tokens must be positive")

        client = self._get_client()

        # At most one extra attempt for a truncated response.
        truncation_retries = 0
        token_limit = max_tokens

        for attempt in range(1, self.max_retries + 1):
            request = {
                "model": self.model,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": user},
                ],
                "max_tokens": token_limit,
                "temperature": 0,
            }

            if response_format:
                request["response_format"] = {
                    "type": response_format
                }

            try:
                logger.info(
                    "LLM request: provider=%s model=%s "
                    "attempt=%d/%d max_tokens=%d",
                    self.provider,
                    self.model,
                    attempt,
                    self.max_retries,
                    token_limit,
                )

                response = client.chat.completions.create(**request)

                if not response.choices:
                    raise RuntimeError("LLM returned no choices")

                choice = response.choices[0]
                content = choice.message.content or ""
                finish_reason = choice.finish_reason
                usage = response.usage

                logger.info(
                    "LLM response: model=%s finish_reason=%s "
                    "prompt_tokens=%s completion_tokens=%s",
                    self.model,
                    finish_reason,
                    getattr(usage, "prompt_tokens", None),
                    getattr(usage, "completion_tokens", None),
                )

                if finish_reason == "length":
                    if truncation_retries == 0:
                        truncation_retries += 1
                        token_limit = max_tokens * 2

                        logger.warning(
                            "LLM output truncated; retrying once "
                            "with max_tokens=%d",
                            token_limit,
                        )
                        continue

                    raise RuntimeError(
                        "LLM output was truncated twice. "
                        f"Initial max_tokens={max_tokens}; "
                        f"retry max_tokens={token_limit}. "
                        "Check model reasoning usage and token limits."
                    )

                if not content.strip():
                    raise RuntimeError(
                        "LLM returned empty content; "
                        f"finish_reason={finish_reason}"
                    )

                return content.strip()

            except RateLimitError:
                logger.warning(
                    "LLM rate limit: attempt=%d/%d",
                    attempt,
                    self.max_retries,
                )
                if attempt == self.max_retries:
                    raise

                time.sleep(min(2 ** attempt, 8))

            except APIStatusError as exc:
                logger.error(
                    "LLM API error: status=%s attempt=%d/%d",
                    exc.status_code,
                    attempt,
                    self.max_retries,
                )

                retryable = exc.status_code in (500, 502, 503, 504)
                if not retryable or attempt == self.max_retries:
                    raise

                time.sleep(min(2 ** attempt, 8))

        raise RuntimeError("LLM request failed after all retry attempts")


llm = LLMClient()
