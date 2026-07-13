"""Performance Assessments Lambda handler — /api/performance-assessments/*

The 360° review module has three actors per subject:
  kind='self'    — the employee's own submission (full form snapshot in `data`).
  kind='peer'    — nominated colleagues' reviews. Created as pending stubs at
                   self-assessment time, filled in via PATCH. `data` holds
                   {answers: {<question_key>: text}, overall: 1..5} matching
                   PEER_QUESTIONS in src/lib/performance.ts.
  kind='manager' — the reporting manager's authoritative review (same shape).

Visibility model:
  - CEO / Admin / HR / Leadership ("full access") see everything.
  - CEO / Admin / HR manage cycles and the reporting tree.
  - Team Leads (and any manager) see their direct + indirect reports.
  - Everyone sees their own assessments and reviews assigned to them.
"""
import logging

from .base import PARAM, get_body, get_query, make_handler, resp
from ._notify import notify
from ..auth import get_current_user
from ..database import execute, execute_returning, fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import (
    CreatePerformanceAssessmentRequest,
    CreateReviewCycleRequest,
    SetManagerRequest,
    UpdatePerformanceAssessmentRequest,
    UpdateReviewCycleRequest,
)

log = logging.getLogger(__name__)

FULL_ACCESS    = ("CEO", "Admin", "HR", "Leadership")
CYCLE_MANAGERS = ("CEO", "Admin", "HR")

# Row projection for list views — everything except the heavy `data` snapshot.
ROW_COLS = """
    pa.id, pa.employee_name, pa.subject_user_id, pa.designation, pa.review_period,
    pa.career_level, pa.filled_by, pa.kind, pa.status, pa.cycle_id,
    pa.role_areas, pa.total_score, pa.rating_band, pa.severity, pa.capped, pa.created_at,
    su.avatar_color AS employee_color,
    rc.name AS cycle_name,
    sb.name AS submitted_by_name
"""

ROW_JOINS = """
    LEFT JOIN users su ON su.id = pa.subject_user_id
    LEFT JOIN review_cycles rc ON rc.id = pa.cycle_id
    LEFT JOIN users sb ON sb.id = pa.submitted_by
"""


def _is_full(user: dict) -> bool:
    return user["role_type"] in FULL_ACCESS


def _is_manager_of(manager_id: str, subject_id: str) -> bool:
    """True when `manager_id` is anywhere up `subject_id`'s reporting chain."""
    row = fetchone("""
        WITH RECURSIVE chain AS (
          SELECT manager_id, 1 AS depth FROM users WHERE id = %s
          UNION ALL
          SELECT u.manager_id, c.depth + 1
          FROM users u JOIN chain c ON u.id = c.manager_id
          WHERE c.manager_id IS NOT NULL AND c.depth < 20
        )
        SELECT 1 AS hit FROM chain WHERE manager_id = %s LIMIT 1
    """, (subject_id, manager_id))
    return bool(row)


# ── Static routes FIRST ───────────────────────────────────────────────────────

