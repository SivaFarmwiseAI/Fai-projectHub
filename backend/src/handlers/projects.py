"""Projects Lambda handler — /api/projects/*"""
import json
import logging

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user, require_auth
from ..database import call_fn, call_proc, execute, execute_returning, fetchall
from ..exceptions import HTTPError
from ..models.requests import CreateProjectRequest, CreateProjectUpdateRequest, UpdateProjectRequest

log = logging.getLogger(__name__)


def _timeline(event, origin):
    get_current_user(event)
    return resp(call_fn("fn_timeline_data") or {"projects": []}, origin=origin)


def _global_search(event, origin):
    get_current_user(event)
    q = get_query(event).get("q", "")
    if len(q) < 2:
        raise HTTPError(400, "Query must be at least 2 characters")
    return resp(call_fn("fn_global_search", q) or {"projects": [], "tasks": [], "users": []}, origin=origin)


def _list_projects(event, origin):
    get_current_user(event)
    p = get_query(event)
    result = call_fn(
        "fn_projects_list",
        p.get("status"), p.get("type"), p.get("priority"),
        p.get("owner_id"), p.get("assignee_id"), p.get("search"),
        int(p.get("limit", 50)), int(p.get("offset", 0)),
    )
    return resp(result or {"projects": [], "total": 0}, origin=origin)


def _create_project(event, origin):
    get_current_user(event)
    body = CreateProjectRequest(**get_body(event))
    project_id = call_proc(
        "fn_create_project",
        body.title, body.type, body.requirement, body.objective,
        body.outcome_type, body.outcome_description, body.priority,
        str(body.owner_id),
        [str(u) for u in body.assignee_ids] or None,
        [str(u) for u in body.co_owner_ids] or None,
        body.timebox_days, body.start_date,
        json.dumps(body.tech_stack), json.dumps(body.ai_plan),
    )
    if not project_id:
        raise HTTPError(500, "Project creation failed")
    return resp({"project": call_fn("fn_project_full", str(project_id))}, 201, origin)


def _get_project(event, origin, project_id):
    get_current_user(event)
    data = call_fn("fn_project_full", project_id)
    if not data:
        raise HTTPError(404, "Project not found")
    return resp({"project": data}, origin=origin)


def _update_project(event, origin, project_id):
    get_current_user(event)
    body = UpdateProjectRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPError(400, "No fields to update")
    for key in ("tech_stack", "ai_plan"):
        if key in fields:
            fields[key] = json.dumps(fields[key])
    updated = execute_returning(
        f"UPDATE projects SET {', '.join(f'{k} = %s' for k in fields)}, updated_at = NOW() "
        f"WHERE id = %s RETURNING id, title, status, priority, updated_at",
        list(fields.values()) + [project_id],
    )
    if not updated:
        raise HTTPError(404, "Project not found")
    return resp({"project": updated}, origin=origin)


def _delete_project(event, origin, project_id):
    require_auth(event, "CEO", "Admin", "Team Lead")
    if execute("DELETE FROM projects WHERE id = %s", (project_id,)) == 0:
        raise HTTPError(404, "Project not found")
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


def _project_tasks(event, origin, project_id):
    get_current_user(event)
    tasks = fetchall("""
        SELECT
          t.id, t.title, t.status, t.priority, t.assignee_id,
          t.estimated_hours, t.actual_hours, t.plan_status,
          t.review_status, t.order_index, t.phase_id, t.created_at, t.completed_at,
          u.name AS assignee_name, u.avatar_color AS assignee_color, ph.phase_name,
          (SELECT COUNT(*) FROM task_steps ts WHERE ts.task_id = t.id) AS step_count,
          (SELECT COUNT(*) FROM task_milestones tm WHERE tm.task_id = t.id) AS milestone_count
        FROM tasks t
        LEFT JOIN users u  ON u.id  = t.assignee_id
        LEFT JOIN phases ph ON ph.id = t.phase_id
        WHERE t.project_id = %s
        ORDER BY t.order_index, t.created_at
    """, (project_id,))
    return resp({"tasks": tasks}, origin=origin)


def _project_kanban(event, origin, project_id):
    get_current_user(event)
    return resp(call_fn("fn_kanban_board", project_id) or {"columns": {}}, origin=origin)


def _project_updates(event, origin, project_id):
    get_current_user(event)
    updates = fetchall("""
        SELECT pu.*, u.name AS author_name, u.avatar_color
        FROM project_updates pu JOIN users u ON u.id = pu.user_id
        WHERE pu.project_id = %s ORDER BY pu.created_at DESC LIMIT 50
    """, (project_id,))
    return resp({"updates": updates}, origin=origin)


def _create_update(event, origin, project_id):
    current_user = get_current_user(event)
    body = CreateProjectUpdateRequest(**get_body(event))
    update = execute_returning("""
        INSERT INTO project_updates
          (project_id, user_id, type, title, description, link,
           what_was_done, blockers, next_steps, attendees, decisions, action_items)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (project_id, current_user["id"], body.type, body.title, body.description, body.link,
          body.what_was_done, body.blockers, body.next_steps,
          json.dumps(body.attendees), json.dumps(body.decisions), json.dumps(body.action_items)))
    return resp({"update": update}, 201, origin)


def _project_documents(event, origin, project_id):
    get_current_user(event)
    docs = fetchall("SELECT * FROM project_documents WHERE project_id = %s ORDER BY updated_at DESC", (project_id,))
    return resp({"documents": docs}, origin=origin)


def _project_insights(event, origin, project_id):
    get_current_user(event)
    insights = fetchall("""
        SELECT ai.*, u.name AS user_name
        FROM ai_insights ai LEFT JOIN users u ON u.id = ai.user_id
        WHERE ai.project_id = %s AND ai.status = 'active'
        ORDER BY CASE ai.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    """, (project_id,))
    return resp({"insights": insights}, origin=origin)


def _project_checkpoints(event, origin, project_id):
    get_current_user(event)
    rows = fetchall("""
        SELECT c.*, u.name AS decided_by_name
        FROM checkpoints c LEFT JOIN users u ON u.id = c.decided_by
        WHERE c.project_id = %s ORDER BY c.created_at DESC
    """, (project_id,))
    return resp({"checkpoints": rows}, origin=origin)


# Static routes BEFORE dynamic /<project_id> to prevent shadowing
handler = make_handler([
    ("GET",    r"/api/projects/timeline/all",                         _timeline),
    ("GET",    r"/api/projects/search/global",                        _global_search),
    ("GET",    r"/api/projects",                                      _list_projects),
    ("POST",   r"/api/projects",                                      _create_project),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/tasks",        _project_tasks),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/kanban",       _project_kanban),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/updates",      _project_updates),
    ("POST",   rf"/api/projects/(?P<project_id>{PARAM})/updates",      _create_update),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/documents",    _project_documents),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/insights",     _project_insights),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/checkpoints",  _project_checkpoints),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})",              _get_project),
    ("PATCH",  rf"/api/projects/(?P<project_id>{PARAM})",              _update_project),
    ("DELETE", rf"/api/projects/(?P<project_id>{PARAM})",              _delete_project),
])
