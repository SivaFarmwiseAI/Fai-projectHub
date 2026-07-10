"""Submissions, feedback, and checkpoints Lambda handler — /api/submissions/*, /api/feedback/*, /api/checkpoints/*"""
import json
import logging

from .base import PARAM, get_body, get_query, make_handler, resp
from ._notify import notify
from ..auth import get_current_user
from ..database import execute, execute_returning, fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import (
    CreateCheckpointRequest, CreateFeedbackRequest,
    CreateSubmissionRequest, UpdateSubmissionRequest,
)

log = logging.getLogger(__name__)


# ── Submissions ───────────────────────────────────────────────────────────────

def _list_submissions(event, origin):
    get_current_user(event)
    p = get_query(event)
    conds = ["1=1"]
    params: list = []
    if p.get("project_id"): conds.append("s.project_id = %s"); params.append(p["project_id"])
    if p.get("phase_id"):   conds.append("s.phase_id = %s");   params.append(p["phase_id"])
    if p.get("status"):     conds.append("s.status = %s");     params.append(p["status"])
    if p.get("pending", "").lower() == "true":
        conds.append("s.status = 'submitted'")
    rows = fetchall(f"""
        SELECT
          s.*,
          u.name AS submitted_by_name, u.avatar_color AS submitted_by_color,
          pr.title AS project_title, ph.phase_name,
          COALESCE(
            (SELECT json_agg(f ORDER BY f.created_at) FROM feedback f WHERE f.submission_id = s.id),
            '[]'
          ) AS feedback
        FROM submissions s
        JOIN users u     ON u.id   = s.user_id
        JOIN projects pr ON pr.id  = s.project_id
        LEFT JOIN phases ph ON ph.id = s.phase_id
        WHERE {" AND ".join(conds)}
        ORDER BY s.created_at DESC
    """, tuple(params))
    return resp({"submissions": rows}, origin=origin)


