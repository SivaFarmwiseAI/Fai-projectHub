"""PostgreSQL connection helpers using pg8000 (pure-Python, no compilation required)."""
from __future__ import annotations

import json
import logging
import uuid
from contextlib import contextmanager
from datetime import date, datetime
from decimal import Decimal
from typing import Any, Optional
from urllib.parse import urlparse, unquote

import pg8000.dbapi

from .config import get_settings

log = logging.getLogger(__name__)


def _parse_dsn(url: str) -> dict:
    r = urlparse(url)
    return dict(
        host=r.hostname,
        port=r.port or 5432,
        user=unquote(r.username or ""),
        password=unquote(r.password or ""),
        database=r.path.lstrip("/"),
    )


def _coerce(val: Any) -> Any:
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, (datetime, date)):
        return val.isoformat()
    if isinstance(val, Decimal):
        return float(val)
    return val


def _to_dict(cursor, row) -> Optional[dict]:
    if row is None:
        return None
    return {desc[0]: _coerce(val) for desc, val in zip(cursor.description, row)}


@contextmanager
def get_conn():
    cfg = get_settings()
    conn = pg8000.dbapi.connect(**_parse_dsn(cfg.database_url))
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _serialize(params):
    return tuple(
        json.dumps(p) if isinstance(p, (dict, list)) else p
        for p in params
    )


def _exec(cur, sql: str, params=None) -> None:
    """Execute SQL, omitting params entirely when None so pg8000 doesn't crash on len(None)."""
    if params is not None:
        cur.execute(sql, _serialize(params))
    else:
        cur.execute(sql)


def execute(sql: str, params=None) -> int:
    with get_conn() as conn:
        cur = conn.cursor()
        _exec(cur, sql, params)
        return cur.rowcount


def execute_returning(sql: str, params=None) -> Optional[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        _exec(cur, sql, params)
        return _to_dict(cur, cur.fetchone())


def fetchone(sql: str, params=None) -> Optional[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        _exec(cur, sql, params)
        return _to_dict(cur, cur.fetchone())


def fetchall(sql: str, params=None) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        _exec(cur, sql, params)
        return [_to_dict(cur, r) for r in cur.fetchall()]


def call_fn(fn_name: str, *args) -> Any:
    """Call a PostgreSQL function that returns a single JSON value."""
    placeholders = ", ".join(["%s"] * len(args))
    sql = f"SELECT {fn_name}({placeholders})" if args else f"SELECT {fn_name}()"
    with get_conn() as conn:
        cur = conn.cursor()
        _exec(cur, sql, args if args else None)
        row = cur.fetchone()
        if row is None:
            return None
        val = row[0]
        if isinstance(val, str):
            try:
                return json.loads(val)
            except (json.JSONDecodeError, TypeError):
                return val
        return val


def call_proc(fn_name: str, *args) -> Any:
    """Call a PostgreSQL function that returns a scalar (e.g. UUID)."""
    placeholders = ", ".join(["%s"] * len(args))
    sql = f"SELECT {fn_name}({placeholders})" if args else f"SELECT {fn_name}()"
    with get_conn() as conn:
        cur = conn.cursor()
        _exec(cur, sql, args if args else None)
        row = cur.fetchone()
        if row is None:
            return None
        return _coerce(row[0])


def refresh_views() -> dict:
    """Refresh all materialised views."""
    views = [
        "mv_project_summary",
        "mv_team_stats",
        "mv_phase_progress",
        "mv_task_metrics",
    ]
    refreshed = []
    with get_conn() as conn:
        cur = conn.cursor()
        for view in views:
            try:
                cur.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {view}")
                refreshed.append(view)
            except Exception as exc:
                log.warning("Could not refresh %s: %s", view, exc)
    return {"refreshed": refreshed}
