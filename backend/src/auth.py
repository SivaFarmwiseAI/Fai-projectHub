"""JWT authentication and password utilities."""
from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import get_settings
from .exceptions import HTTPError

log = logging.getLogger(__name__)

COOKIE_NAME = "projecthub_token"
ALGORITHM = "HS256"

_pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# In-memory session store (per Lambda container). Good enough for serverless;
# sessions are validated against JWT signature + expiry as primary check.
_sessions: dict[str, set[str]] = {}


def hash_password(plain: str) -> str:
    return _pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_ctx.verify(plain, hashed)


def create_access_token(user_id: str, role_type: str) -> str:
    cfg = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": user_id,
        "role_type": role_type,
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + timedelta(minutes=cfg.jwt_access_expire_minutes),
    }
    return jwt.encode(payload, cfg.jwt_secret, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    cfg = get_settings()
    try:
        return jwt.decode(token, cfg.jwt_secret, algorithms=[ALGORITHM])
    except JWTError as exc:
        raise HTTPError(401, f"Invalid token: {exc}") from exc


def store_session(user_id: str, jti: str) -> None:
    _sessions.setdefault(user_id, set()).add(jti)


def _extract_token(event: dict) -> Optional[str]:
    headers = event.get("headers") or {}
    # 1. Cookie
    cookie_hdr = headers.get("cookie") or headers.get("Cookie") or ""
    for part in cookie_hdr.split(";"):
        part = part.strip()
        if part.startswith(f"{COOKIE_NAME}="):
            return part[len(COOKIE_NAME) + 1:]
    # 2. Authorization: Bearer <token>
    auth = headers.get("Authorization") or headers.get("authorization") or ""
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def get_current_user(event: dict) -> dict:
    token = _extract_token(event)
    if not token:
        raise HTTPError(401, "Authentication required")
    payload = decode_token(token)
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPError(401, "Invalid token payload")

    from .database import fetchone
    user = fetchone(
        "SELECT id, name, email, role, role_type, department, avatar_color "
        "FROM users WHERE id = %s AND is_active",
        (user_id,),
    )
    if not user:
        raise HTTPError(401, "User not found or inactive")
    return user


def require_auth(event: dict, *allowed_roles: str) -> dict:
    user = get_current_user(event)
    if allowed_roles and user["role_type"] not in allowed_roles:
        raise HTTPError(403, "Insufficient permissions")
    return user
