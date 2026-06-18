"""Meetings handler — /api/meetings/*

First-class scheduled events (project or general). On create, a pending
schedule_request is also inserted so the CEO can accept/reschedule.
"""
from __future__ import annotations

import logging

from .base import PARAM, get_body, get_query, make_handler, resp
from ._approval import auto_request
from ..auth import get_current_user
from ..database import execute, execute_returning, fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import CreateMeetingRequest, UpdateMeetingRequest

log = logging.getLogger(__name__)


def _row_with_attendees(meeting_id: str) -> dict | None:
    row = fetchone(
        """
        SELECT m.*,
               cb.name AS created_by_name,
               cb.avatar_color AS created_by_color,
               p.title AS project_title
        FROM meetings m
        JOIN users cb     ON cb.id = m.created_by
        LEFT JOIN projects p ON p.id = m.project_id
        WHERE m.id = %s
        """,
        (meeting_id,),
    )
    if not row:
        return None
    attendees = fetchall(
        """
        SELECT u.id, u.name, u.avatar_color
        FROM meeting_attendees ma
        JOIN users u ON u.id = ma.user_id
        WHERE ma.meeting_id = %s
        ORDER BY u.name
        """,
        (meeting_id,),
    )
    row["attendees"] = attendees
    return row


def _list_meetings(event, origin):
    current_user = get_current_user(event)
    p = get_query(event)
    conds = ["1=1"]
    params: list = []

    if p.get("project_id"):
        conds.append("m.project_id = %s")
        params.append(p["project_id"])
    if p.get("scope") == "general":
        conds.append("m.project_id IS NULL")
    elif p.get("scope") == "project":
        conds.append("m.project_id IS NOT NULL")
    if p.get("status"):
        conds.append("m.status = %s")
        params.append(p["status"])

    # Members see meetings they created or were invited to.
    if current_user["role_type"] not in ("CEO", "Admin"):
        conds.append(
            "(m.created_by = %s OR EXISTS "
            " (SELECT 1 FROM meeting_attendees ma "
            "  WHERE ma.meeting_id = m.id AND ma.user_id = %s))"
        )
        params.extend([current_user["id"], current_user["id"]])

    rows = fetchall(
        f"""
        SELECT m.*,
               cb.name AS created_by_name,
               cb.avatar_color AS created_by_color,
               p.title AS project_title,
               (
                 SELECT status FROM schedule_requests sr
                 WHERE sr.entity_type = 'meeting' AND sr.entity_id = m.id
                 LIMIT 1
               ) AS approval_status,
               (
                 SELECT rescheduled_to FROM schedule_requests sr
                 WHERE sr.entity_type = 'meeting' AND sr.entity_id = m.id
                 LIMIT 1
               ) AS rescheduled_to,
               (
                 SELECT ceo_note FROM schedule_requests sr
                 WHERE sr.entity_type = 'meeting' AND sr.entity_id = m.id
                 LIMIT 1
               ) AS ceo_note
        FROM meetings m
        JOIN users cb        ON cb.id = m.created_by
        LEFT JOIN projects p ON p.id = m.project_id
        WHERE {" AND ".join(conds)}
        ORDER BY m.scheduled_at ASC
        """,
        tuple(params),
    )

    # Attach attendees in a single second query, then group by meeting_id.
    if rows:
        ids = tuple(r["id"] for r in rows)
        placeholders = ", ".join(["%s"] * len(ids))
        attendee_rows = fetchall(
            f"""
            SELECT ma.meeting_id, u.id, u.name, u.avatar_color
            FROM meeting_attendees ma
            JOIN users u ON u.id = ma.user_id
            WHERE ma.meeting_id IN ({placeholders})
            ORDER BY u.name
            """,
            ids,
        )
        grouped: dict[str, list] = {}
        for a in attendee_rows:
            grouped.setdefault(str(a.pop("meeting_id")), []).append(a)
        for r in rows:
            r["attendees"] = grouped.get(str(r["id"]), [])
    return resp({"meetings": rows}, origin=origin)


