import uuid
from sqlalchemy.orm import Session
from app.models.ai_provider import AIProvider


def create(db: Session, provider: AIProvider) -> AIProvider:
    db.add(provider)
    db.commit()
    db.refresh(provider)
    return provider


def list_for_user(db: Session, user_id: uuid.UUID) -> list[AIProvider]:
    return (
        db.query(AIProvider)
        .filter(AIProvider.user_id == user_id)
        .order_by(AIProvider.created_at.desc())
        .all()
    )


def get_for_user(db: Session, user_id: uuid.UUID, provider_id: uuid.UUID) -> AIProvider | None:
    return (
        db.query(AIProvider)
        .filter(AIProvider.id == provider_id, AIProvider.user_id == user_id)
        .first()
    )


def get_default_for_user(db: Session, user_id: uuid.UUID) -> AIProvider | None:
    return (
        db.query(AIProvider)
        .filter(AIProvider.user_id == user_id, AIProvider.is_default == True)  # noqa: E712
        .first()
    )


def unset_all_defaults(db: Session, user_id: uuid.UUID) -> None:
    # Called before setting a new default, so only ONE provider per user
    # ever has is_default=True at a time.
    db.query(AIProvider).filter(AIProvider.user_id == user_id).update(
        {"is_default": False}
    )
    db.commit()


def delete(db: Session, provider: AIProvider) -> None:
    db.delete(provider)
    db.commit()