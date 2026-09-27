import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.reviews import ReviewCreate, ReviewOut
from app.services import review_service

router = APIRouter(prefix="/api", tags=["reviews"])


@router.post("/projects/{project_id}/reviews", response_model=ReviewOut)
def create_review(
    project_id: uuid.UUID,
    payload: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # NOTE: synchronous — this call blocks until the LLM responds.
    # Acceptable for the MVP scope; documented as a tradeoff (no
    # background job queue) in ARCHITECTURE.md.
    return review_service.create_review(db, current_user.id, project_id, payload)


@router.get("/projects/{project_id}/reviews", response_model=list[ReviewOut])
def list_reviews(
    project_id: uuid.UUID,
    status: str | None = Query(default=None),
    template: str | None = Query(default=None),
    q: str | None = Query(default=None, description="Search text within review summaries"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return review_service.list_reviews(db, current_user.id, project_id, status, template, q)


@router.get("/reviews/{review_id}", response_model=ReviewOut)
def get_review(
    review_id: uuid.UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return review_service.get_review_or_404(db, current_user.id, review_id)