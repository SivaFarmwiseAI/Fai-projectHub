"""Standup Lambda handler — /api/standup/*"""
from datetime import date

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user
from ..database import execute_returning, fetchall
from ..models.requests import CreateStandupRequest


def _today_standup(event, origin):
    get_current_user(event)
    target_str = get_query(event).get("date")
    target = date.fromisoformat(target_str) if target_str else date.today()
    entries = fetchall("""
        SELECT se.*, u.name, u.department, u.avatar_color
        FROM standup_entries se
        JOIN users u ON u.id = se.user_id
        WHERE se.date = %s
        ORDER BY u.name
    """, (target,))
    return resp({"date": str(target), "entries": entries}, origin=origin)


def _submit_standup(event, origin):
    current_user = get_current_user(event)
    body = CreateStandupRequest(**get_body(event))
    entry = execute_returning("""
        INSERT INTO standup_entries (user_id, yesterday, today, blockers, mood)
        VALUES (%s,%s,%s,%s,%s)
        ON CONFLICT (user_id, date) DO UPDATE
          SET yesterday = EXCLUDED.yesterday,
              today     = EXCLUDED.today,
              blockers  = EXCLUDED.blockers,
              mood      = EXCLUDED.mood
        RETURNING *
    """, (current_user["id"], body.yesterday, body.today, body.blockers, body.mood))
    return resp({"entry": entry}, 201, origin)


def _standup_history(event, origin, user_id):
    get_current_user(event)
    days = int(get_query(event).get("days", 14))
    days = max(1, min(days, 90))
    entries = fetchall("""
        SELECT se.*, u.name
        FROM standup_entries se
        JOIN users u ON u.id = se.user_id
        WHERE se.user_id = %s AND se.date >= CURRENT_DATE - INTERVAL '1 day' * %s
        ORDER BY se.date DESC
    """, (user_id, days))
    return resp({"entries": entries}, origin=origin)


# /history/<user_id> BEFORE base routes so it's not ambiguous
handler = make_handler([
    ("GET",  r"/api/standup",                                        _today_standup),
    ("POST", r"/api/standup",                                        _submit_standup),
    ("GET",  rf"/api/standup/history/(?P<user_id>{PARAM})",          _standup_history),
])
