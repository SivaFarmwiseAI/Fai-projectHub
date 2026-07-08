"""Analytics Lambda handler — /api/analytics/*"""
import logging
import re
from datetime import date

_UUID_RE = re.compile(
    r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    re.IGNORECASE,
)

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user
from ..config import get_settings
from ..database import call_fn, execute, fetchall, fetchone, refresh_views
from ..exceptions import HTTPError

log = logging.getLogger(__name__)


def _dashboard(event, origin):
    get_current_user(event)
    return resp(call_fn("fn_dashboard_stats") or {}, origin=origin)


def _team_health(event, origin):
    get_current_user(event)
    return resp(
        call_fn("fn_team_health") or {"team_health": [], "avg_team_health": 0, "critical_members": 0},
        origin=origin,
    )


def _workload(event, origin):
    get_current_user(event)
    return resp(call_fn("fn_workload_distribution") or {"workload": []}, origin=origin)


def _velocity(event, origin):
    get_current_user(event)
    days = int(get_query(event).get("days", 30))
    days = max(7, min(days, 90))
    return resp(call_fn("fn_velocity", days) or {"velocity": []}, origin=origin)


def _ceo_briefing(event, origin):
    get_current_user(event)
    return resp(call_fn("fn_ceo_briefing") or {}, origin=origin)


def _leave_analytics(event, origin):
    get_current_user(event)
    return resp(call_fn("fn_leave_analytics") or {"analytics": []}, origin=origin)


def _projects_overview(event, origin):
    get_current_user(event)
    rows = fetchall("""
        SELECT
          type,
          COUNT(*) FILTER (WHERE status = 'active')    AS active,
          COUNT(*) FILTER (WHERE status = 'completed') AS completed,
          COUNT(*) FILTER (WHERE status = 'killed')    AS killed,
          COUNT(*) FILTER (WHERE status = 'paused')    AS paused,
          COUNT(*)                                      AS total,
          ROUND(AVG(completion_pct), 0)                AS avg_completion_pct
        FROM mv_project_summary
        GROUP BY type
        ORDER BY total DESC
    """)
    return resp({"breakdown": rows}, origin=origin)


def _team_standup(event, origin):
    get_current_user(event)
    target_str = get_query(event).get("date")
    target = date.fromisoformat(target_str) if target_str else date.today()
    entries = fetchall("""
        SELECT se.*, u.name, u.department, u.avatar_color
        FROM standup_entries se
        JOIN users u ON u.id = se.user_id
        WHERE se.date = %s
        ORDER BY u.name
    """, (target,))
    return resp({"date": str(target), "entries": entries}, origin=origin)


# ── Notifications ─────────────────────────────────────────────────────────────

def _mark_all_read(event, origin):
    current_user = get_current_user(event)
    execute(
        "UPDATE notifications SET is_read = TRUE WHERE user_id = %s AND NOT is_read",
        (current_user["id"],)
    )
    return resp({"ok": True}, origin=origin)


def _my_notifications(event, origin):
    current_user = get_current_user(event)
    p = get_query(event)
    unread_only = p.get("unread_only", "").lower() == "true"
    limit = min(int(p.get("limit", 20)), 100)
    cond = "AND NOT is_read" if unread_only else ""
    rows = fetchall(f"""
        SELECT * FROM notifications
        WHERE user_id = %s {cond}
        ORDER BY created_at DESC LIMIT %s
    """, (current_user["id"], limit))
    unread = fetchone(
        "SELECT COUNT(*) AS n FROM notifications WHERE user_id = %s AND NOT is_read",
        (current_user["id"],)
    )
    return resp({"notifications": rows, "unread_count": (unread or {}).get("n", 0)}, origin=origin)


def _mark_read(event, origin, notif_id):
    current_user = get_current_user(event)
    execute(
        "UPDATE notifications SET is_read = TRUE WHERE id = %s AND user_id = %s",
        (notif_id, current_user["id"])
    )
    return resp({"ok": True}, origin=origin)


# ── Public Notifications (API Key — no JWT required) ─────────────────────────

def _validate_api_key(event):
    headers = event.get("headers") or {}
    key = headers.get("x-api-key") or headers.get("X-Api-Key", "")
    if key != get_settings().public_api_key:
        raise HTTPError(401, "Invalid API key")


# Roles whose team view spans everything vs. their own reports/projects.
_VIEW_ALL_ROLES = ("CEO", "Admin")
_TEAM_LEAD_ROLES = ("Team Lead", "Leadership")


def _require_scope(event):
    """Validate and return the (applicationId, userId) scope query params.

    userId is mandatory — every public route is scoped to one user so a
    caller can never mutate another tenant's rows. applicationId (= project
    UUID) is an optional filter: leave and other non-project notifications
    have a NULL application_id and are only reachable without it.
    """
    p = get_query(event)
    application_id = p.get("applicationId", "")
    user_id = p.get("userId", "")
    if not user_id:
        raise HTTPError(400, "userId is required")
    if not _UUID_RE.match(user_id):
        raise HTTPError(400, "userId must be a valid UUID")
    if application_id and not _UUID_RE.match(application_id):
        raise HTTPError(400, "applicationId must be a valid project UUID")
    return (application_id or None), user_id


