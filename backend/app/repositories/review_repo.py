
import uuid
from sqlalchemy.orm import Session
from app.models.review import Review


def create(db: Session, review: Review) -> Review:
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


def update(db: Session, review: Review) -> Review:
    db.commit()
    db.refresh(review)
    return review


def list_for_project(
    db: Session,
    project_id: uuid.UUID,
    status_filter: str | None = None,
    template_slug: str | None = None,
    search_query: str | None = None,
) -> list[Review]:
    from app.models.review_template import ReviewTemplate  # local import avoids circular import

    query = db.query(Review).filter(Review.project_id == project_id)

    if status_filter:
        query = query.filter(Review.status == status_filter)

    if template_slug:
        query = query.join(ReviewTemplate, Review.template_id == ReviewTemplate.id).filter(
            ReviewTemplate.slug == template_slug
        )

    if search_query:
        # Simple search/filter over the summary text — good enough for
        # the MVP's "search/filter reviews" requirement without adding
        # a full-text search engine.
        query = query.filter(Review.summary.ilike(f"%{search_query}%"))

    return query.order_by(Review.created_at.desc()).all()


def get_by_id_for_project_owner(db: Session, user_id: uuid.UUID, review_id: uuid.UUID) -> Review | None:
    from app.models.project import Project  # local import avoids circular import

    return (
        db.query(Review)
        .join(Project, Review.project_id == Project.id)
        .filter(Review.id == review_id, Project.user_id == user_id)
        .first()
    )