def _analysis(event, origin):
    """Org-wide leadership analysis over self-assessments."""
    user = get_current_user(event)
    if not _is_full(user):
        raise HTTPError(403, "Insufficient permissions")
    cycle_id = get_query(event).get("cycle_id")
    cyc, params = ("AND pa.cycle_id = %s", [cycle_id]) if cycle_id else ("", [])

    totals = fetchone(f"""
        SELECT
          COUNT(*) FILTER (WHERE pa.kind = 'self')                            AS submissions,
          COUNT(DISTINCT pa.subject_user_id) FILTER (WHERE pa.kind = 'self')  AS employees,
          ROUND(AVG(pa.total_score) FILTER (WHERE pa.kind = 'self' AND pa.status = 'submitted'), 2) AS avg_total,
          COUNT(*) FILTER (WHERE pa.kind = 'self' AND pa.severity <> 'none')  AS flagged,
          COUNT(*) FILTER (WHERE pa.kind IN ('peer','manager'))               AS peer_reviews,
          COUNT(*) FILTER (WHERE pa.kind IN ('peer','manager') AND pa.status = 'pending') AS peer_pending
        FROM performance_assessments pa
        WHERE 1=1 {cyc}
    """, tuple(params)) or {}

    bands = fetchall(f"""
        SELECT pa.rating_band AS band, COUNT(*) AS count
        FROM performance_assessments pa
        WHERE pa.kind = 'self' AND pa.rating_band IS NOT NULL {cyc}
        GROUP BY pa.rating_band ORDER BY COUNT(*) DESC
    """, tuple(params))

    by_role = fetchall(f"""
        SELECT area AS key, COUNT(*) AS count, ROUND(AVG(pa.total_score), 2) AS avg_total
        FROM performance_assessments pa, UNNEST(pa.role_areas) AS area
        WHERE pa.kind = 'self' {cyc}
        GROUP BY area ORDER BY COUNT(*) DESC
    """, tuple(params))

    by_level = fetchall(f"""
        SELECT pa.career_level AS key, COUNT(*) AS count, ROUND(AVG(pa.total_score), 2) AS avg_total
        FROM performance_assessments pa
        WHERE pa.kind = 'self' {cyc}
        GROUP BY pa.career_level ORDER BY COUNT(*) DESC
    """, tuple(params))

    recent = fetchall(f"""
        SELECT {ROW_COLS}
        FROM performance_assessments pa {ROW_JOINS}
        WHERE pa.kind = 'self' {cyc}
        ORDER BY pa.created_at DESC LIMIT 10
    """, tuple(params))

    return resp({"analysis": {
        "totals": totals,
        "band_distribution": bands,
        "by_role_area": by_role,
        "by_level": by_level,
        "recent": recent,
    }}, origin=origin)


def _my_reviews(event, origin):
    """Peer/manager reviews the current user has been asked to write."""
    user = get_current_user(event)
    status = get_query(event).get("status")
    st, params = ("AND pa.status = %s", [user["id"], status]) if status else ("", [user["id"]])
    rows = fetchall(f"""
        SELECT
          pa.id, pa.kind, pa.status, pa.cycle_id, pa.review_period,
          pa.total_score, pa.rating_band, pa.created_at, pa.submitted_at,
          rc.name AS cycle_name,
          su.id AS subject_id, su.name AS subject_name, su.avatar_color AS subject_color,
          su.role AS subject_role, su.department AS subject_department,
          nb.name AS nominated_by_name
        FROM performance_assessments pa
        LEFT JOIN users su ON su.id = pa.subject_user_id
        LEFT JOIN users nb ON nb.id = pa.nominated_by
        LEFT JOIN review_cycles rc ON rc.id = pa.cycle_id
        WHERE pa.author_user_id = %s AND pa.kind IN ('peer','manager') {st}
        ORDER BY (pa.status = 'pending') DESC, pa.created_at DESC
    """, tuple(params))
    return resp({"reviews": rows}, origin=origin)


def _my_assessments(event, origin):
    """The current user's own self-assessments + reviews written about them."""
    user = get_current_user(event)
    assessments = fetchall(f"""
        SELECT {ROW_COLS},
          (SELECT COUNT(*) FROM performance_assessments p2
            WHERE p2.kind = 'peer' AND p2.subject_user_id = pa.subject_user_id
              AND p2.cycle_id IS NOT DISTINCT FROM pa.cycle_id) AS peer_count
        FROM performance_assessments pa {ROW_JOINS}
        WHERE pa.kind = 'self' AND pa.subject_user_id = %s
        ORDER BY pa.created_at DESC
    """, (user["id"],))
    received = fetchall("""
        SELECT pa.id, pa.kind, pa.status, pa.total_score, pa.rating_band,
               pa.created_at, pa.submitted_at,
               au.name AS author_name, au.avatar_color AS author_color
        FROM performance_assessments pa
        LEFT JOIN users au ON au.id = pa.author_user_id
        WHERE pa.subject_user_id = %s AND pa.kind IN ('peer','manager')
        ORDER BY pa.created_at DESC
    """, (user["id"],))
    return resp({"assessments": assessments, "reviews_received": received}, origin=origin)