def _public_notifications(event, origin):
    _validate_api_key(event)
    application_id, user_id = _require_scope(event)
    p = get_query(event)
    unread_only = p.get("unread_only", "").lower() == "true"
    team_view = p.get("view", "") == "team"
    limit = min(int(p.get("limit", 50)), 100)

    conds = []
    params: list = []
    if team_view:
        role = (fetchone(
            "SELECT role_type FROM users WHERE id = %s", (user_id,)
        ) or {}).get("role_type")
        if role in _VIEW_ALL_ROLES:
            pass  # no user restriction — CEO/Admin see everything
        elif role in _TEAM_LEAD_ROLES:
            # Own rows + direct reports' rows + rows on the lead's projects.
            conds.append("""(
                n.user_id = %s
                OR n.user_id IN (SELECT id FROM users WHERE manager_id = %s)
                OR n.application_id IN
                   (SELECT project_id FROM project_assignees WHERE user_id = %s)
            )""")
            params.extend([user_id, user_id, user_id])
        else:
            conds.append("n.user_id = %s")  # silent fallback to own-only
            params.append(user_id)
    else:
        conds.append("n.user_id = %s")
        params.append(user_id)
    if application_id:
        # Rows tied to a project must match the sent applicationId; rows
        # with no project (leave etc.) don't depend on it and always pass.
        conds.append("(n.application_id IS NULL OR n.application_id = %s)")
        params.append(application_id)
    if unread_only:
        conds.append("NOT n.is_read")
    params.append(limit)

    rows = fetchall(f"""
        SELECT n.*, u.name AS user_name, p.title AS project_title
        FROM notifications n
        JOIN users u ON u.id = n.user_id
        LEFT JOIN projects p ON p.id = n.application_id
        WHERE {" AND ".join(conds) if conds else "TRUE"}
        ORDER BY n.created_at DESC LIMIT %s
    """, tuple(params))
    # Badge semantics: only the caller's own unread, never team rows —
    # and the same applicationId rule as the list (project rows must
    # match; NULL-app rows like leave always count) so badge == list.
    unread_cond = (
        "AND (application_id IS NULL OR application_id = %s)"
        if application_id else ""
    )
    unread_params = (user_id, application_id) if application_id else (user_id,)
    unread = fetchone(f"""
        SELECT COUNT(*) AS n FROM notifications
        WHERE user_id = %s AND NOT is_read {unread_cond}
    """, unread_params)
    return resp(
        {"notifications": rows, "unread_count": (unread or {}).get("n", 0)},
        origin=origin,
    )


def _public_mark_read(event, origin, notif_id):
    _validate_api_key(event)
    _application_id, user_id = _require_scope(event)
    if not _UUID_RE.match(notif_id):
        raise HTTPError(400, "Invalid notification id")
    # user_id scoping doubles as the read-only team view: a lead can see
    # reports' rows but can only mutate their own.
    execute("""
        UPDATE notifications SET is_read = TRUE
        WHERE id = %s AND user_id = %s
    """, (notif_id, user_id))
    return resp({"ok": True}, origin=origin)


def _public_delete_notification(event, origin, notif_id):
    _validate_api_key(event)
    _application_id, user_id = _require_scope(event)
    if not _UUID_RE.match(notif_id):
        raise HTTPError(400, "Invalid notification id")
    execute("""
        DELETE FROM notifications
        WHERE id = %s AND user_id = %s
    """, (notif_id, user_id))
    return resp({"ok": True}, origin=origin)


def _public_create_notification(event, origin):
    _validate_api_key(event)
    from uuid import uuid4
    body = get_body(event)
    application_id = body.get("applicationId", "")
    user_id = body.get("userId", "")
    if not application_id or not user_id or not body.get("title"):
        raise HTTPError(400, "applicationId, userId and title are required")
    if not _UUID_RE.match(application_id):
        raise HTTPError(400, "applicationId must be a valid project UUID")
    if not _UUID_RE.match(user_id):
        raise HTTPError(400, "userId must be a valid UUID")
    notif_id = str(uuid4())
    execute("""
        INSERT INTO notifications
            (id, user_id, application_id, type, title, message)
        VALUES (%s, %s, %s, %s, %s, %s)
    """, (
        notif_id,
        user_id,
        application_id,
        body.get("type", "info"),
        body.get("title", ""),
        body.get("message", ""),
    ))
    return resp({"ok": True, "id": notif_id}, origin=origin)


# ── Admin ─────────────────────────────────────────────────────────────────────

def _refresh_views(event, origin):
    current_user = get_current_user(event)
    if current_user["role_type"] not in ("CEO", "Admin"):
        raise HTTPError(403, "Admin only")
    result = refresh_views()
    return resp({"result": result}, origin=origin)


# All static multi-segment paths BEFORE any dynamic /<param> routes
handler = make_handler([
    ("GET",    r"/api/analytics/dashboard",                                      _dashboard),
    ("GET",    r"/api/analytics/team-health",                                    _team_health),
    ("GET",    r"/api/analytics/workload",                                       _workload),
    ("GET",    r"/api/analytics/velocity",                                       _velocity),
    ("GET",    r"/api/analytics/briefing",                                       _ceo_briefing),
    ("GET",    r"/api/analytics/leave-analytics",                                _leave_analytics),
    ("GET",    r"/api/analytics/projects/overview",                              _projects_overview),
    ("GET",    r"/api/analytics/standup/team",                                   _team_standup),
    ("POST",   r"/api/analytics/notifications/read-all",                         _mark_all_read),
    ("GET",    r"/api/analytics/notifications",                                  _my_notifications),
    ("POST",   rf"/api/analytics/notifications/(?P<notif_id>{PARAM})/read",      _mark_read),
    ("POST",   r"/api/analytics/refresh-views",                                  _refresh_views),
    # ── Public endpoints (API key auth, no JWT needed) ──
    ("GET",    r"/api/public/notifications",                                     _public_notifications),
    ("POST",   r"/api/public/notifications",                                     _public_create_notification),
    ("POST",   rf"/api/public/notifications/(?P<notif_id>{PARAM})/read",         _public_mark_read),
    ("DELETE", rf"/api/public/notifications/(?P<notif_id>{PARAM})",              _public_delete_notification),
])
