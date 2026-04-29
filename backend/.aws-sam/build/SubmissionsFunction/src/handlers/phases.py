"""Phases Lambda handler — /api/phases/*"""
import json
import logging

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user
from ..database import call_fn, call_proc, execute_returning, fetchall, fetchone
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
    data = call_fn("fn_phase_full", phase_id)
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
    if body.status     is not None: fields["status"]     = body.status
    if body.checklist  is not None: fields["checklist"]  = json.dumps(body.checklist)
    if body.start_date is not None: fields["start_date"] = body.start_date
    if body.end_date   is not None: fields["end_date"]   = body.end_date
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


handler = make_handler([
    ("POST",  r"/api/phases",                                          _create_phase),
    ("GET",   rf"/api/phases/(?P<phase_id>{PARAM})/attachments",       _list_attachments),
    ("POST",  rf"/api/phases/(?P<phase_id>{PARAM})/attachments",       _add_attachment),
    ("POST",  rf"/api/phases/(?P<phase_id>{PARAM})/sign-off",          _sign_off),
    ("GET",   rf"/api/phases/(?P<phase_id>{PARAM})",                   _get_phase),
    ("PATCH", rf"/api/phases/(?P<phase_id>{PARAM})",                   _update_phase),
])
