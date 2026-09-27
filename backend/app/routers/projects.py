import uuid
from fastapi import APIRouter, Depends, UploadFile, File as FastAPIFile, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectOut, UploadResult
from app.services import project_service, upload_service

router = APIRouter(prefix="/api/projects", tags=["projects"])


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # protected: must be logged in
):
    return project_service.create_project(
        db, user_id=current_user.id, name=payload.name, description=payload.description
    )


@router.get("", response_model=list[ProjectOut])
def list_projects(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Only returns the current user's own projects (enforced in the repo query)
    return project_service.list_projects(db, user_id=current_user.id)


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return project_service.get_project_or_404(db, current_user.id, project_id)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    project_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project_service.delete_project(db, current_user.id, project_id)
    return None  # 204 No Content — nothing to return on success


@router.post("/{project_id}/upload", response_model=UploadResult)
async def upload_zip(
    project_id: uuid.UUID,
    file: UploadFile = FastAPIFile(...),  # multipart/form-data file upload
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # First confirm the project exists AND belongs to this user —
    # prevents uploading into someone else's project by guessing an ID.
    project = project_service.get_project_or_404(db, current_user.id, project_id)

    if not file.filename.lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .zip files are accepted.",
        )

    zip_bytes = await file.read()  # read the whole upload into memory (capped at 100MB in upload_service)

    file_count, ignored_count = upload_service.extract_and_store_zip(
        db, project_id=project.id, zip_bytes=zip_bytes
    )

    return UploadResult(file_count=file_count, ignored_count=ignored_count)