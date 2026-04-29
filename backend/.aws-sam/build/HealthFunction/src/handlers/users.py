"""Users Lambda handler — /api/users/*"""
import logging

from .base import PARAM, err, get_body, get_query, make_handler, resp
from ..auth import get_current_user, hash_password, require_auth
from ..database import call_fn, execute, execute_returning, fetchall
from ..exceptions import HTTPError
from ..models.requests import UpdateUserRequest

log = logging.getLogger(__name__)


def _list_users(event, origin):
    get_current_user(event)
    p = get_query(event)
    is_active = p.get("is_active", "true").lower() != "false"

    conds = ["ts.is_active = %s"]
    params: list = [is_active]
    if p.get("department"): conds.append("ts.department = %s"); params.append(p["department"])
    if p.get("role_type"):  conds.append("ts.role_type = %s");  params.append(p["role_type"])

    rows = fetchall(f"""
        SELECT
          ts.id, ts.name, ts.role, ts.role_type, ts.department,
          ts.avatar_color, ts.is_active,
          ts.active_tasks, ts.completed_tasks, ts.blocked_tasks,
          ts.total_hours_logged, ts.avg_hours_ratio,
          ts.project_count, ts.active_project_count,
          ts.avg_mood, ts.health_score,
          u.email, u.created_at
        FROM mv_team_stats ts
        JOIN users u ON u.id = ts.id
        WHERE {" AND ".join(conds)}
        ORDER BY ts.name
    """, tuple(params))
    return resp({"users": rows}, origin=origin)


def _get_user(event, origin, user_id):
    get_current_user(event)
    data = call_fn("fn_user_full", user_id)
    if not data:
        raise HTTPError(404, "User not found")
    return resp({"user": data}, origin=origin)


def _update_user(event, origin, user_id):
    current_user = get_current_user(event)
    if user_id != current_user["id"] and current_user["role_type"] not in ("CEO", "Admin"):
        raise HTTPError(403, "Cannot update another user")
    body = UpdateUserRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPError(400, "No fields to update")
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    updated = execute_returning(
        f"UPDATE users SET {set_clause}, updated_at = NOW() WHERE id = %s "
        f"RETURNING id, name, email, role, role_type, department, avatar_color, updated_at",
        list(fields.values()) + [user_id],
    )
    if not updated:
        raise HTTPError(404, "User not found")
    return resp({"user": updated}, origin=origin)


def _deactivate_user(event, origin, user_id):
    require_auth(event, "CEO", "Admin")
    execute("UPDATE users SET is_active = FALSE WHERE id = %s", (user_id,))
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


def _user_tasks(event, origin, user_id):
    get_current_user(event)
    p = get_query(event)
    status = p.get("status")
    sql_params: list = [user_id]
    cond = ""
    if status:
        cond = "AND t.status = %s"
        sql_params.append(status)
    tasks = fetchall(f"""
        SELECT t.*, pr.title AS project_title, ph.phase_name
        FROM tasks t
        JOIN projects pr ON pr.id = t.project_id
        LEFT JOIN phases ph ON ph.id = t.phase_id
        WHERE t.assignee_id = %s {cond}
        ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.created_at DESC
    """, tuple(sql_params))
    return resp({"tasks": tasks}, origin=origin)


def _user_leave(event, origin, user_id):
    get_current_user(event)
    leave = fetchall("""
        SELECT lr.*, u.name AS approved_by_name
        FROM leave_requests lr
        LEFT JOIN users u ON u.id = lr.approved_by
        WHERE lr.user_id = %s ORDER BY lr.start_date DESC
    """, (user_id,))
    return resp({"leave": leave}, origin=origin)


handler = make_handler([
    ("GET",    r"/api/users",                            _list_users),
    ("GET",    rf"/api/users/(?P<user_id>{PARAM})/tasks", _user_tasks),
    ("GET",    rf"/api/users/(?P<user_id>{PARAM})/leave", _user_leave),
    ("GET",    rf"/api/users/(?P<user_id>{PARAM})",       _get_user),
    ("PATCH",  rf"/api/users/(?P<user_id>{PARAM})",       _update_user),
    ("DELETE", rf"/api/users/(?P<user_id>{PARAM})",       _deactivate_user),
])