def _create_meeting(event, origin):
    current_user = get_current_user(event)
    body = CreateMeetingRequest(**get_body(event))

    if body.duration_minutes <= 0:
        raise HTTPError(400, "duration_minutes must be > 0")

    created = execute_returning(
        """
        INSERT INTO meetings
          (title, agenda, scheduled_at, duration_minutes, location, project_id, created_by)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (
            body.title,
            body.agenda,
            body.scheduled_at,
            body.duration_minutes,
            body.location,
            str(body.project_id) if body.project_id else None,
            str(current_user["id"]),
        ),
    )
    if not created:
        raise HTTPError(500, "Meeting creation failed")

    meeting_id = str(created["id"])
    for uid in body.attendee_ids:
        execute(
            "INSERT INTO meeting_attendees (meeting_id, user_id) VALUES (%s, %s) "
            "ON CONFLICT DO NOTHING",
            (meeting_id, str(uid)),
        )

    # Raise to CEO inbox
    auto_request(
        entity_type="meeting",
        entity_id=meeting_id,
        requested_by=str(current_user["id"]),
        title=body.title,
        description=body.agenda,
        proposed_at=body.scheduled_at,
        project_id=str(body.project_id) if body.project_id else None,
    )

    return resp({"meeting": _row_with_attendees(meeting_id)}, 201, origin)


def _get_meeting(event, origin, meeting_id):
    get_current_user(event)
    row = _row_with_attendees(meeting_id)
    if not row:
        raise HTTPError(404, "Meeting not found")
    return resp({"meeting": row}, origin=origin)


def _update_meeting(event, origin, meeting_id):
    current_user = get_current_user(event)
    existing = fetchone("SELECT created_by FROM meetings WHERE id = %s", (meeting_id,))
    if not existing:
        raise HTTPError(404, "Meeting not found")
    is_owner = str(existing["created_by"]) == str(current_user["id"])
    is_admin = current_user["role_type"] in ("CEO", "Admin")
    if not (is_owner or is_admin):
        raise HTTPError(403, "You can only edit meetings you created")

    body = UpdateMeetingRequest(**get_body(event))
    raw = body.model_dump(exclude_unset=True)
    attendee_ids = raw.pop("attendee_ids", None)
    if not raw and attendee_ids is None:
        raise HTTPError(400, "No fields to update")

    fields: dict = {}
    for key, value in raw.items():
        if key == "project_id" and value is not None:
            fields[key] = str(value)
        else:
            fields[key] = value

    rescheduled = "scheduled_at" in fields  # If the time changed, re-raise.

    if fields:
        set_clause = ", ".join(f"{k} = %s" for k in fields)
        params = list(fields.values()) + [meeting_id]
        execute(f"UPDATE meetings SET {set_clause} WHERE id = %s", params)

    if attendee_ids is not None:
        execute("DELETE FROM meeting_attendees WHERE meeting_id = %s", (meeting_id,))
        for uid in attendee_ids:
            execute(
                "INSERT INTO meeting_attendees (meeting_id, user_id) VALUES (%s, %s) "
                "ON CONFLICT DO NOTHING",
                (meeting_id, str(uid)),
            )

    # If the requester (not the CEO) changed the time, re-raise for approval.
    if rescheduled and not is_admin:
        execute(
            """
            UPDATE schedule_requests
               SET status         = 'pending',
                   proposed_at    = %s,
                   rescheduled_to = NULL,
                   decided_by     = NULL,
                   decided_at     = NULL,
                   updated_at     = NOW()
             WHERE entity_type = 'meeting' AND entity_id = %s
            """,
            (fields["scheduled_at"], meeting_id),
        )

    return resp({"meeting": _row_with_attendees(meeting_id)}, origin=origin)


def _delete_meeting(event, origin, meeting_id):
    current_user = get_current_user(event)
    existing = fetchone("SELECT created_by FROM meetings WHERE id = %s", (meeting_id,))
    if not existing:
        raise HTTPError(404, "Meeting not found")
    is_owner = str(existing["created_by"]) == str(current_user["id"])
    is_admin = current_user["role_type"] in ("CEO", "Admin")
    if not (is_owner or is_admin):
        raise HTTPError(403, "You can only delete meetings you created")
    execute(
        "DELETE FROM schedule_requests WHERE entity_type = 'meeting' AND entity_id = %s",
        (meeting_id,),
    )
    execute("DELETE FROM meetings WHERE id = %s", (meeting_id,))
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


handler = make_handler([
    ("GET",    r"/api/meetings",                              _list_meetings),
    ("POST",   r"/api/meetings",                              _create_meeting),
    ("GET",    rf"/api/meetings/(?P<meeting_id>{PARAM})",     _get_meeting),
    ("PATCH",  rf"/api/meetings/(?P<meeting_id>{PARAM})",     _update_meeting),
    ("DELETE", rf"/api/meetings/(?P<meeting_id>{PARAM})",     _delete_meeting),
])
