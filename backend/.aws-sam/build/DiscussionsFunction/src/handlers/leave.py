"""Leave Lambda handler — /api/leave/*"""
import logging
from datetime import date, timedelta
from decimal import Decimal

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user, require_auth
from ..database import execute_returning, fetchall, fetchone, get_conn
from ..exceptions import HTTPError
from ..models.requests import CreateLeaveRequest, UpdateLeaveRequest

log = logging.getLogger(__name__)


def _calc_working_days(start: date, end: date) -> int:
    days = 0
    current = start
    while current <= end:
        if current.weekday() < 5:
            days += 1
        current += timedelta(days=1)
    return days


def _update_availability(conn, user_id: str, start: date, end: date, leave_id: str):
    current = start
    while current <= end:
        if current.weekday() < 5:
            conn.cursor().execute("""
                INSERT INTO team_availability (user_id, date, status, leave_request_id)
                VALUES (%s, %s, 'on_leave', %s)
                ON CONFLICT (user_id, date) DO UPDATE
                  SET status = 'on_leave', leave_request_id = EXCLUDED.leave_request_id
            """, (user_id, current, leave_id))
        current += timedelta(days=1)


# ── Static routes ─────────────────────────────────────────────────────────────

def _team_availability(event, origin):
    get_current_user(event)
    p = get_query(event)
    start_date = p.get("start_date")
    end_date   = p.get("end_date")
    if not start_date or not end_date:
        raise HTTPError(400, "start_date and end_date are required")
    rows = fetchall("""
        SELECT ta.*, u.name, u.department, u.avatar_color
        FROM team_availability ta
        JOIN users u ON u.id = ta.user_id
        WHERE ta.date BETWEEN %s AND %s
        ORDER BY ta.date, u.name
    """, (start_date, end_date))
    return resp({"availability": rows}, origin=origin)


def _leave_analytics(event, origin):
    get_current_user(event)
    rows = fetchall("""
        WITH fy_leave AS (
          SELECT lr.user_id, lr.type, SUM(lr.days) AS total_days
          FROM leave_requests lr
          WHERE lr.status = 'approved'
            AND lr.start_date >= date_trunc('year', CURRENT_DATE - INTERVAL '3 months') + INTERVAL '3 months'
          GROUP BY lr.user_id, lr.type
        )
        SELECT
          u.id, u.name, u.department, u.avatar_color,
          COALESCE(SUM(fl.total_days), 0)                                              AS total_leave_days,
          COALESCE(SUM(fl.total_days) FILTER (WHERE fl.type = 'planned'), 0)           AS planned_days,
          COALESCE(SUM(fl.total_days) FILTER (WHERE fl.type = 'sick'), 0)              AS sick_days,
          COALESCE(SUM(fl.total_days) FILTER (WHERE fl.type = 'personal'), 0)          AS personal_days,
          COALESCE(SUM(fl.total_days) FILTER (WHERE fl.type = 'wfh'), 0)               AS wfh_days,
          COALESCE(SUM(fl.total_days) FILTER (WHERE fl.type = 'half_day'), 0)          AS half_days
        FROM users u
        LEFT JOIN fy_leave fl ON fl.user_id = u.id
        WHERE u.is_active
        GROUP BY u.id
        ORDER BY total_leave_days DESC
    """)
    return resp({"analytics": rows}, origin=origin)


# ── Collection endpoints ──────────────────────────────────────────────────────

