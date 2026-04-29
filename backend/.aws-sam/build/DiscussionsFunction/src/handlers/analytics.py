"""Analytics Lambda handler — /api/analytics/*"""
import logging
from datetime import date

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user
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


# ── Admin ─────────────────────────────────────────────────────────────────────

def _refresh_views(event, origin):
    current_user = get_current_user(event)
    if current_user["role_type"] not in ("CEO", "Admin"):
        raise HTTPError(403, "Admin only")
    result = refresh_views()
    return resp({"result": result}, origin=origin)


# All static multi-segment paths BEFORE any dynamic /<param> routes
handler = make_handler([
    ("GET",  r"/api/analytics/dashboard",                                    _dashboard),
    ("GET",  r"/api/analytics/team-health",                                  _team_health),
    ("GET",  r"/api/analytics/workload",                                     _workload),
    ("GET",  r"/api/analytics/velocity",                                     _velocity),
    ("GET",  r"/api/analytics/briefing",                                     _ceo_briefing),
    ("GET",  r"/api/analytics/leave-analytics",                              _leave_analytics),
    ("GET",  r"/api/analytics/projects/overview",                            _projects_overview),
    ("GET",  r"/api/analytics/standup/team",                                 _team_standup),
    ("POST", r"/api/analytics/notifications/read-all",                       _mark_all_read),
    ("GET",  r"/api/analytics/notifications",                                _my_notifications),
    ("POST", rf"/api/analytics/notifications/(?P<notif_id>{PARAM})/read",    _mark_read),
    ("POST", r"/api/analytics/refresh-views",                                _refresh_views),
])
