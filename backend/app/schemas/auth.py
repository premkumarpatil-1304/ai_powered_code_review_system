import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, Field

# Schemas = the shape of data going IN and OUT of the API (JSON).
# These are DIFFERENT from models/*.py (which describe DB tables).
# Why separate? So we can control exactly what a client sees/sends —
# e.g. UserOut never includes password_hash, even though the User model has it.


class UserRegister(BaseModel):
    # Expected JSON body for POST /api/auth/register
    email: EmailStr                      # validates it's a real email format
    password: str = Field(min_length=8)  # basic password length rule


class UserLogin(BaseModel):
    # Expected JSON body for POST /api/auth/login
    email: EmailStr
    password: str


class UserOut(BaseModel):
    # What we send BACK to the client — notice: no password_hash field at all
    model_config = ConfigDict(from_attributes=True)  # allows converting a SQLAlchemy User object directly into this schema

    id: uuid.UUID
    email: EmailStr
    created_at: datetime


class Token(BaseModel):
    # Response shape for a successful login
    access_token: str
    token_type: str = "bearer"