def _team(event, origin):
    """Direct + indirect reports (full-access roles see the whole org)."""
    user = get_current_user(event)
    cycle_id = get_query(event).get("cycle_id")
    cyc = "AND pa.cycle_id = %s" if cycle_id else ""

    if _is_full(user):
        seed = "SELECT id, name, avatar_color, role, department, 0 AS depth FROM users WHERE is_active AND manager_id IS NULL"
        seed_params: list = []
    else:
        seed = "SELECT id, name, avatar_color, role, department, 1 AS depth FROM users WHERE is_active AND manager_id = %s"
        seed_params = [user["id"]]

    # One optional cycle param per lateral subquery, in order of appearance.
    params = seed_params + ([cycle_id] * 3 if cycle_id else [])
    rows = fetchall(f"""
        WITH RECURSIVE tree AS (
          {seed}
          UNION ALL
          SELECT u.id, u.name, u.avatar_color, u.role, u.department, t.depth + 1
          FROM users u JOIN tree t ON u.manager_id = t.id
          WHERE u.is_active AND t.depth < 20
        )
        SELECT
          t.id, t.name, t.avatar_color, t.role, t.department, t.depth,
          s.id AS self_id, s.total_score, s.rating_band, s.severity,
          s.status AS self_status,
          COALESCE(pc.done, 0)  AS peer_done,
          COALESCE(pc.total, 0) AS peer_total,
          m.status AS manager_status
        FROM tree t
        LEFT JOIN LATERAL (
          SELECT pa.id, pa.total_score, pa.rating_band, pa.severity, pa.status
          FROM performance_assessments pa
          WHERE pa.kind = 'self' AND pa.subject_user_id = t.id {cyc}
          ORDER BY pa.created_at DESC LIMIT 1
        ) s ON TRUE
        LEFT JOIN LATERAL (
          SELECT COUNT(*) FILTER (WHERE pa.status = 'submitted') AS done, COUNT(*) AS total
          FROM performance_assessments pa
          WHERE pa.kind = 'peer' AND pa.subject_user_id = t.id {cyc}
        ) pc ON TRUE
        LEFT JOIN LATERAL (
          SELECT pa.status
          FROM performance_assessments pa
          WHERE pa.kind = 'manager' AND pa.subject_user_id = t.id {cyc}
          ORDER BY pa.created_at DESC LIMIT 1
        ) m ON TRUE
        ORDER BY t.depth, t.name
    """, tuple(params))
    return resp({"reports": rows}, origin=origin)


def _report(event, origin, subject_id):
    """Full 360° report for one employee: self + peers + manager review."""
    user = get_current_user(event)
    if not (_is_full(user) or user["id"] == subject_id or _is_manager_of(user["id"], subject_id)):
        raise HTTPError(403, "You can only view reports for your own team")

    cycle_id = get_query(event).get("cycle_id")
    cyc, cyc_params = ("AND pa.cycle_id = %s", [cycle_id]) if cycle_id else ("", [])

    subject = fetchone("""
        SELECT u.id, u.name, u.role, u.department, u.avatar_color, u.manager_id,
               m.name AS manager_name
        FROM users u LEFT JOIN users m ON m.id = u.manager_id
        WHERE u.id = %s
    """, (subject_id,))
    if not subject:
        raise HTTPError(404, "Employee not found")

    self_row = fetchone(f"""
        SELECT pa.id, pa.total_score, pa.individual_score, pa.team_score, pa.org_score,
               pa.culture_score, pa.rating_band, pa.severity, pa.capped, pa.career_level,
               pa.role_areas, pa.review_period, pa.data, pa.status, pa.created_at
        FROM performance_assessments pa
        WHERE pa.kind = 'self' AND pa.subject_user_id = %s {cyc}
        ORDER BY pa.created_at DESC LIMIT 1
    """, tuple([subject_id] + cyc_params))

    peers = fetchall(f"""
        SELECT pa.id, pa.status, pa.total_score, pa.rating_band, pa.data,
               pa.created_at, pa.submitted_at,
               au.name AS author_name, au.avatar_color AS author_color, au.role AS author_role
        FROM performance_assessments pa
        LEFT JOIN users au ON au.id = pa.author_user_id
        WHERE pa.kind = 'peer' AND pa.subject_user_id = %s {cyc}
        ORDER BY pa.created_at
    """, tuple([subject_id] + cyc_params))

    manager = fetchone(f"""
        SELECT pa.id, pa.status, pa.total_score, pa.rating_band, pa.data,
               pa.created_at, pa.submitted_at,
               au.name AS author_name, au.avatar_color AS author_color, au.role AS author_role
        FROM performance_assessments pa
        LEFT JOIN users au ON au.id = pa.author_user_id
        WHERE pa.kind = 'manager' AND pa.subject_user_id = %s {cyc}
        ORDER BY pa.created_at DESC LIMIT 1
    """, tuple([subject_id] + cyc_params))

    return resp({"report": {
        "subject": subject,
        "self": self_row,
        "peers": peers,
        "manager": manager,
    }}, origin=origin)


