from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas.auth import UserRegister, UserLogin, UserOut, Token
from app.services import auth_service
from app.deps import get_current_user
from app.models.user import User

# Router layer = ONLY handles HTTP concerns (paths, status codes, request/response shapes).
# It should never contain business logic — it just calls the service.
router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    # payload is auto-validated against UserRegister schema before this even runs
    user = auth_service.register_user(db, payload.email, payload.password)
    return user  # FastAPI converts this User ORM object into UserOut JSON automatically


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    token = auth_service.authenticate_user(db, payload.email, payload.password)
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    # This route is PROTECTED — get_current_user runs first and blocks
    # the request entirely if the JWT is missing/invalid.
    return current_user

# Note on logout: JWTs are stateless — there's nothing stored server-side
# to "cancel". Logout = frontend just deletes the token it's holding.