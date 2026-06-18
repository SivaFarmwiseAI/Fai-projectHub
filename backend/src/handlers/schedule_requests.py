"""Schedule-requests handler — /api/schedule-requests/*

CEO inbox for approvals across meetings, reviews, commitments, discussions,
leaves, and follow-ups. Accept can optionally reschedule (and the new datetime
is pushed back down to the underlying entity).
"""
from __future__ import annotations

import logging

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user
from ..database import execute, execute_returning, fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import AcceptScheduleRequest, RejectScheduleRequest

log = logging.getLogger(__name__)


def _is_approver(user: dict) -> bool:
    return user.get("role_type") in ("CEO", "Admin")


# ── List ────────────────────────────────────────────────────────────────────
def _list_requests(event, origin):
    current_user = get_current_user(event)
    p = get_query(event)

    conds = ["1=1"]
    params: list = []
    if p.get("status"):
        conds.append("r.status = %s")
        params.append(p["status"])
    if p.get("entity_type"):
        conds.append("r.entity_type = %s")
        params.append(p["entity_type"])

    # Non-approvers only see their own requests
    if not _is_approver(current_user):
        conds.append("r.requested_by = %s")
        params.append(current_user["id"])

    rows = fetchall(
        f"""
        SELECT
          r.*,
          u.name AS requested_by_name,
          u.avatar_color AS requested_by_color,
          d.name AS decided_by_name,
          p.title AS project_title
        FROM schedule_requests r
        JOIN users u   ON u.id = r.requested_by
        LEFT JOIN users d ON d.id = r.decided_by
        LEFT JOIN projects p ON p.id = r.project_id
        WHERE {" AND ".join(conds)}
        ORDER BY
          CASE r.status WHEN 'pending' THEN 0 WHEN 'accepted' THEN 1 ELSE 2 END,
          r.created_at DESC
        """,
        tuple(params),
    )
    return resp({"requests": rows}, origin=origin)


# ── Get one ─────────────────────────────────────────────────────────────────
def _get_request(event, origin, request_id):
    current_user = get_current_user(event)
    row = fetchone(
        """
        SELECT
          r.*,
          u.name AS requested_by_name,
          u.avatar_color AS requested_by_color,
          d.name AS decided_by_name,
          p.title AS project_title
        FROM schedule_requests r
        JOIN users u  ON u.id = r.requested_by
        LEFT JOIN users d ON d.id = r.decided_by
        LEFT JOIN projects p ON p.id = r.project_id
        WHERE r.id = %s
        """,
        (request_id,),
    )
    if not row:
        raise HTTPError(404, "Request not found")
    if not _is_approver(current_user) and str(row["requested_by"]) != str(current_user["id"]):
        raise HTTPError(403, "Forbidden")
    return resp({"request": row}, origin=origin)


# ── Accept ──────────────────────────────────────────────────────────────────
def _accept_request(event, origin, request_id):
    current_user = get_current_user(event)
    if not _is_approver(current_user):
        raise HTTPError(403, "Only the CEO or Admin can accept requests")

    body = AcceptScheduleRequest(**(get_body(event) or {}))
    existing = fetchone(
        "SELECT entity_type, entity_id, proposed_at FROM schedule_requests WHERE id = %s",
        (request_id,),
    )
    if not existing:
        raise HTTPError(404, "Request not found")

    updated = execute_returning(
        """
        UPDATE schedule_requests
           SET status         = 'accepted',
               rescheduled_to = COALESCE(%s, rescheduled_to),
               ceo_note       = COALESCE(%s, ceo_note),
               decided_by     = %s,
               decided_at     = NOW(),
               updated_at     = NOW()
         WHERE id = %s
         RETURNING *
        """,
        (body.rescheduled_to, body.ceo_note, str(current_user["id"]), request_id),
    )

    # Push the new datetime down to the source entity so the calendar shows it
    # correctly. Best-effort — entity may have been deleted in the meantime.
    if body.rescheduled_to:
        try:
            _sync_entity_datetime(
                existing["entity_type"], str(existing["entity_id"]), body.rescheduled_to
            )
        except Exception as e:
            log.warning(
                "Could not sync %s:%s to %s — %s",
                existing["entity_type"], existing["entity_id"], body.rescheduled_to, e,
            )

    return resp({"request": updated}, origin=origin)


# ── Reject ──────────────────────────────────────────────────────────────────
def _reject_request(event, origin, request_id):
    current_user = get_current_user(event)
    if not _is_approver(current_user):
        raise HTTPError(403, "Only the CEO or Admin can reject requests")

    body = RejectScheduleRequest(**(get_body(event) or {}))
    updated = execute_returning(
        """
        UPDATE schedule_requests
           SET status     = 'rejected',
               ceo_note   = COALESCE(%s, ceo_note),
               decided_by = %s,
               decided_at = NOW(),
               updated_at = NOW()
         WHERE id = %s
         RETURNING *
        """,
        (body.ceo_note, str(current_user["id"]), request_id),
    )
    if not updated:
        raise HTTPError(404, "Request not found")
    return resp({"request": updated}, origin=origin)


# ── Sync helpers ────────────────────────────────────────────────────────────
def _sync_entity_datetime(entity_type: str, entity_id: str, iso_datetime: str) -> None:
    """When CEO reschedules, propagate the new time to the source record."""
    date_part = iso_datetime[:10]
    if entity_type == "meeting":
        execute(
            "UPDATE meetings SET scheduled_at = %s WHERE id = %s",
            (iso_datetime, entity_id),
        )
    elif entity_type == "discussion":
        execute(
            "UPDATE discussions SET scheduled_at = %s, updated_at = NOW() WHERE id = %s",
            (iso_datetime, entity_id),
        )
    elif entity_type == "review":
        execute(
            "UPDATE review_tasks SET due_date = %s, updated_at = NOW() WHERE id = %s",
            (date_part, entity_id),
        )
    elif entity_type == "commitment":
        # Shift the from-date but preserve the original span length.
        row = fetchone(
            "SELECT from_date, to_date FROM commitments WHERE id = %s",
            (entity_id,),
        )
        if row:
            from datetime import date as _date, datetime as _dt
            try:
                old_from = _date.fromisoformat(str(row["from_date"])[:10])
                old_to   = _date.fromisoformat(str(row["to_date"])[:10])
                span     = (old_to - old_from).days
                new_from = _date.fromisoformat(date_part)
                new_to   = new_from.fromordinal(new_from.toordinal() + span)
                execute(
                    "UPDATE commitments SET from_date = %s, to_date = %s, updated_at = NOW() "
                    "WHERE id = %s",
                    (new_from.isoformat(), new_to.isoformat(), entity_id),
                )
            except Exception:
                pass
    elif entity_type == "leave":
        # Leaves have status; rescheduling here just marks it approved.
        execute(
            "UPDATE leave_requests SET status = 'approved', approved_at = NOW() WHERE id = %s",
            (entity_id,),
        )


# ── Routes ──────────────────────────────────────────────────────────────────
handler = make_handler([
    ("GET",   r"/api/schedule-requests",                                _list_requests),
    ("GET",   rf"/api/schedule-requests/(?P<request_id>{PARAM})",       _get_request),
    ("POST",  rf"/api/schedule-requests/(?P<request_id>{PARAM})/accept",_accept_request),
    ("POST",  rf"/api/schedule-requests/(?P<request_id>{PARAM})/reject",_reject_request),
])
