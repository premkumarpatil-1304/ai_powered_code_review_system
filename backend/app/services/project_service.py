import shutil
import uuid
from pathlib import Path

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.repositories import project_repo
from app.config import get_settings
from app.models.project import Project

settings = get_settings()


def create_project(db: Session, user_id: uuid.UUID, name: str, description: str | None) -> Project:
    # No special business rule here beyond delegating to the repo —
    # kept as a service function anyway so routers never call repos directly,
    # keeping the layering consistent even for simple cases.
    return project_repo.create(db, user_id=user_id, name=name, description=description)


def list_projects(db: Session, user_id: uuid.UUID) -> list[Project]:
    return project_repo.list_for_user(db, user_id)


def get_project_or_404(db: Session, user_id: uuid.UUID, project_id: uuid.UUID) -> Project:
    # Centralized ownership + existence check, reused by every endpoint
    # that operates on a specific project (upload, files, reviews, chat...).
    project = project_repo.get_for_user(db, user_id, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )
    return project


def delete_project(db: Session, user_id: uuid.UUID, project_id: uuid.UUID) -> None:
    project = get_project_or_404(db, user_id, project_id)

    # Delete the on-disk storage folder for this project BEFORE removing
    # the DB row, so we don't leave orphaned files on disk if something
    # fails after the DB delete.
    project_storage_root = Path(settings.storage_root) / str(project.id)
    if project_storage_root.exists():
        shutil.rmtree(project_storage_root, ignore_errors=True)

    project_repo.delete(db, project)
    # DB-level cascade (defined on the Project model's relationships)
    # takes care of deleting associated files/reviews/chat_sessions rows.