import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.file import FileNode, FilePreview
from app.services import file_service, project_service

router = APIRouter(prefix="/api", tags=["files"])


@router.get("/projects/{project_id}/files", response_model=list[FileNode])
def get_project_file_tree(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ownership check first — reuses the same helper from Phase 2's
    # project_service, so a user can't fetch another user's file tree
    # just by guessing a project_id.
    project = project_service.get_project_or_404(db, current_user.id, project_id)
    return file_service.build_file_tree(db, project.id)


@router.get("/files/{file_id}", response_model=FilePreview)
def preview_file(
    file_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Ownership is checked INSIDE get_file_preview via
    # file_repo.get_by_id_for_user (joins through Project.user_id),
    # so there's no separate project lookup needed here.
    return file_service.get_file_preview(db, current_user.id, file_id)