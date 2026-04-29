"""Reviews Lambda handler — /api/reviews/*"""
import logging

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user
from ..database import execute, execute_returning, fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import CreateReviewTaskRequest, UpdateReviewTaskRequest

log = logging.getLogger(__name__)


# ── Static routes FIRST ───────────────────────────────────────────────────────

def _review_stats(event, origin):
    current_user = get_current_user(event)
    assignee_filter = ""
    params: list = []
    if current_user["role_type"] not in ("CEO", "Admin"):
        assignee_filter = "WHERE assignee_id = %s"
        params.append(current_user["id"])
    stats = fetchone(f"""
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')     AS pending,
          COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress,
          COUNT(*) FILTER (WHERE status = 'completed')   AS completed,
          COUNT(*) FILTER (WHERE priority = 'high' AND status NOT IN ('completed','rejected')) AS high_priority_open
        FROM review_tasks
        {assignee_filter}
    """, tuple(params))
    return resp({"stats": stats}, origin=origin)


# ── Collection endpoints ──────────────────────────────────────────────────────

def _list_reviews(event, origin):
    current_user = get_current_user(event)
    p = get_query(event)
    assignee_id = p.get("assignee_id")
    if not assignee_id and current_user["role_type"] not in ("CEO", "Admin", "Team Lead"):
        assignee_id = current_user["id"]
    conds = ["1=1"]
    params: list = []
    if assignee_id:         conds.append("rt.assignee_id = %s"); params.append(assignee_id)
    if p.get("status"):     conds.append("rt.status = %s");      params.append(p["status"])
    if p.get("priority"):   conds.append("rt.priority = %s");    params.append(p["priority"])
    if p.get("project_id"): conds.append("rt.project_id = %s"); params.append(p["project_id"])
    rows = fetchall(f"""
        SELECT
          rt.*,
          a.name  AS assignee_name,  a.avatar_color AS assignee_color,
          rq.name AS requester_name,
          pr.title AS project_title
        FROM review_tasks rt
        LEFT JOIN users a  ON a.id  = rt.assignee_id
        LEFT JOIN users rq ON rq.id = rt.requester_id
        LEFT JOIN projects pr ON pr.id = rt.project_id
        WHERE {" AND ".join(conds)}
        ORDER BY
          CASE rt.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
          rt.due_date NULLS LAST, rt.created_at DESC
    """, tuple(params))
    return resp({"reviews": rows}, origin=origin)


def _create_review(event, origin):
    current_user = get_current_user(event)
    body = CreateReviewTaskRequest(**get_body(event))
    review = execute_returning("""
        INSERT INTO review_tasks
          (title, description, type, assignee_id, requester_id,
           project_id, task_id, submission_id, priority, due_date)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (
        body.title, body.description, body.type,
        str(body.assignee_id)   if body.assignee_id   else None,
        current_user["id"],
        str(body.project_id)    if body.project_id    else None,
        str(body.task_id)       if body.task_id       else None,
        str(body.submission_id) if body.submission_id else None,
        body.priority, body.due_date,
    ))
    return resp({"review": review}, 201, origin)


# ── Single review ─────────────────────────────────────────────────────────────

def _get_review(event, origin, review_id):
    get_current_user(event)
    review = fetchone("""
        SELECT rt.*,
          a.name  AS assignee_name,
          rq.name AS requester_name,
          pr.title AS project_title
        FROM review_tasks rt
        LEFT JOIN users a  ON a.id  = rt.assignee_id
        LEFT JOIN users rq ON rq.id = rt.requester_id
        LEFT JOIN projects pr ON pr.id = rt.project_id
        WHERE rt.id = %s
    """, (review_id,))
    if not review:
        raise HTTPError(404, "Review not found")
    return resp({"review": review}, origin=origin)


def _update_review(event, origin, review_id):
    get_current_user(event)
    body = UpdateReviewTaskRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPError(400, "No fields to update")
    if "assignee_id" in fields:
        fields["assignee_id"] = str(fields["assignee_id"])
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    params = list(fields.values()) + [review_id]
    updated = execute_returning(
        f"UPDATE review_tasks SET {set_clause}, updated_at = NOW() WHERE id = %s RETURNING *", params
    )
    if not updated:
        raise HTTPError(404, "Review not found")
    return resp({"review": updated}, origin=origin)


def _delete_review(event, origin, review_id):
    get_current_user(event)
    execute("DELETE FROM review_tasks WHERE id = %s", (review_id,))
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


# /stats/summary BEFORE /<review_id>
handler = make_handler([
    ("GET",    r"/api/reviews/stats/summary",               _review_stats),
    ("GET",    r"/api/reviews",                              _list_reviews),
    ("POST",   r"/api/reviews",                              _create_review),
    ("GET",    rf"/api/reviews/(?P<review_id>{PARAM})",      _get_review),
    ("PATCH",  rf"/api/reviews/(?P<review_id>{PARAM})",      _update_review),
    ("DELETE", rf"/api/reviews/(?P<review_id>{PARAM})",      _delete_review),
])
