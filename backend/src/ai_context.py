"""AI context builder.

Assembles compact, structured "situation snapshots" of app state so the LLM has
clear, pre-digested knowledge before any analysis or suggestion. Leans on the
existing aggregate PG functions / materialized views (one DB round-trip each —
important, since database.py opens a fresh connection per call and there is no
pool). Every list is capped and every snapshot trimmed to keep prompts focused
and within the token budget.
"""
from __future__ import annotations

from .database import call_fn, fetchall, fetchone


def _cap(value, n: int) -> list:
    return value[:n] if isinstance(value, list) else []


def _pick(d: dict, keys) -> dict:
    d = d or {}
    return {k: d.get(k) for k in keys}


# ── Organization-wide ─────────────────────────────────────────────────────────

def build_org_context() -> dict:
    """Whole-org snapshot for CEO briefing / org insights."""
    briefing = call_fn("fn_ceo_briefing") or {}
    health = call_fn("fn_team_health") or {}
    velocity = call_fn("fn_velocity", 30) or {}

    members = [
        _pick(m, ("name", "department", "health_score", "active_tasks", "blocked_tasks",
                  "avg_mood", "on_time_rate", "hours_ratio", "high_escalations"))
        for m in _cap(health.get("team_health", []), 30)
    ]
    return {
        "scope": "organization",
        "stats": briefing.get("stats", {}),
        "critical_projects": _cap(briefing.get("critical_projects", []), 10),
        "pending_approvals": _cap(briefing.get("pending_approvals", []), 8),
        "deadline_extensions": _cap(briefing.get("deadline_extensions", []), 8),
        "leave_pending": _cap(briefing.get("leave_pending", []), 8),
        "team_health": {
            "avg": health.get("avg_team_health"),
            "critical_members": health.get("critical_members"),
            "members": members,
        },
        "velocity_30d": _cap(velocity.get("velocity", []), 6),
    }


# ── Single project ────────────────────────────────────────────────────────────

def build_project_context(project_id: str) -> dict:
    """Deep snapshot of one project: status, phases, task health, blockers."""
    proj = fetchone("""
        SELECT p.id, p.title, p.type, p.status, p.priority, p.objective, p.requirement,
               p.current_phase, p.current_phase_index, p.timebox_days,
               p.start_date, p.end_date, u.name AS owner_name,
               (CURRENT_DATE - p.start_date)                        AS days_elapsed,
               (p.start_date + p.timebox_days - CURRENT_DATE)       AS days_remaining
        FROM projects p LEFT JOIN users u ON u.id = p.owner_id
        WHERE p.id = %s
    """, (project_id,))
    if not proj:
        return {"scope": "project", "error": "not_found"}

    task_stats = fetchone("""
        SELECT
          COUNT(*)                                            AS total,
          COUNT(*) FILTER (WHERE status = 'in_progress')      AS in_progress,
          COUNT(*) FILTER (WHERE status = 'blocked')          AS blocked,
          COUNT(*) FILTER (WHERE status = 'completed')        AS completed,
          COUNT(*) FILTER (WHERE status = 'planning')         AS planning,
          ROUND(AVG(actual_hours / NULLIF(estimated_hours, 0))
                FILTER (WHERE status = 'completed' AND estimated_hours > 0), 2) AS avg_hours_ratio
        FROM tasks WHERE project_id = %s
    """, (project_id,))

    attention_tasks = fetchall("""
        SELECT t.title, t.status, t.priority, t.estimated_hours, t.actual_hours,
               u.name AS assignee
        FROM tasks t LEFT JOIN users u ON u.id = t.assignee_id
        WHERE t.project_id = %s AND t.status IN ('blocked','in_progress')
        ORDER BY (t.status='blocked') DESC, t.priority DESC
        LIMIT 15
    """, (project_id,))

    extensions = fetchall("""
        SELECT de.reason, de.reason_detail, de.status, de.escalation_level,
               de.requested_deadline, t.title AS task_title
        FROM deadline_extensions de LEFT JOIN tasks t ON t.id = de.task_id
        WHERE de.project_id = %s
        ORDER BY de.created_at DESC LIMIT 8
    """, (project_id,))

    blockers = fetchall("""
        SELECT u.name, se.blockers, se.mood, se.date
        FROM standup_entries se JOIN users u ON u.id = se.user_id
        WHERE se.blockers IS NOT NULL AND btrim(se.blockers) <> ''
          AND lower(se.blockers) NOT LIKE 'none%%'
          AND se.date >= CURRENT_DATE - INTERVAL '7 days'
          AND se.user_id IN (SELECT user_id FROM project_assignees WHERE project_id = %s)
        ORDER BY se.date DESC LIMIT 10
    """, (project_id,))

    return {
        "scope": "project",
        "project": proj,
        "task_stats": task_stats or {},
        "attention_tasks": attention_tasks,
        "deadline_extensions": extensions,
        "recent_blockers": blockers,
    }


# ── Single person (or whole team when user_id is None) ─────────────────────────

