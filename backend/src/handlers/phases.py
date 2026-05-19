"""Phases Lambda handler — /api/phases/*"""
import json
import logging

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user
from ..database import call_fn, call_proc, execute, execute_returning, fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import CreatePhaseRequest, UpdatePhaseRequest

log = logging.getLogger(__name__)


def _create_phase(event, origin):
    get_current_user(event)
    body = CreatePhaseRequest(**get_body(event))
    phase = execute_returning("""
        INSERT INTO phases
          (project_id, phase_name, description, order_index,
           sign_off_required, estimated_duration, checklist)
        VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (str(body.project_id), body.phase_name, body.description,
          body.order_index, body.sign_off_required, body.estimated_duration,
          json.dumps(body.checklist)))
    return resp({"phase": phase}, 201, origin)


def _get_phase(event, origin, phase_id):
    get_current_user(event)
    # Cheap existence check first — gives a clean 404 even if fn_phase_full is
    # missing from the DB or errors for some reason.
    exists = fetchone("SELECT 1 FROM phases WHERE id = %s", (phase_id,))
    if not exists:
        raise HTTPError(404, "Phase not found")
    try:
        data = call_fn("fn_phase_full", phase_id)
    except Exception as e:
        log.exception("fn_phase_full failed for %s: %s", phase_id, e)
        # Fall back to a minimal row so the UI doesn't get a 500 just because
        # the JSON function is missing or broken.
        data = fetchone(
            "SELECT id, project_id, phase_name, description, status, checklist, "
            "order_index, sign_off_required, signed_off_by, estimated_duration, "
            "start_date, end_date, started_at, completed_at FROM phases WHERE id = %s",
            (phase_id,),
        )
    if not data:
        raise HTTPError(404, "Phase not found")
    return resp({"phase": data}, origin=origin)


def _update_phase(event, origin, phase_id):
    get_current_user(event)
    body = UpdatePhaseRequest(**get_body(event))

    if body.status == "completed":
        result = call_proc("fn_advance_phase", phase_id)
        return resp({"result": result}, origin=origin)

    fields: dict = {}
    if body.phase_name         is not None: fields["phase_name"]         = body.phase_name
    if body.description        is not None: fields["description"]        = body.description
    if body.status             is not None: fields["status"]             = body.status
    if body.estimated_duration is not None: fields["estimated_duration"] = body.estimated_duration
    if body.sign_off_required  is not None: fields["sign_off_required"]  = body.sign_off_required
    if body.checklist          is not None: fields["checklist"]          = json.dumps(body.checklist)
    if body.start_date         is not None: fields["start_date"]         = body.start_date
    if body.end_date           is not None: fields["end_date"]           = body.end_date
    if not fields:
        raise HTTPError(400, "No fields to update")
    if body.status == "active":
        fields["started_at"] = "NOW()"

    set_clause = ", ".join(
        f"{k} = NOW()" if v == "NOW()" else f"{k} = %s"
        for k, v in fields.items()
    )
    params = [v for v in fields.values() if v != "NOW()"] + [phase_id]
    updated = execute_returning(
        f"UPDATE phases SET {set_clause}, updated_at = NOW() WHERE id = %s RETURNING *", params
    )
    if not updated:
        raise HTTPError(404, "Phase not found")
    return resp({"phase": updated}, origin=origin)


def _sign_off(event, origin, phase_id):
    current_user = get_current_user(event)
    phase = fetchone("SELECT * FROM phases WHERE id = %s", (phase_id,))
    if not phase:
        raise HTTPError(404, "Phase not found")
    signed = phase.get("signed_off_by") or []
    if current_user["id"] not in signed:
        signed.append(current_user["id"])
    updated = execute_returning(
        "UPDATE phases SET signed_off_by = %s, updated_at = NOW() WHERE id = %s RETURNING *",
        (json.dumps(signed), phase_id),
    )
    return resp({"phase": updated}, origin=origin)


def _add_attachment(event, origin, phase_id):
    current_user = get_current_user(event)
    p = get_query(event)
    att = execute_returning("""
        INSERT INTO phase_attachments (phase_id, title, type, uploaded_by, url)
        VALUES (%s,%s,%s,%s,%s) RETURNING *
    """, (phase_id, p.get("title", ""), p.get("type", "document"), current_user["id"], p.get("url")))
    return resp({"attachment": att}, 201, origin)


def _list_attachments(event, origin, phase_id):
    get_current_user(event)
    atts = fetchall("""
        SELECT pa.*, u.name AS uploader
        FROM phase_attachments pa LEFT JOIN users u ON u.id = pa.uploaded_by
        WHERE pa.phase_id = %s ORDER BY pa.created_at DESC
    """, (phase_id,))
    return resp({"attachments": atts}, origin=origin)


def _delete_phase(event, origin, phase_id):
    current_user = get_current_user(event)
    phase = fetchone(
        "SELECT id, project_id, phase_name, status, order_index FROM phases WHERE id = %s",
        (phase_id,),
    )
    if not phase:
        raise HTTPError(404, "Phase not found")

    project = fetchone(
        "SELECT owner_id, current_phase FROM projects WHERE id = %s",
        (phase["project_id"],),
    )
    if not project:
        raise HTTPError(404, "Project not found")

    is_owner = str(project["owner_id"]) == str(current_user["id"])
    is_admin = current_user["role_type"] in ("CEO", "Admin", "Team Lead")
    if not (is_owner or is_admin):
        raise HTTPError(403, "Only the project owner, CEO, Admin, or Team Lead can delete phases")

    # If we're deleting the project's active phase, promote the next pending phase
    # (by order_index) to active so the project doesn't get stuck on a stale name.
    was_active = phase["phase_name"] == project["current_phase"]

    # FK cascades clean up phase_discussions/phase_attachments/submissions; tasks
    # and discussions just get phase_id = NULL.
    try:
        execute("DELETE FROM phases WHERE id = %s", (phase_id,))
    except Exception as e:
        msg = str(e)
        log.error("Phase delete failed for %s: %s", phase_id, msg)
        if "foreign key" in msg.lower() or "violates" in msg.lower():
            raise HTTPError(409, f"Cannot delete phase — related records still reference it ({msg})")
        raise HTTPError(500, "Failed to delete phase")

    # Post-delete bookkeeping: if we removed the active phase, promote the next
    # one. Failures here MUST NOT fail the request — the phase is already gone
    # and the user expects a success. We log loudly and move on.
    if was_active:
        try:
            next_phase = fetchone(
                "SELECT phase_name FROM phases WHERE project_id = %s AND order_index > %s "
                "ORDER BY order_index LIMIT 1",
                (str(phase["project_id"]), phase["order_index"]),
            )
            new_name = next_phase["phase_name"] if next_phase else ""
            execute(
                "UPDATE projects SET current_phase = %s, updated_at = NOW() WHERE id = %s",
                (new_name, str(phase["project_id"])),
            )
            if next_phase:
                execute(
                    "UPDATE phases SET status = 'active'::phase_status, "
                    "started_at = COALESCE(started_at, NOW()) "
                    "WHERE project_id = %s AND phase_name = %s",
                    (str(phase["project_id"]), new_name),
                )
        except Exception as e:
            log.warning(
                "Phase %s deleted but post-delete promotion failed: %s",
                phase_id, e,
            )

    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


handler = make_handler([
    ("POST",   r"/api/phases",                                          _create_phase),
    ("GET",    rf"/api/phases/(?P<phase_id>{PARAM})/attachments",       _list_attachments),
    ("POST",   rf"/api/phases/(?P<phase_id>{PARAM})/attachments",       _add_attachment),
    ("POST",   rf"/api/phases/(?P<phase_id>{PARAM})/sign-off",          _sign_off),
    ("GET",    rf"/api/phases/(?P<phase_id>{PARAM})",                   _get_phase),
    ("PATCH",  rf"/api/phases/(?P<phase_id>{PARAM})",                   _update_phase),
    ("DELETE", rf"/api/phases/(?P<phase_id>{PARAM})",                   _delete_phase),
])
