"""
Pluggable LLM client. Switch providers via the LLM_PROVIDER env var without
touching any router code. All routers call `llm.complete(system, user)`.

Providers:
  - mock      (default): deterministic canned text, useful for building the
              rest of the app before you have API credits/keys.
  - anthropic: uses ANTHROPIC_API_KEY, model claude-sonnet-4-6 by default.
  - openai:    uses OPENAI_API_KEY.
  - local:     stub for a local/open-source model (e.g. via Ollama). Fill in
              `_complete_local` once you've picked a model.
"""
import os


class LLMClient:
    def __init__(self):
        self.provider = os.getenv("LLM_PROVIDER", "mock").lower()

    def complete(self, system: str, user: str, max_tokens: int = 1000) -> str:
        if self.provider == "anthropic":
            return self._complete_anthropic(system, user, max_tokens)
        if self.provider == "openai":
            return self._complete_openai(system, user, max_tokens)
        if self.provider == "local":
            return self._complete_local(system, user, max_tokens)
        return self._complete_mock(system, user)

    # ---------- mock ----------
    def _complete_mock(self, system: str, user: str) -> str:
        return (
            f"[MOCK LLM RESPONSE]\n"
            f"System prompt was: {system[:120]}...\n"
            f"User prompt was: {user[:200]}\n"
            f"Replace LLM_PROVIDER in .env with 'anthropic' or 'openai' (and set the "
            f"matching API key) to get real generated content here."
        )

    # ---------- anthropic ----------
    def _complete_anthropic(self, system: str, user: str, max_tokens: int) -> str:
        import anthropic

        client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user}],
        )
        return "".join(block.text for block in response.content if block.type == "text")

    # ---------- openai ----------
    def _complete_openai(self, system: str, user: str, max_tokens: int) -> str:
        from openai import OpenAI

        client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        )
        return response.choices[0].message.content

    # ---------- local ----------
    def _complete_local(self, system: str, user: str, max_tokens: int) -> str:
        # TODO: e.g. call a local Ollama server:
        #   import httpx
        #   r = httpx.post("http://localhost:11434/api/generate", json={...})
        raise NotImplementedError("Wire up your local model here (e.g. Ollama).")


llm = LLMClient()