def build_person_context(user_id: str) -> dict:
    """Per-employee snapshot: workload, throughput, mood, blockers, leave, escalations."""
    user = fetchone(
        "SELECT id, name, role, role_type, department FROM users WHERE id = %s", (user_id,))
    if not user:
        return {"scope": "person", "error": "not_found"}

    metrics = fetchone("""
        SELECT
          COUNT(*) FILTER (WHERE status IN ('in_progress','planning'))      AS active_tasks,
          COUNT(*) FILTER (WHERE status = 'blocked')                        AS blocked_tasks,
          COUNT(*) FILTER (WHERE status = 'completed')                      AS completed_tasks,
          ROUND(AVG(actual_hours / NULLIF(estimated_hours,0))
                FILTER (WHERE status='completed' AND estimated_hours > 0), 2) AS hours_ratio,
          ROUND(AVG(CASE WHEN status='completed' AND completed_at IS NOT NULL
                         THEN 1 ELSE 0 END)::numeric, 2)                     AS completion_rate
        FROM tasks WHERE assignee_id = %s
    """, (user_id,))

    standups = fetchall("""
        SELECT date, mood, blockers, today
        FROM standup_entries
        WHERE user_id = %s AND date >= CURRENT_DATE - INTERVAL '30 days'
        ORDER BY date DESC LIMIT 20
    """, (user_id,))
    moods = [s["mood"] for s in standups if s.get("mood") is not None]
    avg_mood = round(sum(moods) / len(moods), 2) if moods else None
    open_blockers = [
        {"date": s["date"], "blockers": s["blockers"]}
        for s in standups
        if s.get("blockers") and not str(s["blockers"]).lower().startswith("none")
    ][:6]

    leave = fetchone("""
        SELECT
          COUNT(*)                                          AS total_requests,
          COUNT(*) FILTER (WHERE NOT is_planned)            AS unplanned,
          COUNT(*) FILTER (WHERE type = 'sick')             AS sick,
          COALESCE(SUM(days),0)                             AS total_days
        FROM leave_requests
        WHERE user_id = %s AND status = 'approved'
          AND start_date >= CURRENT_DATE - INTERVAL '180 days'
    """, (user_id,))

    escalations = fetchone("""
        SELECT COUNT(*) AS high_escalations
        FROM deadline_extensions
        WHERE requested_by = %s AND escalation_level >= 2
    """, (user_id,))

    return {
        "scope": "person",
        "user": user,
        "task_metrics": metrics or {},
        "avg_mood_30d": avg_mood,
        "open_blockers": open_blockers,
        "leave_180d": leave or {},
        "high_escalations": (escalations or {}).get("high_escalations", 0),
    }


def build_team_productivity_context() -> dict:
    """Team-wide productivity snapshot (uses fn_team_health + velocity)."""
    health = call_fn("fn_team_health") or {}
    velocity = call_fn("fn_velocity", 30) or {}
    workload = call_fn("fn_workload_distribution") or {}
    return {
        "scope": "team",
        "avg_health": health.get("avg_team_health"),
        "critical_members": health.get("critical_members"),
        "members": [
            _pick(m, ("name", "department", "health_score", "active_tasks", "completed_tasks",
                      "blocked_tasks", "avg_mood", "on_time_rate", "hours_ratio", "high_escalations"))
            for m in _cap(health.get("team_health", []), 30)
        ],
        "workload": _cap(workload.get("workload", []), 30),
        "velocity_30d": _cap(velocity.get("velocity", []), 6),
    }


# ── Leave / availability ──────────────────────────────────────────────────────

def build_leave_context() -> dict:
    """Org leave snapshot: FY balances, unplanned/sick patterns, coverage gaps."""
    analytics = call_fn("fn_leave_analytics") or {}
    unplanned = fetchall("""
        SELECT u.name, lr.type, lr.start_date, lr.end_date, lr.days, lr.is_planned
        FROM leave_requests lr JOIN users u ON u.id = lr.user_id
        WHERE lr.status = 'approved' AND NOT lr.is_planned
          AND lr.start_date >= CURRENT_DATE - INTERVAL '90 days'
        ORDER BY lr.start_date DESC LIMIT 20
    """)
    upcoming = fetchall("""
        SELECT u.name, lr.type, lr.start_date, lr.end_date, lr.days,
               lr.cover_person_id, cp.name AS cover_name
        FROM leave_requests lr JOIN users u ON u.id = lr.user_id
        LEFT JOIN users cp ON cp.id = lr.cover_person_id
        WHERE lr.status IN ('approved','pending') AND lr.start_date >= CURRENT_DATE
        ORDER BY lr.start_date ASC LIMIT 20
    """)
    return {
        "scope": "leave",
        "fy_start": analytics.get("fy_start"),
        "per_person": _cap(analytics.get("analytics", []), 30),
        "recent_unplanned": unplanned,
        "upcoming": upcoming,
        "coverage_gaps": [u for u in upcoming if not u.get("cover_person_id")][:10],
    }
