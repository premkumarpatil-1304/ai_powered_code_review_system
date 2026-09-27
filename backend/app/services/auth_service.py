from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.repositories import user_repo
from app.security import hash_password, verify_password, create_access_token
from app.models.user import User

# Service layer = business logic + rules. This is the "brain" — it decides
# WHAT should happen (reject duplicate emails, check passwords, issue tokens).
# Routers call services; services call repositories. Routers never touch
# repositories or security.py directly — this keeps each layer replaceable.


def register_user(db: Session, email: str, password: str) -> User:
    if user_repo.get_by_email(db, email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )
    password_hash = hash_password(password)
    return user_repo.create(db, email=email, password_hash=password_hash)


def authenticate_user(db: Session, email: str, password: str) -> str:
    user = user_repo.get_by_email(db, email)
    if not user or not verify_password(password, user.password_hash):
        # Deliberately vague error — don't reveal whether it was the email or password that was wrong
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password.",
        )
    # login successful → issue a JWT containing the user's id
    return create_access_token(subject=str(user.id))