# ── Review cycles ─────────────────────────────────────────────────────────────

CYCLE_COUNTS = """
    (SELECT COUNT(*) FROM performance_assessments p WHERE p.cycle_id = rc.id AND p.kind = 'self')    AS self_count,
    (SELECT COUNT(*) FROM performance_assessments p WHERE p.cycle_id = rc.id AND p.kind = 'peer')    AS peer_count,
    (SELECT COUNT(*) FROM performance_assessments p WHERE p.cycle_id = rc.id AND p.kind = 'peer'    AND p.status = 'pending') AS peer_pending,
    (SELECT COUNT(*) FROM performance_assessments p WHERE p.cycle_id = rc.id AND p.kind = 'manager') AS manager_count,
    (SELECT COUNT(*) FROM performance_assessments p WHERE p.cycle_id = rc.id AND p.kind = 'manager' AND p.status = 'pending') AS manager_pending
"""


def _active_cycle(event, origin):
    get_current_user(event)
    cycle = fetchone("SELECT rc.* FROM review_cycles rc WHERE rc.status = 'open' ORDER BY rc.updated_at DESC LIMIT 1")
    return resp({"cycle": cycle}, origin=origin)


def _list_cycles(event, origin):
    get_current_user(event)
    cycles = fetchall(f"""
        SELECT rc.*, cb.name AS created_by_name, {CYCLE_COUNTS}
        FROM review_cycles rc
        LEFT JOIN users cb ON cb.id = rc.created_by
        ORDER BY rc.created_at DESC
    """)
    return resp({"cycles": cycles}, origin=origin)


def _create_cycle(event, origin):
    user = get_current_user(event)
    if user["role_type"] not in CYCLE_MANAGERS:
        raise HTTPError(403, "Only HR/Admin can manage review cycles")
    body = CreateReviewCycleRequest(**get_body(event))
    cycle = execute_returning("""
        INSERT INTO review_cycles (name, status, start_date, end_date, created_by)
        VALUES (%s, %s, %s, %s, %s) RETURNING *
    """, (body.name, body.status, body.start_date, body.end_date, user["id"]))
    return resp({"cycle": cycle}, 201, origin)


def _update_cycle(event, origin, cycle_id):
    user = get_current_user(event)
    if user["role_type"] not in CYCLE_MANAGERS:
        raise HTTPError(403, "Only HR/Admin can manage review cycles")
    body = UpdateReviewCycleRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPError(400, "No fields to update")
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    updated = execute_returning(
        f"UPDATE review_cycles SET {set_clause}, updated_at = NOW() WHERE id = %s RETURNING *",
        tuple(list(fields.values()) + [cycle_id]),
    )
    if not updated:
        raise HTTPError(404, "Cycle not found")
    return resp({"cycle": updated}, origin=origin)


def _delete_cycle(event, origin, cycle_id):
    user = get_current_user(event)
    if user["role_type"] not in CYCLE_MANAGERS:
        raise HTTPError(403, "Only HR/Admin can manage review cycles")
    execute("DELETE FROM review_cycles WHERE id = %s", (cycle_id,))
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


