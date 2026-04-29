"""PostgreSQL connection pool and query helpers using aws-psycopg2."""
from __future__ import annotations

import json
import logging
from contextlib import contextmanager
from typing import Any, Optional

import psycopg2
import psycopg2.extras
import psycopg2.pool

from .config import get_settings

log = logging.getLogger(__name__)

_pool: Optional[psycopg2.pool.ThreadedConnectionPool] = None


def get_pool() -> psycopg2.pool.ThreadedConnectionPool:
    global _pool
    if _pool is None:
        cfg = get_settings()
        _pool = psycopg2.pool.ThreadedConnectionPool(
            cfg.db_pool_min,
            cfg.db_pool_max,
            dsn=cfg.database_url,
            cursor_factory=psycopg2.extras.RealDictCursor,
        )
    return _pool


@contextmanager
def get_conn():
    pool = get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)


def _serialize(params):
    if params is None:
        return None
    return tuple(
        json.dumps(p) if isinstance(p, (dict, list)) else p
        for p in params
    )


def execute(sql: str, params=None) -> int:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(sql, _serialize(params))
        return cur.rowcount


def execute_returning(sql: str, params=None) -> Optional[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(sql, _serialize(params))
        row = cur.fetchone()
        return dict(row) if row else None


def fetchone(sql: str, params=None) -> Optional[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(sql, _serialize(params))
        row = cur.fetchone()
        return dict(row) if row else None


def fetchall(sql: str, params=None) -> list[dict]:
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(sql, _serialize(params))
        return [dict(r) for r in cur.fetchall()]


def call_fn(fn_name: str, *args) -> Any:
    """Call a PostgreSQL function that returns a single JSON value."""
    placeholders = ", ".join(["%s"] * len(args))
    sql = f"SELECT {fn_name}({placeholders})" if args else f"SELECT {fn_name}()"
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute(sql, _serialize(args) if args else None)
        row = cur.fetchone()
        if row is None:
            return None
        val = list(row.values())[0]
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
        cur.execute(sql, _serialize(args) if args else None)
        row = cur.fetchone()
        if row is None:
            return None
        return list(row.values())[0]


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
