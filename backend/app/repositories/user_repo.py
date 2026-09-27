from sqlalchemy.orm import Session
from app.models.user import User

# Repository layer = ONLY database queries. No business logic, no password
# hashing, no HTTP errors here. This makes it easy to test and reuse.


def get_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_by_id(db: Session, user_id) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def create(db: Session, email: str, password_hash: str) -> User:
    user = User(email=email, password_hash=password_hash)
    db.add(user)      # stage the insert
    db.commit()        # actually write it to Postgres
    db.refresh(user)   # reload the object so it has DB-generated fields (id, created_at)
    return user