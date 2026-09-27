from datetime import datetime, timedelta, timezone
from passlib.context import CryptContext
from jose import jwt, JWTError
from cryptography.fernet import Fernet
import base64
import hashlib

from app.config import get_settings

settings = get_settings()

# bcrypt = the hashing algorithm for storing passwords safely (never store plain text passwords)
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# ---------- Passwords ----------

def hash_password(password: str) -> str:
    # Turns "mypassword123" into an irreversible bcrypt hash before saving to DB
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    # Compares a login attempt's password against the stored hash
    return pwd_context.verify(plain_password, hashed_password)


# ---------- JWT ----------

def create_access_token(subject: str) -> str:
    # "subject" = the user's id. We embed it inside the token so later
    # requests can prove "I am user X" just by presenting this token.
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": subject, "exp": expire}  # "sub"=subject(user id), "exp"=expiry time
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def decode_access_token(token: str) -> str | None:
    # Verifies the token's signature + expiry, then extracts the user id.
    # Returns None if the token is invalid/expired/tampered with.
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
        return payload.get("sub")
    except JWTError:
        return None


# ---------- Symmetric encryption for AI provider API keys (used from Phase 4 onward) ----------
# We only have ONE secret (SECRET_KEY) in .env. Fernet needs a specific
# 32-byte base64 key format, so we hash SECRET_KEY into that shape instead
# of asking you to manage a second secret.

def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.secret_key.encode()).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt_value(value: str) -> str:
    # Encrypts a user's AI provider API key before storing it in the DB
    return _fernet().encrypt(value.encode()).decode()


def decrypt_value(token: str) -> str:
    # Decrypts it back only when we need to actually call the AI provider
    return _fernet().decrypt(token.encode()).decode()