# ── Org tree ──────────────────────────────────────────────────────────────────

def _org_tree(event, origin):
    get_current_user(event)
    tree = fetchall("""
        SELECT u.id, u.name, u.role, u.role_type, u.department, u.avatar_color,
               u.manager_id, m.name AS manager_name
        FROM users u LEFT JOIN users m ON m.id = u.manager_id
        WHERE u.is_active
        ORDER BY u.name
    """)
    return resp({"tree": tree}, origin=origin)


def _set_manager(event, origin):
    user = get_current_user(event)
    if user["role_type"] not in CYCLE_MANAGERS:
        raise HTTPError(403, "Only HR/Admin can edit the reporting tree")
    body = SetManagerRequest(**get_body(event))
    user_id, manager_id = str(body.user_id), str(body.manager_id) if body.manager_id else None
    if manager_id:
        if manager_id == user_id:
            raise HTTPError(400, "A user cannot report to themselves")
        # Reject cycles: the new manager must not already report (transitively) to this user.
        if _is_manager_of(user_id, manager_id):
            raise HTTPError(400, "That would create a reporting loop")
    count = execute("UPDATE users SET manager_id = %s, updated_at = NOW() WHERE id = %s", (manager_id, user_id))
    if count == 0:
        raise HTTPError(404, "User not found")
    return resp({"ok": True}, origin=origin)


# ── Collection endpoints ──────────────────────────────────────────────────────

def _list(event, origin):
    user = get_current_user(event)
    p = get_query(event)
    conds, params = ["1=1"], []
    if not _is_full(user):
        conds.append("(pa.subject_user_id = %s OR pa.author_user_id = %s)")
        params += [user["id"], user["id"]]
    for key, col in (("kind", "pa.kind"), ("status", "pa.status"), ("cycle_id", "pa.cycle_id"),
                     ("career_level", "pa.career_level"), ("rating_band", "pa.rating_band")):
        if p.get(key):
            conds.append(f"{col} = %s")
            params.append(p[key])
    rows = fetchall(f"""
        SELECT {ROW_COLS}
        FROM performance_assessments pa {ROW_JOINS}
        WHERE {" AND ".join(conds)}
        ORDER BY pa.created_at DESC
    """, tuple(params))
    return resp({"assessments": rows}, origin=origin)


def _stub_exists(kind: str, subject_id: str, author_id: str, cycle_id) -> bool:
    return bool(fetchone("""
        SELECT 1 AS hit FROM performance_assessments
        WHERE kind = %s AND subject_user_id = %s AND author_user_id = %s
          AND cycle_id IS NOT DISTINCT FROM %s
        LIMIT 1
    """, (kind, subject_id, author_id, cycle_id)))