def _list_leave(event, origin):
    current_user = get_current_user(event)
    p = get_query(event)
    user_id = p.get("user_id")
    if current_user["role_type"] not in ("CEO", "Admin", "Team Lead"):
        user_id = current_user["id"]
    conds = ["1=1"]
    params: list = []
    if user_id:               conds.append("lr.user_id = %s");       params.append(user_id)
    if p.get("status"):       conds.append("lr.status = %s");        params.append(p["status"])
    if p.get("start_date"):   conds.append("lr.end_date >= %s");     params.append(p["start_date"])
    if p.get("end_date"):     conds.append("lr.start_date <= %s");   params.append(p["end_date"])
    rows = fetchall(f"""
        SELECT
          lr.*, u.name AS user_name, u.department, u.avatar_color,
          ab.name AS approved_by_name, cv.name AS cover_person_name
        FROM leave_requests lr
        JOIN users u ON u.id = lr.user_id
        LEFT JOIN users ab ON ab.id = lr.approved_by
        LEFT JOIN users cv ON cv.id = lr.cover_person_id
        WHERE {" AND ".join(conds)}
        ORDER BY lr.created_at DESC
    """, tuple(params))
    return resp({"leave": rows}, origin=origin)


def _create_leave(event, origin):
    current_user = get_current_user(event)
    body = CreateLeaveRequest(**get_body(event))
    days = _calc_working_days(body.start_date, body.end_date)
    if body.type == "half_day":
        days = Decimal("0.5")
    leave = execute_returning("""
        INSERT INTO leave_requests
          (user_id, type, start_date, end_date, days, reason,
           cover_person_id, coverage_plan, contingency_note, is_planned)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (
        current_user["id"], body.type, body.start_date, body.end_date, days,
        body.reason,
        str(body.cover_person_id) if body.cover_person_id else None,
        body.coverage_plan, body.contingency_note, body.is_planned,
    ))
    return resp({"leave": leave}, 201, origin)


# ── Single leave request ──────────────────────────────────────────────────────

def _get_leave(event, origin, leave_id):
    get_current_user(event)
    leave = fetchone("""
        SELECT lr.*, u.name AS user_name, u.department,
               ab.name AS approved_by_name, cv.name AS cover_person_name
        FROM leave_requests lr
        JOIN users u ON u.id = lr.user_id
        LEFT JOIN users ab ON ab.id = lr.approved_by
        LEFT JOIN users cv ON cv.id = lr.cover_person_id
        WHERE lr.id = %s
    """, (leave_id,))
    if not leave:
        raise HTTPError(404, "Leave request not found")
    return resp({"leave": leave}, origin=origin)


def _update_leave(event, origin, leave_id):
    current_user = get_current_user(event)
    if current_user["role_type"] not in ("CEO", "Admin", "Team Lead"):
        raise HTTPError(403, "Only leads can approve leave")
    leave = fetchone("SELECT * FROM leave_requests WHERE id = %s", (leave_id,))
    if not leave:
        raise HTTPError(404, "Leave request not found")
    body = UpdateLeaveRequest(**get_body(event))
    with get_conn() as conn:
        cur = conn.cursor()
        cur.execute("""
            UPDATE leave_requests
            SET status = %s, approved_by = %s, approved_at = NOW(),
                cover_person_id = COALESCE(%s, cover_person_id),
                coverage_plan = COALESCE(%s, coverage_plan),
                updated_at = NOW()
            WHERE id = %s
        """, (
            body.status, current_user["id"],
            str(body.cover_person_id) if body.cover_person_id else None,
            body.coverage_plan, leave_id,
        ))
        if body.status == "approved":
            _update_availability(conn, leave["user_id"],
                                 leave["start_date"], leave["end_date"], leave_id)
    updated = fetchone("SELECT * FROM leave_requests WHERE id = %s", (leave_id,))
    return resp({"leave": updated}, origin=origin)


# Static routes BEFORE dynamic /<leave_id>
handler = make_handler([
    ("GET",   r"/api/leave/availability/team",              _team_availability),
    ("GET",   r"/api/leave/analytics/summary",              _leave_analytics),
    ("GET",   r"/api/leave",                                _list_leave),
    ("POST",  r"/api/leave",                                _create_leave),
    ("GET",   rf"/api/leave/(?P<leave_id>{PARAM})",         _get_leave),
    ("PATCH", rf"/api/leave/(?P<leave_id>{PARAM})",         _update_leave),
])
