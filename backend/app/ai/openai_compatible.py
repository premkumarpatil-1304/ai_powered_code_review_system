import time
from typing import Any
from urllib.parse import urlparse

import httpx

from app.ai.base import AIProvider, ChatMessage, CompletionResult


def _sanitize(msg: str) -> str:
    """Remove anything that could leak API keys, tokens, or full raw payloads."""
    # Drop anything that looks like a Bearer token fragment
    if "Bearer " in msg:
        msg = msg.split("Bearer ")[0].rstrip()
    # Truncate very long upstream JSON bodies to a short preview (we never print keys)
    if len(msg) > 400:
        msg = msg[:400] + "…"
    return msg


_PLACEHOLDER_KEYS = {"", "local", "lm-studio", "lm_studio", "ollama", "none", "placeholder"}


class OpenAICompatibleProvider(AIProvider):
    """
    Works with ANY endpoint that implements the OpenAI /v1/chat/completions
    contract: OpenAI itself, LM Studio, Ollama (with OpenAI compat enabled),
    OpenRouter, and any other compatible self-hosted or cloud endpoint.
    """

    def __init__(
        self,
        base_url: str,
        api_key: str | None,
        model_name: str,
        provider_type: str = "custom",
    ):
        self.base_url = base_url.rstrip("/")
        # Always hold a non-None string. Local-only placeholder so callers / future SDK
        # integrations never see None. We filter placeholders out below in _headers
        # so NO Authorization header is ever sent for a local-only key.
        effective_key = (api_key or "").strip()
        self._has_real_api_key = bool(effective_key) and effective_key.lower() not in _PLACEHOLDER_KEYS
        self.api_key: str = effective_key or (
            "lm-studio" if provider_type == "lm_studio" else "local"
        )
        self.model_name = model_name
        self.provider_type = provider_type

    # --------------------------- helpers ---------------------------

    def _headers(self) -> dict:
        headers = {"Content-Type": "application/json"}
        if self._has_real_api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers

    def _pretty_provider(self) -> str:
        return {
            "openai": "OpenAI",
            "lm_studio": "LM Studio",
            "ollama": "Ollama",
            "openrouter": "OpenRouter",
        }.get(self.provider_type, "AI provider")

    def _friendly_base(self) -> str:
        parsed = urlparse(self.base_url)
        host = parsed.hostname or self.base_url
        port = f":{parsed.port}" if parsed.port else ""
        return f"{host}{port}"

    def _friendly_http_error(self, status: int, text: str) -> str:
        name = self._pretty_provider()
        base = self._friendly_base()
        lower = (text or "").lower()

        if status == 401 or status == 403:
            if self.provider_type == "openai":
                return f"Authentication failed for OpenAI. Check your API key."
            if self.provider_type == "openrouter":
                return "Authentication failed for OpenRouter. Check your API key."
            if self.provider_type in ("lm_studio", "ollama"):
                return f"Authentication failed for {name} at {base}. Local providers usually do not require an API key — try clearing the key."
            return f"Authentication failed for {name}. Check your API key."

        if status == 404:
            if self.provider_type == "lm_studio":
                return f"Cannot reach LM Studio at {base}. Start the LM Studio local server, load a model, and enable the API on port 1234, then try again."
            if self.provider_type == "ollama":
                return f"Cannot reach Ollama at {base}. Make sure Ollama is running and the OpenAI-compatible endpoint is enabled (default port 11434)."
            return f"The {name} endpoint at {base} returned 404 Not Found. Check the Base URL."

        if status == 400 and ("model" in lower or "not found" in lower):
            return f"Configured model was not found on this provider. Check the model name or click Fetch available models."

        if status >= 500:
            return f"{name} endpoint at {base} returned a server error ({status}). The provider may be unavailable — try again later."

        # Generic: keep safe preview (never raw headers/keys)
        return f"{name} returned an error ({status}): {_sanitize(text)}"

    def _friendly_request_error(self, exc: httpx.RequestError) -> str:
        name = self._pretty_provider()
        base = self._friendly_base()
        msg = str(exc).lower()

        if "connect" in msg or "connection refused" in msg or "name or service not known" in msg or "dns" in msg:
            if self.provider_type == "lm_studio":
                return f"Cannot connect to LM Studio at http://{base}. Start the LM Studio local server and try again."
            if self.provider_type == "ollama":
                return f"Cannot connect to Ollama at {base}. Make sure Ollama is running."
            return f"Cannot connect to {name} at {base}. Check the Base URL and network."

        if "timed out" in msg or "timeout" in msg:
            return "The AI provider took too long to respond. Try again, or use a smaller review scope."

        return f"Could not reach {name} at {base}: {_sanitize(str(exc))}"

    # --------------------------- core API ---------------------------

    def chat_completion(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.2,
        max_tokens: int = 4000,
    ) -> CompletionResult:
        url = f"{self.base_url}/chat/completions"
        payload = {
            "model": self.model_name,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        try:
            response = httpx.post(
                url,
                json=payload,
                headers=self._headers(),
                timeout=120.0,
            )
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                self._friendly_http_error(e.response.status_code, e.response.text[:800])
            )
        except httpx.TimeoutException:
            raise RuntimeError(
                "The AI provider took too long to respond. Try again, or use a smaller review scope."
            )
        except httpx.RequestError as e:
            raise RuntimeError(self._friendly_request_error(e))

        try:
            content = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError):
            raise RuntimeError(
                f"Unexpected response shape from {self._pretty_provider()}."
            )

        return CompletionResult(content=content, raw_response=data)

    def test_connection(self) -> tuple[bool, str, int | None]:
        try:
            start = time.monotonic()
            self.chat_completion(
                messages=[ChatMessage(role="user", content="Reply with just the word OK.")],
                temperature=0,
                max_tokens=5,
            )
            elapsed_ms = int((time.monotonic() - start) * 1000)
            return True, f"Connected successfully ({elapsed_ms}ms).", elapsed_ms
        except RuntimeError as e:
            return False, str(e), None

    def list_models(self) -> list[dict[str, Any]]:
        url = f"{self.base_url}/models"
        try:
            response = httpx.get(url, headers=self._headers(), timeout=30.0)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as e:
            raise RuntimeError(
                self._friendly_http_error(e.response.status_code, e.response.text[:800])
            )
        except httpx.TimeoutException:
            raise RuntimeError("Model discovery timed out. Try again.")
        except httpx.RequestError as e:
            raise RuntimeError(self._friendly_request_error(e))

        if not isinstance(data, dict) or "data" not in data or not isinstance(data["data"], list):
            raise RuntimeError(
                f"Unexpected response from {self._pretty_provider()} /models endpoint."
            )

        models: list[dict[str, Any]] = []
        for item in data["data"]:
            if isinstance(item, dict) and isinstance(item.get("id"), str):
                models.append({"id": item["id"]})
        return models