def _create(event, origin):
    """Submit a self-assessment. Nominates peer reviewers and auto-assigns the
    manager review (pending stubs each reviewer fills in from My Reviews).
    Re-submitting for the same cycle updates the existing row."""
    user = get_current_user(event)
    body = CreatePerformanceAssessmentRequest(**get_body(event))
    subject_id = str(body.subject_user_id) if body.subject_user_id else None
    cycle_id = str(body.cycle_id) if body.cycle_id else None

    common = (
        body.employee_name,
        str(body.employee_user_id) if body.employee_user_id else None,
        body.designation, body.review_period, body.career_level, body.filled_by,
        [str(x) for x in body.role_areas] if body.role_areas else [],
        body.individual_score, body.team_score, body.org_score, body.culture_score,
        body.total_score, body.rating_band, body.severity, body.capped, body.data,
    )

    existing = None
    if body.kind == "self" and subject_id:
        existing = fetchone("""
            SELECT id FROM performance_assessments
            WHERE kind = 'self' AND subject_user_id = %s AND cycle_id IS NOT DISTINCT FROM %s
            ORDER BY created_at DESC LIMIT 1
        """, (subject_id, cycle_id))

    if existing:
        assessment = execute_returning("""
            UPDATE performance_assessments SET
              employee_name = %s, employee_user_id = %s, designation = %s, review_period = %s,
              career_level = %s, filled_by = %s, role_areas = %s::text[],
              individual_score = %s, team_score = %s, org_score = %s, culture_score = %s,
              total_score = %s, rating_band = %s, severity = %s, capped = %s, data = %s::jsonb,
              status = 'submitted', submitted_by = %s, submitted_at = NOW(), updated_at = NOW()
            WHERE id = %s RETURNING *
        """, common + (user["id"], existing["id"]))
    else:
        assessment = execute_returning("""
            INSERT INTO performance_assessments
              (employee_name, employee_user_id, designation, review_period, career_level,
               filled_by, role_areas, individual_score, team_score, org_score, culture_score,
               total_score, rating_band, severity, capped, data,
               kind, subject_user_id, cycle_id, reviewer_name, reviewer_user_id,
               status, submitted_by, submitted_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s::text[],%s,%s,%s,%s,%s,%s,%s,%s,%s::jsonb,
                    %s,%s,%s,%s,%s,'submitted',%s,NOW())
            RETURNING *
        """, common + (
            body.kind, subject_id, cycle_id,
            body.reviewer_name,
            str(body.reviewer_user_id) if body.reviewer_user_id else None,
            user["id"],
        ))

    nominated = 0
    manager_assigned = False
    if body.kind == "self" and subject_id:
        # Peer review stubs for each nominated reviewer.
        for rid in {str(x) for x in body.reviewer_ids}:
            if rid == subject_id or _stub_exists("peer", subject_id, rid, cycle_id):
                continue
            execute("""
                INSERT INTO performance_assessments
                  (employee_name, subject_user_id, author_user_id, nominated_by, designation,
                   review_period, career_level, kind, status, cycle_id, filled_by)
                VALUES (%s,%s,%s,%s,%s,%s,%s,'peer','pending',%s,'rev')
            """, (body.employee_name, subject_id, rid, user["id"], body.designation,
                  body.review_period, body.career_level, cycle_id))
            nominated += 1
            notify(rid, "performance", "Peer review requested",
                   f"{body.employee_name} nominated you as a peer reviewer.",
                   related_entity_type="performance_assessment",
                   related_entity_id=str(assessment["id"]))

        # Authoritative manager review stub.
        mgr = fetchone("SELECT manager_id FROM users WHERE id = %s", (subject_id,))
        manager_id = mgr and mgr.get("manager_id")
        if manager_id and manager_id != subject_id:
            manager_assigned = True
            if not _stub_exists("manager", subject_id, manager_id, cycle_id):
                execute("""
                    INSERT INTO performance_assessments
                      (employee_name, subject_user_id, author_user_id, nominated_by, designation,
                       review_period, career_level, kind, status, cycle_id, filled_by)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,'manager','pending',%s,'rev')
                """, (body.employee_name, subject_id, manager_id, user["id"], body.designation,
                      body.review_period, body.career_level, cycle_id))
                notify(manager_id, "performance", "Manager review due",
                       f"{body.employee_name} submitted a self-assessment — your manager review is due.",
                       related_entity_type="performance_assessment",
                       related_entity_id=str(assessment["id"]))

    return resp({"assessment": assessment, "nominated": nominated,
                 "manager_assigned": manager_assigned}, 201, origin)


# ── Single assessment ─────────────────────────────────────────────────────────

def _get(event, origin, assessment_id):
    user = get_current_user(event)
    row = fetchone("""
        SELECT pa.*, rc.name AS cycle_name,
               su.name AS subject_name, su.avatar_color AS employee_color,
               sb.name AS submitted_by_name
        FROM performance_assessments pa
        LEFT JOIN review_cycles rc ON rc.id = pa.cycle_id
        LEFT JOIN users su ON su.id = pa.subject_user_id
        LEFT JOIN users sb ON sb.id = pa.submitted_by
        WHERE pa.id = %s
    """, (assessment_id,))
    if not row:
        raise HTTPError(404, "Assessment not found")
    is_author = row.get("author_user_id") == user["id"]
    is_own_self = row.get("kind") == "self" and row.get("subject_user_id") == user["id"]
    if not (_is_full(user) or is_author or is_own_self
            or (row.get("subject_user_id") and _is_manager_of(user["id"], row["subject_user_id"]))):
        raise HTTPError(403, "You don't have access to this assessment")
    return resp({"assessment": row}, origin=origin)


