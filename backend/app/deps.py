import uuid
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials  # CHANGED
from sqlalchemy.orm import Session

from app.database import get_db
from app.security import decode_access_token
from app.repositories import user_repo
from app.models.user import User

# CHANGED: HTTPBearer gives Swagger a simple "paste token" box instead of
# the full OAuth2 password-flow form (username/password/client_id/secret),
# which we don't actually use since /login takes plain JSON.
bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),  # CHANGED
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    token = credentials.credentials  # CHANGED: extract the raw token string from the Bearer header
    user_id = decode_access_token(token)
    if user_id is None:
        raise credentials_exception

    try:
        user = user_repo.get_by_id(db, uuid.UUID(user_id))
    except ValueError:
        raise credentials_exception

    if user is None:
        raise credentials_exception

    return user