import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.provider import ProviderCreate, ProviderUpdate, ProviderOut, TestConnectionResult
from app.services import provider_service

router = APIRouter(prefix="/api/providers", tags=["providers"])


def _to_out(provider) -> ProviderOut:
    # Manual mapping instead of relying purely on from_attributes, because
    # has_api_key is a DERIVED field that doesn't exist on the DB model directly.
    return ProviderOut(
        id=provider.id,
        name=provider.name,
        provider_type=provider.provider_type,
        base_url=provider.base_url,
        model_name=provider.model_name,
        is_default=provider.is_default,
        has_api_key=bool(provider.api_key_encrypted),
        created_at=provider.created_at,
    )


@router.post("", response_model=ProviderOut, status_code=201)
def create_provider(
    payload: ProviderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider = provider_service.create_provider(db, current_user.id, payload)
    return _to_out(provider)


@router.get("", response_model=list[ProviderOut])
def list_providers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    providers = provider_service.list_providers(db, current_user.id)
    return [_to_out(p) for p in providers]


@router.put("/{provider_id}", response_model=ProviderOut)
def update_provider(
    provider_id: uuid.UUID,
    payload: ProviderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider = provider_service.update_provider(db, current_user.id, provider_id, payload)
    return _to_out(provider)


@router.delete("/{provider_id}", status_code=204)
def delete_provider(
    provider_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    provider_service.delete_provider(db, current_user.id, provider_id)
    return None


@router.post("/{provider_id}/test", response_model=TestConnectionResult)
def test_provider(
    provider_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return provider_service.test_provider_connection(db, current_user.id, provider_id)


@router.get("/{provider_id}/models")
def list_provider_models(
    provider_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    models = provider_service.list_provider_models(db, current_user.id, provider_id)
    return {"models": models}


@router.post("/test-preview", response_model=TestConnectionResult)
def test_provider_preview(
    payload: ProviderCreate,
    _: User = Depends(get_current_user),
):
    """Test a provider configuration WITHOUT saving it to the database.

    Used by the "Add provider" form so users can validate Base URL / API key
    / model before clicking Save. No provider row is created.
    """
    return provider_service.test_provider_preview(payload)


@router.post("/models-preview")
def list_models_preview(
    payload: ProviderCreate,
    _: User = Depends(get_current_user),
):
    """Fetch available models for a NOT-YET-SAVED provider configuration.

    Mirrors ``GET /{provider_id}/models`` but takes an unsaved form payload so
    the add-provider form can call it before a provider_id exists.
    """
    models = provider_service.list_models_for_preview(payload)
    return {"models": models}