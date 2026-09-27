import uuid
from sqlalchemy.orm import Session
from app.models.file import File


def bulk_create(db: Session, files: list[File]) -> None:
    # Used after ZIP extraction to insert many file/folder rows at once
    # instead of committing one-by-one (much faster for large projects).
    db.add_all(files)
    db.commit()


def list_for_project(db: Session, project_id: uuid.UUID) -> list[File]:
    return (
        db.query(File)
        .filter(File.project_id == project_id)
        .order_by(File.path)
        .all()
    )


def get_by_id(db: Session, file_id: uuid.UUID) -> File | None:
    return db.query(File).filter(File.id == file_id).first()


# NEW: needed so file preview can confirm the file belongs to a project
# the requesting user actually owns (via a join through Project).
def get_by_id_for_user(db: Session, user_id: uuid.UUID, file_id: uuid.UUID) -> File | None:
    from app.models.project import Project  # local import avoids circular import at module load time
    return (
        db.query(File)
        .join(Project, File.project_id == Project.id)
        .filter(File.id == file_id, Project.user_id == user_id)
        .first()
    )    