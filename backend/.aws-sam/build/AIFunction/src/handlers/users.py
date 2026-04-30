"""Users Lambda handler — /api/users/*"""
import logging

from .base import PARAM, err, get_body, get_query, make_handler, resp
from ..auth import get_current_user, hash_password, require_auth
from ..database import call_fn, execute, execute_returning, fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import CreateUserRequest, UpdateUserRequest

log = logging.getLogger(__name__)


def _create_user(event, origin):
    require_auth(event, "CEO", "Admin")
    body = CreateUserRequest(**get_body(event))
    if fetchone("SELECT id FROM users WHERE email = %s", (str(body.email),)):
        raise HTTPError(409, "Email already registered")
    user = execute_returning("""
        INSERT INTO users (name, email, password_hash, role, role_type, department, avatar_color)
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id, name, email, role, role_type, department, avatar_color, created_at
    """, (body.name, str(body.email), hash_password(body.password),
          body.role, body.role_type, body.department, body.avatar_color))
    return resp({"user": user}, 201, origin)


def _list_users(event, origin):
    get_current_user(event)
    p = get_query(event)
    is_active = p.get("is_active", "true").lower() != "false"

    conds = ["u.is_active = %s"]
    params: list = [is_active]
    if p.get("department"): conds.append("u.department = %s"); params.append(p["department"])
    if p.get("role_type"):  conds.append("u.role_type = %s");  params.append(p["role_type"])

    rows = fetchall(f"""
        SELECT
          u.id, u.name, u.role, u.role_type, u.department,
          u.avatar_color, u.is_active, u.email, u.created_at,
          COALESCE(ts.active_tasks, 0)        AS active_tasks,
          COALESCE(ts.completed_tasks, 0)     AS completed_tasks,
          COALESCE(ts.blocked_tasks, 0)       AS blocked_tasks,
          COALESCE(ts.total_hours_logged, 0)  AS total_hours_logged,
          COALESCE(ts.avg_hours_ratio, 0)     AS avg_hours_ratio,
          COALESCE(ts.project_count, 0)       AS project_count,
          COALESCE(ts.active_project_count, 0) AS active_project_count,
          ts.avg_mood,
          ts.health_score
        FROM users u
        LEFT JOIN mv_team_stats ts ON ts.id = u.id
        WHERE {" AND ".join(conds)}
        ORDER BY u.name
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
    # Only CEO/Admin can elevate role_type
    if "role_type" in fields and current_user["role_type"] not in ("CEO", "Admin"):
        del fields["role_type"]
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


def _list_departments(event, origin):
    get_current_user(event)
    rows = fetchall("""
        SELECT d.id, d.name, d.description, d.color, d.is_active,
               u.name AS head_name,
               COUNT(DISTINCT usr.id) FILTER (WHERE usr.is_active) AS member_count
        FROM   departments d
        LEFT   JOIN users u   ON u.id = d.head_id
        LEFT   JOIN users usr ON usr.department_id = d.id
        WHERE  d.is_active = TRUE
        GROUP  BY d.id, d.name, d.description, d.color, d.is_active, u.name
        ORDER  BY d.name
    """)
    return resp({"departments": rows}, origin=origin)


def _create_department(event, origin):
    require_auth(event, "CEO", "Admin")
    body = get_body(event)
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPError(400, "name is required")
    existing = fetchone("SELECT id FROM departments WHERE name = %s", (name,))
    if existing:
        raise HTTPError(409, "Department already exists")
    dept = execute_returning("""
        INSERT INTO departments (name, description, color, head_id)
        VALUES (%s, %s, %s, %s)
        RETURNING id, name, description, color, head_id, is_active, created_at
    """, (name, body.get("description"), body.get("color", "#6366f1"), body.get("head_id")))
    return resp({"department": dept}, 201, origin)


def _list_roles(event, origin):
    get_current_user(event)
    rows = fetchall("""
        SELECT r.id, r.name, r.description, r.is_active,
               d.name AS department_name, d.id AS department_id,
               COUNT(DISTINCT u.id) FILTER (WHERE u.is_active) AS member_count
        FROM   roles r
        LEFT   JOIN departments d ON d.id = r.department_id
        LEFT   JOIN users u ON u.role = r.name
        WHERE  r.is_active = TRUE
        GROUP  BY r.id, r.name, r.description, r.is_active, d.name, d.id
        ORDER  BY r.name
    """)
    return resp({"roles": rows}, origin=origin)


def _create_role(event, origin):
    require_auth(event, "CEO", "Admin")
    body = get_body(event)
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPError(400, "name is required")
    existing = fetchone("SELECT id FROM roles WHERE name = %s", (name,))
    if existing:
        raise HTTPError(409, "Role already exists")
    role = execute_returning("""
        INSERT INTO roles (name, description, department_id)
        VALUES (%s, %s, %s)
        RETURNING id, name, description, department_id, is_active, created_at
    """, (name, body.get("description"), body.get("department_id")))
    return resp({"role": role}, 201, origin)


handler = make_handler([
    ("POST",   r"/api/users",                            _create_user),
    ("GET",    r"/api/users",                            _list_users),
    ("GET",    r"/api/departments",                      _list_departments),
    ("POST",   r"/api/departments",                      _create_department),
    ("GET",    r"/api/roles",                            _list_roles),
    ("POST",   r"/api/roles",                            _create_role),
    ("GET",    rf"/api/users/(?P<user_id>{PARAM})/tasks", _user_tasks),
    ("GET",    rf"/api/users/(?P<user_id>{PARAM})/leave", _user_leave),
    ("GET",    rf"/api/users/(?P<user_id>{PARAM})",       _get_user),
    ("PATCH",  rf"/api/users/(?P<user_id>{PARAM})",       _update_user),
    ("DELETE", rf"/api/users/(?P<user_id>{PARAM})",       _deactivate_user),
])
