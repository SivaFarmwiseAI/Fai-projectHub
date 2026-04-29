"""Auth Lambda handler — /api/auth/*"""
import logging

from .base import PARAM, err, get_body, get_query, make_handler, resp
from ..auth import (
    COOKIE_NAME,
    create_access_token,
    decode_token,
    get_current_user,
    hash_password,
    store_session,
    verify_password,
)
from ..config import get_settings
from ..database import execute, execute_returning, fetchone
from ..exceptions import HTTPError
from ..models.requests import CreateUserRequest, LoginRequest

log = logging.getLogger(__name__)
cfg = get_settings()


def _login(event, origin):
    data = LoginRequest(**get_body(event))
    user = fetchone(
        "SELECT id, name, email, password_hash, role, role_type, department, avatar_color "
        "FROM users WHERE email = %s AND is_active",
        (data.email,),
    )
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPError(401, "Invalid email or password")

    token = create_access_token(user["id"], user["role_type"])
    payload = decode_token(token)
    store_session(user["id"], payload["jti"])

    max_age = cfg.jwt_access_expire_minutes * 60
    secure = "Secure; " if cfg.environment == "production" else ""
    cookie = f"{COOKIE_NAME}={token}; HttpOnly; {secure}SameSite=Lax; Path=/; Max-Age={max_age}"

    return resp(
        {
            "user": {
                "id": user["id"], "name": user["name"], "email": user["email"],
                "role": user["role"], "role_type": user["role_type"],
                "department": user["department"], "avatar_color": user["avatar_color"],
            }
        },
        origin=origin,
        extra_headers={"Set-Cookie": cookie},
    )


def _me(event, origin):
    return resp({"user": get_current_user(event)}, origin=origin)


def _logout(event, origin):
    get_current_user(event)
    expired = f"{COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT"
    return resp({"ok": True}, origin=origin, extra_headers={"Set-Cookie": expired})


def _register(event, origin):
    get_current_user(event)
    data = CreateUserRequest(**get_body(event))
    if fetchone("SELECT id FROM users WHERE email = %s", (data.email,)):
        raise HTTPError(409, "Email already registered")
    user = execute_returning("""
        INSERT INTO users (name, email, password_hash, role, role_type, department, avatar_color)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id, name, email, role, role_type, department, avatar_color, created_at
    """, (data.name, data.email, hash_password(data.password),
          data.role, data.role_type, data.department, data.avatar_color))
    return resp({"user": user}, 201, origin)


def _change_password(event, origin):
    current_user = get_current_user(event)
    p = get_query(event)
    user = fetchone("SELECT password_hash FROM users WHERE id = %s", (current_user["id"],))
    if not verify_password(p.get("old_password", ""), user["password_hash"]):
        raise HTTPError(400, "Incorrect current password")
    execute(
        "UPDATE users SET password_hash = %s, updated_at = NOW() WHERE id = %s",
        (hash_password(p.get("new_password", "")), current_user["id"]),
    )
    return resp({"ok": True}, origin=origin)


handler = make_handler([
    ("POST", r"/api/auth/login",           _login),
    ("GET",  r"/api/auth/me",              _me),
    ("POST", r"/api/auth/logout",          _logout),
    ("POST", r"/api/auth/register",        _register),
    ("POST", r"/api/auth/change-password", _change_password),
])
