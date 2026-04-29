"""Discussions Lambda handler — /api/discussions/*"""
import logging

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user
from ..database import execute, execute_returning, fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import CreateDiscussionMessageRequest, CreateDiscussionRequest

log = logging.getLogger(__name__)


def _list_discussions(event, origin):
    get_current_user(event)
    p = get_query(event)
    conds = ["1=1"]
    params: list = []
    if p.get("project_id"): conds.append("d.project_id = %s"); params.append(p["project_id"])
    if p.get("phase_id"):   conds.append("d.phase_id = %s");   params.append(p["phase_id"])
    if p.get("is_resolved") is not None:
        conds.append("d.is_resolved = %s")
        params.append(p["is_resolved"].lower() == "true")
    rows = fetchall(f"""
        SELECT
          d.*, u.name AS author_name, u.avatar_color,
          (SELECT COUNT(*) FROM discussion_messages dm WHERE dm.discussion_id = d.id) AS message_count,
          pr.title AS project_title
        FROM discussions d
        JOIN users u ON u.id = d.author_id
        LEFT JOIN projects pr ON pr.id = d.project_id
        WHERE {" AND ".join(conds)}
        ORDER BY d.updated_at DESC
    """, tuple(params))
    return resp({"discussions": rows}, origin=origin)


def _create_discussion(event, origin):
    current_user = get_current_user(event)
    body = CreateDiscussionRequest(**get_body(event))
    disc = execute_returning("""
        INSERT INTO discussions (project_id, phase_id, title, author_id)
        VALUES (%s,%s,%s,%s) RETURNING *
    """, (
        str(body.project_id) if body.project_id else None,
        str(body.phase_id)   if body.phase_id   else None,
        body.title, current_user["id"],
    ))
    return resp({"discussion": disc}, 201, origin)


def _get_discussion(event, origin, discussion_id):
    get_current_user(event)
    disc = fetchone("""
        SELECT d.*, u.name AS author_name, u.avatar_color, pr.title AS project_title
        FROM discussions d
        JOIN users u ON u.id = d.author_id
        LEFT JOIN projects pr ON pr.id = d.project_id
        WHERE d.id = %s
    """, (discussion_id,))
    if not disc:
        raise HTTPError(404, "Discussion not found")
    messages = fetchall("""
        SELECT dm.*,
          u.name AS author_name, u.avatar_color,
          (SELECT json_agg(r ORDER BY r.created_at)
           FROM discussion_messages r
           JOIN users ru ON ru.id = r.author_id
           WHERE r.parent_id = dm.id
          ) AS replies
        FROM discussion_messages dm
        JOIN users u ON u.id = dm.author_id
        WHERE dm.discussion_id = %s AND dm.parent_id IS NULL
        ORDER BY dm.created_at
    """, (discussion_id,))
    disc["messages"] = messages
    return resp({"discussion": disc}, origin=origin)


def _add_message(event, origin, discussion_id):
    current_user = get_current_user(event)
    body = CreateDiscussionMessageRequest(**get_body(event))
    msg = execute_returning("""
        INSERT INTO discussion_messages (discussion_id, author_id, content, parent_id)
        VALUES (%s,%s,%s,%s) RETURNING *
    """, (
        discussion_id, current_user["id"], body.content,
        str(body.parent_id) if body.parent_id else None,
    ))
    execute("UPDATE discussions SET updated_at = NOW() WHERE id = %s", (discussion_id,))
    return resp({"message": msg}, 201, origin)


def _resolve_discussion(event, origin, discussion_id):
    get_current_user(event)
    updated = execute_returning(
        "UPDATE discussions SET is_resolved = TRUE, updated_at = NOW() WHERE id = %s RETURNING *",
        (discussion_id,)
    )
    if not updated:
        raise HTTPError(404, "Discussion not found")
    return resp({"discussion": updated}, origin=origin)


# Sub-resource routes BEFORE dynamic /<discussion_id>
handler = make_handler([
    ("GET",   r"/api/discussions",                                               _list_discussions),
    ("POST",  r"/api/discussions",                                               _create_discussion),
    ("POST",  rf"/api/discussions/(?P<discussion_id>{PARAM})/messages",          _add_message),
    ("PATCH", rf"/api/discussions/(?P<discussion_id>{PARAM})/resolve",           _resolve_discussion),
    ("GET",   rf"/api/discussions/(?P<discussion_id>{PARAM})",                   _get_discussion),
])
