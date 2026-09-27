from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass
class ChatMessage:
    role: str
    content: str


@dataclass
class CompletionResult:
    content: str
    raw_response: dict | None = None


class AIProvider(ABC):
    provider_type: str = "custom"

    @abstractmethod
    def chat_completion(
        self,
        messages: list[ChatMessage],
        temperature: float = 0.2,
        max_tokens: int = 4000,
    ) -> CompletionResult:
        raise NotImplementedError

    @abstractmethod
    def test_connection(self) -> tuple[bool, str, int | None]:
        """Returns (success, message, latency_ms_or_None)."""
        raise NotImplementedError

    @abstractmethod
    def list_models(self) -> list[dict[str, Any]]:
        """
        Returns a list of available model descriptors from the provider.

        Each element must have at least an ``id`` key, matching the OpenAI
        ``GET /v1/models`` response shape: ``[{"id": "model-name", ...}, ...]``.

        Callers should not assume anything beyond ``id`` is present.
        Implementations MUST raise ``RuntimeError`` with a user-safe message
        on any failure (connection refused, auth errors, timeouts, malformed
        responses). Never expose raw API keys, headers, or full stack traces
        in the raised message.
        """
        raise NotImplementedError