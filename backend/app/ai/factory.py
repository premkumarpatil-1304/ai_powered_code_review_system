from app.ai.base import AIProvider
from app.ai.openai_compatible import OpenAICompatibleProvider
from app.models.ai_provider import AIProvider as AIProviderModel
from app.security import decrypt_value


class AIProviderFactory:
    """
    Single place that turns a DB row (AIProviderModel) into a usable,
    ready-to-call AIProvider instance. ReviewService/ChatService call
    THIS, never OpenAICompatibleProvider directly — so if a genuinely
    different backend is ever added later, only this file changes.
    """

    @staticmethod
    def create(provider_row: AIProviderModel) -> AIProvider:
        # Decrypt the key only at the point of use — never held decrypted
        # anywhere else (not in memory longer than needed, not logged).
        api_key = (
            decrypt_value(provider_row.api_key_encrypted)
            if provider_row.api_key_encrypted
            else None
        )

        # Every provider_type maps to the same class today. This is
        # intentional per the requirement: no per-vendor branching logic.
        # provider_type is kept purely for UI display / validation.
        return OpenAICompatibleProvider(
            base_url=provider_row.base_url,
            api_key=api_key,
            model_name=provider_row.model_name,
            provider_type=provider_row.provider_type,
        )