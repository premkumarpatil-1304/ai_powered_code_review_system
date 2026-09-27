import uuid
from sqlalchemy.orm import Session
from app.models.project import Project

# Repository layer: ONLY database queries, no business rules, no HTTP errors.


def create(db: Session, user_id: uuid.UUID, name: str, description: str | None) -> Project:
    project = Project(user_id=user_id, name=name, description=description)
    db.add(project)
    db.commit()
    db.refresh(project)  # reload so we get the DB-generated id/created_at
    return project


def list_for_user(db: Session, user_id: uuid.UUID) -> list[Project]:
    # Only returns projects owned by this user — enforced here so no
    # caller can accidentally list someone else's projects.
    return (
        db.query(Project)
        .filter(Project.user_id == user_id)
        .order_by(Project.created_at.desc())
        .all()
    )


def get_for_user(db: Session, user_id: uuid.UUID, project_id: uuid.UUID) -> Project | None:
    # Ownership check baked directly into the query, not done after the fact.
    return (
        db.query(Project)
        .filter(Project.id == project_id, Project.user_id == user_id)
        .first()
    )


def delete(db: Session, project: Project) -> None:
    db.delete(project)
    db.commit()
    # Note: Project model has cascade="all, delete-orphan" on its
    # files/reviews/chat_sessions relationships, so deleting a project
    # also deletes its DB rows for files, reviews, and chat sessions.
    # It does NOT delete files from disk — that's handled separately
    # in the service layer (see project_service.delete_project below).