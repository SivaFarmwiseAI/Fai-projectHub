"""Shared Lambda handler utilities — response builders, route dispatcher, CORS."""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Callable, Dict, List, Optional, Tuple

from ..database import get_pool
from ..exceptions import HTTPError

log = logging.getLogger(__name__)

# Path parameter pattern — matches any single path segment
PARAM = r"[^/]+"

CORS_HEADERS = {
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization,Cookie,X-Request-ID",
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
}


# ── Response helpers ──────────────────────────────────────────────────────────

def get_origin(event: dict) -> str:
    h = event.get("headers") or {}
    return h.get("origin") or h.get("Origin") or "*"


def resp(
    body: Any,
    status: int = 200,
    origin: str = "*",
    extra_headers: Optional[Dict[str, str]] = None,
) -> dict:
    headers = {
        **CORS_HEADERS,
        "Access-Control-Allow-Origin": origin,
        "Content-Type": "application/json",
    }
    if extra_headers:
        headers.update(extra_headers)
    return {
        "statusCode": status,
        "headers": headers,
        "body": json.dumps(body, default=str),
    }


def err(status: int, message: str, origin: str = "*") -> dict:
    return resp({"detail": message}, status, origin)


# ── Request helpers ───────────────────────────────────────────────────────────

def get_body(event: dict) -> dict:
    raw = event.get("body") or ""
    if not raw:
        return {}
    try:
        return json.loads(raw) if isinstance(raw, str) else (raw or {})
    except (json.JSONDecodeError, TypeError):
        raise HTTPError(400, "Invalid JSON body")


def get_query(event: dict) -> dict:
    return event.get("queryStringParameters") or {}


# ── Route dispatcher ──────────────────────────────────────────────────────────

def make_handler(routes: List[Tuple[str, str, Callable]]):
    """
    Build a Lambda handler from a list of (HTTP_METHOD, regex_pattern, func) tuples.

    - Routes are matched in order; list specific/static paths before dynamic ones.
    - Named groups in patterns become kwargs: r'/api/users/(?P<user_id>[^/]+)'
    - func signature: func(event, origin, **path_kwargs) -> dict
    """
    compiled = [(method, re.compile(pattern), func) for method, pattern, func in routes]

    def handler(event: dict, context) -> dict:
        get_pool()  # warm DB pool on cold start

        origin = get_origin(event)

        if event.get("httpMethod") == "OPTIONS":
            return {
                "statusCode": 200,
                "headers": {**CORS_HEADERS, "Access-Control-Allow-Origin": origin},
                "body": "",
            }

        method = event.get("httpMethod", "")
        path   = event.get("path", "")

        try:
            for route_method, pattern, func in compiled:
                if method == route_method:
                    m = pattern.fullmatch(path)
                    if m:
                        return func(event, origin, **m.groupdict())
            return err(404, f"Not found: {method} {path}", origin)
        except HTTPError as e:
            return err(e.status_code, e.message, origin)
        except Exception as e:
            log.exception(f"Unhandled error on {method} {path}: {e}")
            return err(500, "Internal server error", origin)

    return handler
