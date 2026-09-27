from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.reviews import ReviewTemplateOut
from app.services import review_service

router = APIRouter(prefix="/api/review-templates", tags=["review-templates"])


@router.get("", response_model=list[ReviewTemplateOut])
def list_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),  # still requires login, just not project-scoped
):
    return review_service.get_templates(db)