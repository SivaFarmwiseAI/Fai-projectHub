"""Commitments Lambda handler — /api/commitments/*"""
import logging

from .base import PARAM, get_body, get_query, make_handler, resp
from ._approval import auto_request
from ..auth import get_current_user
from ..database import execute, execute_returning, fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import CreateCommitmentRequest, UpdateCommitmentRequest

log = logging.getLogger(__name__)


def _list_commitments(event, origin):
    current_user = get_current_user(event)
    p = get_query(event)
    conds: list = ["1=1"]
    params: list = []

    # Non-admins see commitments they own or are assigned to.
    if current_user["role_type"] not in ("CEO", "Admin"):
        conds.append("(c.owner_id = %s OR c.assignee_id = %s)")
        params.extend([current_user["id"], current_user["id"]])

    if p.get("status"):      conds.append("c.status = %s");      params.append(p["status"])
    if p.get("priority"):    conds.append("c.priority = %s");    params.append(p["priority"])
    if p.get("assignee_id"): conds.append("c.assignee_id = %s"); params.append(p["assignee_id"])
    if p.get("project_id"):  conds.append("c.project_id = %s");  params.append(p["project_id"])
    if p.get("from_date"):   conds.append("c.to_date >= %s");    params.append(p["from_date"])
    if p.get("to_date"):     conds.append("c.from_date <= %s");  params.append(p["to_date"])

    rows = fetchall(f"""
        SELECT
          c.*,
          ow.name AS owner_name,    ow.avatar_color AS owner_color,
          a.name  AS assignee_name, a.avatar_color  AS assignee_color,
          pr.title AS project_title
        FROM commitments c
        JOIN users ow      ON ow.id = c.owner_id
        LEFT JOIN users a  ON a.id  = c.assignee_id
        LEFT JOIN projects pr ON pr.id = c.project_id
        WHERE {" AND ".join(conds)}
        ORDER BY c.from_date ASC, c.created_at DESC
    """, tuple(params))
    return resp({"commitments": rows}, origin=origin)


def _create_commitment(event, origin):
    current_user = get_current_user(event)
    body = CreateCommitmentRequest(**get_body(event))
    if body.to_date < body.from_date:
        raise HTTPError(400, "to_date must be on or after from_date")
    commitment = execute_returning("""
        INSERT INTO commitments
          (title, description, from_date, to_date, priority, status,
           owner_id, assignee_id, project_id)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (
        body.title, body.description, body.from_date, body.to_date,
        body.priority, body.status,
        current_user["id"],
        str(body.assignee_id) if body.assignee_id else None,
        str(body.project_id)  if body.project_id  else None,
    ))
    auto_request(
        entity_type="commitment",
        entity_id=str(commitment["id"]),
        requested_by=str(current_user["id"]),
        title=body.title,
        description=body.description,
        proposed_at=f"{body.from_date}T09:00:00Z",
        project_id=str(body.project_id) if body.project_id else None,
    )
    return resp({"commitment": commitment}, 201, origin)


def _get_commitment(event, origin, commitment_id):
    get_current_user(event)
    commitment = fetchone("""
        SELECT
          c.*,
          ow.name AS owner_name,    ow.avatar_color AS owner_color,
          a.name  AS assignee_name, a.avatar_color  AS assignee_color,
          pr.title AS project_title
        FROM commitments c
        JOIN users ow      ON ow.id = c.owner_id
        LEFT JOIN users a  ON a.id  = c.assignee_id
        LEFT JOIN projects pr ON pr.id = c.project_id
        WHERE c.id = %s
    """, (commitment_id,))
    if not commitment:
        raise HTTPError(404, "Commitment not found")
    return resp({"commitment": commitment}, origin=origin)


def _update_commitment(event, origin, commitment_id):
    current_user = get_current_user(event)
    existing = fetchone("SELECT owner_id, assignee_id FROM commitments WHERE id = %s", (commitment_id,))
    if not existing:
        raise HTTPError(404, "Commitment not found")
    is_owner    = str(existing["owner_id"])    == str(current_user["id"])
    is_assignee = str(existing["assignee_id"]) == str(current_user["id"])
    is_admin    = current_user["role_type"] in ("CEO", "Admin")
    if not (is_owner or is_assignee or is_admin):
        raise HTTPError(403, "You can only edit commitments you own or are assigned to")

    body = UpdateCommitmentRequest(**get_body(event))
    raw = body.model_dump(exclude_unset=True)
    if not raw:
        raise HTTPError(400, "No fields to update")

    fields: dict = {}
    for key, value in raw.items():
        if key in ("assignee_id", "project_id") and value is not None:
            fields[key] = str(value)
        else:
            fields[key] = value

    # Validate date order if either changed.
    if "from_date" in fields or "to_date" in fields:
        prev = fetchone("SELECT from_date, to_date FROM commitments WHERE id = %s", (commitment_id,))
        fd = fields.get("from_date", prev["from_date"])
        td = fields.get("to_date",   prev["to_date"])
        if td < fd:
            raise HTTPError(400, "to_date must be on or after from_date")

    set_clause = ", ".join(f"{k} = %s" for k in fields)
    params = list(fields.values()) + [commitment_id]
    updated = execute_returning(
        f"UPDATE commitments SET {set_clause}, updated_at = NOW() WHERE id = %s RETURNING *",
        params,
    )
    return resp({"commitment": updated}, origin=origin)


def _delete_commitment(event, origin, commitment_id):
    current_user = get_current_user(event)
    existing = fetchone("SELECT owner_id FROM commitments WHERE id = %s", (commitment_id,))
    if not existing:
        raise HTTPError(404, "Commitment not found")
    is_owner = str(existing["owner_id"]) == str(current_user["id"])
    is_admin = current_user["role_type"] in ("CEO", "Admin")
    if not (is_owner or is_admin):
        raise HTTPError(403, "You can only delete commitments you own")
    execute("DELETE FROM commitments WHERE id = %s", (commitment_id,))
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


handler = make_handler([
    ("GET",    r"/api/commitments",                                    _list_commitments),
    ("POST",   r"/api/commitments",                                    _create_commitment),
    ("GET",    rf"/api/commitments/(?P<commitment_id>{PARAM})",        _get_commitment),
    ("PATCH",  rf"/api/commitments/(?P<commitment_id>{PARAM})",        _update_commitment),
    ("DELETE", rf"/api/commitments/(?P<commitment_id>{PARAM})",        _delete_commitment),
])