def _create_submission(event, origin):
    current_user = get_current_user(event)
    body = CreateSubmissionRequest(**get_body(event))
    sub = execute_returning("""
        INSERT INTO submissions
          (phase_id, project_id, user_id, title, type, description, link, is_key_milestone)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (
        str(body.phase_id)    if body.phase_id    else None,
        str(body.project_id), current_user["id"],
        body.title, body.type, body.description, body.link, body.is_key_milestone,
    ))
    # Notify project owner and co-owners about new submission
    proj = fetchone("SELECT owner_id, title FROM projects WHERE id = %s", (str(body.project_id),))
    co_owners = fetchall("SELECT user_id FROM project_co_owners WHERE project_id = %s", (str(body.project_id),))
    notify_uids = {str(r["user_id"]) for r in co_owners}
    if proj and proj.get("owner_id"):
        notify_uids.add(str(proj["owner_id"]))
    notify_uids.discard(str(current_user["id"]))
    for uid in notify_uids:
        notify(uid, "review_requested", f"New submission: {body.title}",
               f"A new submission needs your review in \"{(proj or {}).get('title', 'a project')}\".",
               project_id=str(body.project_id))
    return resp({"submission": sub}, 201, origin)


def _get_submission(event, origin, submission_id):
    get_current_user(event)
    sub = fetchone("""
        SELECT s.*,
          u.name AS submitted_by_name,
          COALESCE(
            (SELECT json_agg(
                jsonb_build_object(
                  'id', f.id, 'text', f.text, 'is_ai', f.is_ai,
                  'created_at', f.created_at, 'from_user_id', f.from_user_id,
                  'from_user_name', fu.name
                ) ORDER BY f.created_at)
              FROM feedback f LEFT JOIN users fu ON fu.id = f.from_user_id
              WHERE f.submission_id = s.id
            ), '[]'
          ) AS feedback
        FROM submissions s
        JOIN users u ON u.id = s.user_id
        WHERE s.id = %s
    """, (submission_id,))
    if not sub:
        raise HTTPError(404, "Submission not found")
    return resp({"submission": sub}, origin=origin)


def _update_submission(event, origin, submission_id):
    get_current_user(event)
    body = UpdateSubmissionRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPError(400, "No fields to update")
    if "reviewed_by" in fields:
        fields["reviewed_by"] = str(fields["reviewed_by"])
        fields["reviewed_at"] = "NOW()"
    set_clause = ", ".join(
        f"{k} = NOW()" if v == "NOW()" else f"{k} = %s"
        for k, v in fields.items()
    )
    params = [v for v in fields.values() if v != "NOW()"] + [submission_id]
    updated = execute_returning(
        f"UPDATE submissions SET {set_clause}, updated_at = NOW() WHERE id = %s RETURNING *", params
    )
    if not updated:
        raise HTTPError(404, "Submission not found")
    return resp({"submission": updated}, origin=origin)


# ── Feedback ──────────────────────────────────────────────────────────────────

def _create_feedback(event, origin):
    current_user = get_current_user(event)
    body = CreateFeedbackRequest(**get_body(event))
    fb = execute_returning("""
        INSERT INTO feedback (submission_id, from_user_id, text, is_ai, action_items)
        VALUES (%s,%s,%s,%s,%s) RETURNING *
    """, (
        str(body.submission_id),
        current_user["id"] if not body.is_ai else None,
        body.text, body.is_ai, json.dumps(body.action_items),
    ))
    # Notify the submission author that feedback was given
    sub = fetchone("SELECT user_id, project_id, title FROM submissions WHERE id = %s", (str(body.submission_id),))
    if sub and sub.get("user_id") and str(sub["user_id"]) != str(current_user["id"]):
        notify(str(sub["user_id"]), "review_requested",
               f"Feedback on your submission: {sub.get('title', '')}",
               "You received feedback on your submission.",
               project_id=str(sub["project_id"]) if sub.get("project_id") else None)
    return resp({"feedback": fb}, 201, origin)


# ── Checkpoints ───────────────────────────────────────────────────────────────

def _create_checkpoint(event, origin):
    current_user = get_current_user(event)
    body = CreateCheckpointRequest(**get_body(event))
    cp = execute_returning("""
        INSERT INTO checkpoints
          (project_id, decision, notes, ai_insights, action_items, decided_by)
        VALUES (%s,%s,%s,%s,%s,%s) RETURNING *
    """, (
        str(body.project_id), body.decision, body.notes,
        body.ai_insights, json.dumps(body.action_items), current_user["id"],
    ))
    if body.decision in ("kill", "pause"):
        status = "killed" if body.decision == "kill" else "paused"
        execute("UPDATE projects SET status = %s, updated_at = NOW() WHERE id = %s",
                (status, str(body.project_id)))
        # Notify all project members about project kill/pause
        proj = fetchone("SELECT title, owner_id FROM projects WHERE id = %s", (str(body.project_id),))
        assignees = fetchall("SELECT user_id FROM project_assignees WHERE project_id = %s", (str(body.project_id),))
        co_owners = fetchall("SELECT user_id FROM project_co_owners WHERE project_id = %s", (str(body.project_id),))
        all_members = {str(r["user_id"]) for r in assignees + co_owners}
        if proj and proj.get("owner_id"):
            all_members.add(str(proj["owner_id"]))
        proj_title = (proj or {}).get("title", "a project")
        action_word = "killed" if body.decision == "kill" else "paused"
        for uid in all_members:
            notify(uid, "project_at_risk", f"Project {action_word}: {proj_title}",
                   f"Project \"{proj_title}\" has been {action_word}.",
                   project_id=str(body.project_id))
    return resp({"checkpoint": cp}, 201, origin)


handler = make_handler([
    ("GET",   r"/api/submissions",                                        _list_submissions),
    ("POST",  r"/api/submissions",                                        _create_submission),
    ("GET",   rf"/api/submissions/(?P<submission_id>{PARAM})",            _get_submission),
    ("PATCH", rf"/api/submissions/(?P<submission_id>{PARAM})",            _update_submission),
    ("POST",  r"/api/feedback",                                           _create_feedback),
    ("POST",  r"/api/checkpoints",                                        _create_checkpoint),
])
