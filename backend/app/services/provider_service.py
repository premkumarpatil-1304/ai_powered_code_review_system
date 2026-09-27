import uuid
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.repositories import provider_repo
from app.models.ai_provider import AIProvider
from app.security import encrypt_value
from app.ai.factory import AIProviderFactory
from app.ai.openai_compatible import OpenAICompatibleProvider
from app.schemas.provider import ProviderCreate, ProviderUpdate, TestConnectionResult

ALLOWED_PROVIDER_TYPES = {"openai", "lm_studio", "ollama", "openrouter", "custom"}


def create_provider(db: Session, user_id: uuid.UUID, payload: ProviderCreate) -> AIProvider:
    if payload.provider_type not in ALLOWED_PROVIDER_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"provider_type must be one of {sorted(ALLOWED_PROVIDER_TYPES)}",
        )

    # If this new provider is being set as default, clear any existing
    # default first — only one provider per user can be default.
    if payload.is_default:
        provider_repo.unset_all_defaults(db, user_id)

    provider = AIProvider(
        user_id=user_id,
        name=payload.name,
        provider_type=payload.provider_type,
        base_url=payload.base_url,
        api_key_encrypted=encrypt_value(payload.api_key) if payload.api_key else None,
        model_name=payload.model_name,
        is_default=payload.is_default,
    )
    return provider_repo.create(db, provider)


def list_providers(db: Session, user_id: uuid.UUID) -> list[AIProvider]:
    return provider_repo.list_for_user(db, user_id)


def get_provider_or_404(db: Session, user_id: uuid.UUID, provider_id: uuid.UUID) -> AIProvider:
    provider = provider_repo.get_for_user(db, user_id, provider_id)
    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="AI provider not found.",
        )
    return provider


def update_provider(
    db: Session, user_id: uuid.UUID, provider_id: uuid.UUID, payload: ProviderUpdate
) -> AIProvider:
    provider = get_provider_or_404(db, user_id, provider_id)

    if payload.is_default is True:
        provider_repo.unset_all_defaults(db, user_id)

    # Only overwrite fields that were actually provided (partial update)
    if payload.name is not None:
        provider.name = payload.name
    if payload.base_url is not None:
        provider.base_url = payload.base_url
    if payload.api_key is not None:
        provider.api_key_encrypted = encrypt_value(payload.api_key)
    if payload.model_name is not None:
        provider.model_name = payload.model_name
    if payload.is_default is not None:
        provider.is_default = payload.is_default

    db.commit()
    db.refresh(provider)
    return provider


def delete_provider(db: Session, user_id: uuid.UUID, provider_id: uuid.UUID) -> None:
    provider = get_provider_or_404(db, user_id, provider_id)
    provider_repo.delete(db, provider)


def test_provider_connection(db: Session, user_id: uuid.UUID, provider_id: uuid.UUID) -> TestConnectionResult:
    provider = get_provider_or_404(db, user_id, provider_id)

    # Build a real client via the SAME factory the review engine will use —
    # this proves the actual code path works, not just a mocked check.
    client = AIProviderFactory.create(provider)
    success, message, latency_ms = client.test_connection()

    return TestConnectionResult(success=success, message=message, latency_ms=latency_ms)


def list_provider_models(db: Session, user_id: uuid.UUID, provider_id: uuid.UUID) -> list[dict]:
    """Return available models from the provider's /v1/models endpoint.

    Each entry is a dict with at least an ``id`` key. Raises ``HTTPException``
    with a user-safe error on any failure.
    """
    provider = get_provider_or_404(db, user_id, provider_id)
    client = AIProviderFactory.create(provider)
    try:
        return client.list_models()
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )


def list_models_for_preview(payload: ProviderCreate) -> list[dict]:
    """Return models for a not-yet-saved provider config (used by the form's
    "Fetch models" before the user clicks Save). No DB access — the caller is
    responsible for validating provider_type via the normal validation layer.
    """
    if payload.provider_type not in ALLOWED_PROVIDER_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"provider_type must be one of {sorted(ALLOWED_PROVIDER_TYPES)}",
        )
    client = OpenAICompatibleProvider(
        base_url=payload.base_url,
        api_key=payload.api_key,
        model_name=payload.model_name or "preview",
        provider_type=payload.provider_type,
    )
    try:
        return client.list_models()
    except RuntimeError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e),
        )


def test_provider_preview(payload: ProviderCreate) -> TestConnectionResult:
    """Test a not-yet-saved provider configuration (used by the add-provider
    form so users can validate Base URL / API key / model before saving).
    """
    if payload.provider_type not in ALLOWED_PROVIDER_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"provider_type must be one of {sorted(ALLOWED_PROVIDER_TYPES)}",
        )
    if not payload.model_name:
        return TestConnectionResult(
            success=False,
            message="Enter a model name first, or click Fetch models.",
            latency_ms=None,
        )
    client = OpenAICompatibleProvider(
        base_url=payload.base_url,
        api_key=payload.api_key,
        model_name=payload.model_name,
        provider_type=payload.provider_type,
    )
    success, message, latency_ms = client.test_connection()
    return TestConnectionResult(success=success, message=message, latency_ms=latency_ms)