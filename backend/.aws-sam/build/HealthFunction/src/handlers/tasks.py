"""Tasks Lambda handler — /api/tasks/*"""
import json
import logging

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user
from ..database import call_fn, execute, execute_returning, fetchall
from ..exceptions import HTTPError
from ..models.requests import (
    CreateDeadlineExtensionRequest, CreateMilestoneRequest, CreateTaskRequest,
    CreateTaskStepRequest, CreateTaskUpdateRequest, UpdateDeadlineExtensionRequest,
    UpdateMilestoneRequest, UpdateTaskRequest, UpdateTaskStepRequest,
)

log = logging.getLogger(__name__)


# ── Deadline extensions ───────────────────────────────────────────────────────

def _create_extension(event, origin):
    current_user = get_current_user(event)
    body = CreateDeadlineExtensionRequest(**get_body(event))
    ext = execute_returning("""
        INSERT INTO deadline_extensions
          (project_id, task_id, milestone_id, requested_by,
           original_deadline, requested_deadline, reason, reason_detail, impact)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (str(body.project_id),
          str(body.task_id)      if body.task_id      else None,
          str(body.milestone_id) if body.milestone_id else None,
          current_user["id"],
          body.original_deadline, body.requested_deadline,
          body.reason, body.reason_detail, body.impact))
    return resp({"extension": ext}, 201, origin)


def _update_extension(event, origin, ext_id):
    current_user = get_current_user(event)
    body = UpdateDeadlineExtensionRequest(**get_body(event))
    ext = execute_returning("""
        UPDATE deadline_extensions
        SET status = %s, ceo_comment = %s, action_taken = %s, approved_by = %s, approved_at = NOW()
        WHERE id = %s RETURNING *
    """, (body.status, body.ceo_comment, body.action_taken, current_user["id"], ext_id))
    if not ext:
        raise HTTPError(404, "Extension not found")
    return resp({"extension": ext}, origin=origin)


# ── Tasks ─────────────────────────────────────────────────────────────────────

def _list_tasks(event, origin):
    get_current_user(event)
    p = get_query(event)
    conds = ["1=1"]
    params: list = []
    if p.get("project_id"):  conds.append("t.project_id = %s");  params.append(p["project_id"])
    if p.get("assignee_id"): conds.append("t.assignee_id = %s"); params.append(p["assignee_id"])
    if p.get("status"):      conds.append("t.status = %s");      params.append(p["status"])
    if p.get("priority"):    conds.append("t.priority = %s");    params.append(p["priority"])
    tasks = fetchall(f"""
        SELECT t.id, t.title, t.status, t.priority, t.assignee_id,
          t.estimated_hours, t.actual_hours, t.plan_status,
          t.review_status, t.order_index, t.phase_id, t.created_at, t.completed_at,
          u.name AS assignee_name, u.avatar_color AS assignee_color,
          pr.title AS project_title, ph.phase_name
        FROM tasks t
        LEFT JOIN users u       ON u.id    = t.assignee_id
        LEFT JOIN projects pr   ON pr.id   = t.project_id
        LEFT JOIN phases ph     ON ph.id   = t.phase_id
        WHERE {" AND ".join(conds)}
        ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.created_at DESC
    """, tuple(params))
    return resp({"tasks": tasks}, origin=origin)


def _create_task(event, origin):
    current_user = get_current_user(event)
    body = CreateTaskRequest(**get_body(event))
    task = execute_returning("""
        INSERT INTO tasks
          (project_id, phase_id, title, description, assignee_id, approach,
           priority, estimated_hours, success_criteria, kill_criteria, order_index, created_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (str(body.project_id),
          str(body.phase_id)    if body.phase_id    else None,
          body.title, body.description,
          str(body.assignee_id) if body.assignee_id else None,
          body.approach, body.priority, body.estimated_hours,
          json.dumps(body.success_criteria), json.dumps(body.kill_criteria),
          body.order_index, current_user["id"]))
    return resp({"task": task}, 201, origin)


def _get_task(event, origin, task_id):
    get_current_user(event)
    data = call_fn("fn_task_full", task_id)
    if not data:
        raise HTTPError(404, "Task not found")
    return resp({"task": data}, origin=origin)


def _update_task(event, origin, task_id):
    get_current_user(event)
    body = UpdateTaskRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPError(400, "No fields to update")
    for key in ("success_criteria", "kill_criteria"):
        if key in fields: fields[key] = json.dumps(fields[key])
    if "assignee_id" in fields and fields["assignee_id"]:
        fields["assignee_id"] = str(fields["assignee_id"])
    if fields.get("status") == "completed":
        fields["completed_at"] = "NOW()"
    set_clause = ", ".join(f"{k} = NOW()" if v == "NOW()" else f"{k} = %s" for k, v in fields.items())
    params = [v for v in fields.values() if v != "NOW()"] + [task_id]
    updated = execute_returning(f"UPDATE tasks SET {set_clause}, updated_at = NOW() WHERE id = %s RETURNING *", params)
    if not updated:
        raise HTTPError(404, "Task not found")
    return resp({"task": updated}, origin=origin)


def _delete_task(event, origin, task_id):
    get_current_user(event)
    execute("DELETE FROM tasks WHERE id = %s", (task_id,))
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


# ── Steps ─────────────────────────────────────────────────────────────────────

def _create_step(event, origin, task_id):
    get_current_user(event)
    body = CreateTaskStepRequest(**get_body(event))
    step = execute_returning("""
        INSERT INTO task_steps
          (task_id, description, expected_outcome, category, estimated_hours, assignee_id, order_index)
        VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (task_id, body.description, body.expected_outcome, body.category, body.estimated_hours,
          str(body.assignee_id) if body.assignee_id else None, body.order_index))
    return resp({"step": step}, 201, origin)


def _update_step(event, origin, task_id, step_id):
    get_current_user(event)
    body = UpdateTaskStepRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPError(400, "No fields to update")
    if fields.get("status") == "completed":
        fields["completed_at"] = "NOW()"
    set_clause = ", ".join(f"{k} = NOW()" if v == "NOW()" else f"{k} = %s" for k, v in fields.items())
    params = [v for v in fields.values() if v != "NOW()"] + [step_id, task_id]
    updated = execute_returning(f"UPDATE task_steps SET {set_clause} WHERE id = %s AND task_id = %s RETURNING *", params)
    if not updated:
        raise HTTPError(404, "Step not found")
    return resp({"step": updated}, origin=origin)


# ── Task updates ──────────────────────────────────────────────────────────────

def _add_update(event, origin, task_id):
    current_user = get_current_user(event)
    body = CreateTaskUpdateRequest(**get_body(event))
    update = execute_returning("""
        INSERT INTO task_updates (task_id, user_id, message, revised_estimate)
        VALUES (%s,%s,%s,%s) RETURNING *
    """, (task_id, current_user["id"], body.message, body.revised_estimate))
    if body.revised_estimate is not None:
        execute("UPDATE tasks SET revised_estimate_hours = %s, updated_at = NOW() WHERE id = %s",
                (body.revised_estimate, task_id))
    return resp({"update": update}, 201, origin)


# ── Milestones ────────────────────────────────────────────────────────────────

def _create_milestone(event, origin, task_id):
    get_current_user(event)
    body = CreateMilestoneRequest(**get_body(event))
    ms = execute_returning("""
        INSERT INTO task_milestones
          (task_id, title, description, deliverable_type, success_criteria, assignee_id, target_day, order_index)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (task_id, body.title, body.description, body.deliverable_type, json.dumps(body.success_criteria),
          str(body.assignee_id) if body.assignee_id else None, body.target_day, body.order_index))
    return resp({"milestone": ms}, 201, origin)


def _update_milestone(event, origin, task_id, ms_id):
    get_current_user(event)
    body = UpdateMilestoneRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPError(400, "No fields to update")
    if fields.get("status") == "completed":
        fields["completed_at"] = "NOW()"
    set_clause = ", ".join(f"{k} = NOW()" if v == "NOW()" else f"{k} = %s" for k, v in fields.items())
    params = [v for v in fields.values() if v != "NOW()"] + [ms_id, task_id]
    updated = execute_returning(f"UPDATE task_milestones SET {set_clause} WHERE id = %s AND task_id = %s RETURNING *", params)
    if not updated:
        raise HTTPError(404, "Milestone not found")
    return resp({"milestone": updated}, origin=origin)


# Static deadline-extension routes BEFORE dynamic /<task_id>
handler = make_handler([
    ("POST",   r"/api/tasks/deadline-extensions",                                             _create_extension),
    ("PATCH",  rf"/api/tasks/deadline-extensions/(?P<ext_id>{PARAM})",                        _update_extension),
    ("GET",    r"/api/tasks",                                                                  _list_tasks),
    ("POST",   r"/api/tasks",                                                                  _create_task),
    ("POST",   rf"/api/tasks/(?P<task_id>{PARAM})/steps",                                     _create_step),
    ("PATCH",  rf"/api/tasks/(?P<task_id>{PARAM})/steps/(?P<step_id>{PARAM})",                _update_step),
    ("POST",   rf"/api/tasks/(?P<task_id>{PARAM})/updates",                                   _add_update),
    ("POST",   rf"/api/tasks/(?P<task_id>{PARAM})/milestones",                                _create_milestone),
    ("PATCH",  rf"/api/tasks/(?P<task_id>{PARAM})/milestones/(?P<ms_id>{PARAM})",             _update_milestone),
    ("GET",    rf"/api/tasks/(?P<task_id>{PARAM})",                                           _get_task),
    ("PATCH",  rf"/api/tasks/(?P<task_id>{PARAM})",                                           _update_task),
    ("DELETE", rf"/api/tasks/(?P<task_id>{PARAM})",                                           _delete_task),
])