def _update(event, origin, assessment_id):
    """A reviewer filling in (or revising) their assigned review."""
    user = get_current_user(event)
    row = fetchone("SELECT id, kind, status, author_user_id, subject_user_id, employee_name "
                   "FROM performance_assessments WHERE id = %s", (assessment_id,))
    if not row:
        raise HTTPError(404, "Assessment not found")
    is_author = row.get("author_user_id") == user["id"]
    is_own_self = row.get("kind") == "self" and row.get("subject_user_id") == user["id"]
    if not (_is_full(user) or is_author or is_own_self):
        raise HTTPError(403, "Only the assigned reviewer can update this review")

    body = UpdatePerformanceAssessmentRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPError(400, "No fields to update")

    set_parts, params = [], []
    for k, v in fields.items():
        if k == "role_areas":
            set_parts.append("role_areas = %s::text[]"); params.append([str(x) for x in v])
        elif k == "data":
            set_parts.append("data = %s::jsonb"); params.append(v)
        else:
            set_parts.append(f"{k} = %s"); params.append(v)

    newly_submitted = fields.get("status") == "submitted" and row["status"] != "submitted"
    if fields.get("status") == "submitted":
        set_parts.append("submitted_by = %s"); params.append(user["id"])
        set_parts.append("submitted_at = NOW()")

    params.append(assessment_id)
    updated = execute_returning(
        f"UPDATE performance_assessments SET {', '.join(set_parts)}, updated_at = NOW() WHERE id = %s RETURNING *",
        tuple(params),
    )
    if newly_submitted and row.get("kind") in ("peer", "manager") and row.get("subject_user_id"):
        label = "manager" if row["kind"] == "manager" else "peer"
        notify(row["subject_user_id"], "performance", "New review submitted",
               f"A {label} review about you was submitted by {user['name']}.",
               related_entity_type="performance_assessment", related_entity_id=assessment_id)
    return resp({"assessment": updated}, origin=origin)


def _delete(event, origin, assessment_id):
    user = get_current_user(event)
    if user["role_type"] not in CYCLE_MANAGERS:
        raise HTTPError(403, "Only HR/Admin can delete assessments")
    execute("DELETE FROM performance_assessments WHERE id = %s", (assessment_id,))
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


# Static paths BEFORE the /<assessment_id> catch-alls.
handler = make_handler([
    ("GET",    r"/api/performance-assessments/analysis/summary",              _analysis),
    ("GET",    r"/api/performance-assessments/my/reviews",                    _my_reviews),
    ("GET",    r"/api/performance-assessments/my/assessments",                _my_assessments),
    ("GET",    r"/api/performance-assessments/team",                          _team),
    ("GET",    rf"/api/performance-assessments/report/(?P<subject_id>{PARAM})", _report),
    ("GET",    r"/api/performance-assessments/cycles/active",                 _active_cycle),
    ("GET",    r"/api/performance-assessments/cycles",                        _list_cycles),
    ("POST",   r"/api/performance-assessments/cycles",                        _create_cycle),
    ("PATCH",  rf"/api/performance-assessments/cycles/(?P<cycle_id>{PARAM})", _update_cycle),
    ("DELETE", rf"/api/performance-assessments/cycles/(?P<cycle_id>{PARAM})", _delete_cycle),
    ("GET",    r"/api/performance-assessments/org/tree",                      _org_tree),
    ("PATCH",  r"/api/performance-assessments/org/manager",                   _set_manager),
    ("GET",    r"/api/performance-assessments",                               _list),
    ("POST",   r"/api/performance-assessments",                               _create),
    ("GET",    rf"/api/performance-assessments/(?P<assessment_id>{PARAM})",   _get),
    ("PATCH",  rf"/api/performance-assessments/(?P<assessment_id>{PARAM})",   _update),
    ("DELETE", rf"/api/performance-assessments/(?P<assessment_id>{PARAM})",   _delete),
])
