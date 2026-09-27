from sqlalchemy.orm import Session
from app.models.review_template import ReviewTemplate


def list_all(db: Session) -> list[ReviewTemplate]:
    return db.query(ReviewTemplate).order_by(ReviewTemplate.name).all()


def get_by_slug(db: Session, slug: str) -> ReviewTemplate | None:
    return db.query(ReviewTemplate).filter(ReviewTemplate.slug == slug).first()