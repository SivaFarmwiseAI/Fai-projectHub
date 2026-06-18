"""AI intelligence layer.

Turns the grounded context snapshots (ai_context.py) into analysis via Gemini and
caches the results in the existing `ai_insights` table (hybrid: cached + on-demand
regenerate). Results surface through the endpoints that already read ai_insights
(CEO briefing, dashboard, per-project insights).

ai_insights is partitioned by scope so a regenerate replaces only its own batch:
  ORG          : project_id IS NULL AND user_id IS NULL
  PROJECT      : project_id = <pid>
  PRODUCTIVITY : user_id = <uid> AND project_id IS NULL AND type = 'performance'
  LEAVE        : user_id = <uid> AND project_id IS NULL AND type <> 'performance'
"""
from __future__ import annotations

import json
import logging
import re

from . import gemini
from .ai_context import (
    build_org_context, build_project_context, build_person_context,
    build_team_productivity_context, build_leave_context,
)
from .database import execute, execute_returning, fetchall

log = logging.getLogger(__name__)

_TYPES = {"risk", "opportunity", "blocker", "performance", "suggestion"}
_SEVS = {"low", "medium", "high", "critical"}


# ── Gemini JSON helpers ───────────────────────────────────────────────────────

def _extract_json(raw: str, array: bool):
    raw = (raw or "").strip()
    if "```" in raw:
        raw = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
    open_ch, close_ch = ("[", "]") if array else ("{", "}")
    start = raw.find(open_ch)
    if start == -1:
        raise ValueError("no JSON found in model output")
    candidate = raw[start:]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        # Salvage truncated output: keep up to the last complete element.
        cut = candidate.rfind("}")
        while cut > 0:
            try:
                return json.loads(candidate[:cut + 1] + (close_ch if array else ""))
            except json.JSONDecodeError:
                cut = candidate.rfind("}", 0, cut)
        raise


def _gen_array(prompt: str, max_tokens: int = 8192) -> list:
    return _extract_json(
        gemini.generate_text(prompt, max_tokens=max_tokens, json_mode=True), array=True)


def _gen_object(prompt: str, max_tokens: int = 6144) -> dict:
    return _extract_json(
        gemini.generate_text(prompt, max_tokens=max_tokens, json_mode=True), array=False)


# ── insight persistence ───────────────────────────────────────────────────────

def _dismiss(where: str, params: tuple) -> None:
    execute(f"UPDATE ai_insights SET status='dismissed' "
            f"WHERE status='active' AND {where}", params)


def _insert(project_id, user_id, itype, severity, title, description, action_items) -> dict:
    itype = itype if itype in _TYPES else "risk"
    severity = severity if severity in _SEVS else "medium"
    if not isinstance(action_items, list):
        action_items = []
    action_items = [str(a) for a in action_items][:6]
    return execute_returning("""
        INSERT INTO ai_insights (project_id, user_id, type, severity, title, description, action_items, status)
        VALUES (%s, %s, %s, %s, %s, %s, %s, 'active') RETURNING *
    """, (project_id, user_id, itype, severity, str(title)[:500],
          str(description or ""), json.dumps(action_items)))


def _lookup_maps() -> tuple[dict, dict]:
    users = {u["name"].lower(): u["id"] for u in fetchall("SELECT id, name FROM users WHERE is_active")}
    projects = {p["title"].lower(): p["id"]
                for p in fetchall("SELECT id, title FROM projects WHERE status = 'active'")}
    return users, projects


# ── Generators ────────────────────────────────────────────────────────────────

_ORG_PROMPT = """You are the chief-of-staff analyst for a CEO's project-management command center.
Below is the CURRENT organization snapshot as JSON (stats, critical projects, team health,
pending approvals, deadline extensions, pending leave, 30-day velocity).

Analyse it and surface the most important intelligence the CEO should act on. Cover delivery
risk, team-health/burnout signals, bottlenecks, and opportunities. Be specific and reference
real project titles / people from the data.

Return ONLY a JSON array (6-9 items), each:
{"type":"risk|opportunity|blocker|performance|suggestion",
 "severity":"low|medium|high|critical",
 "title":"<=90 char headline",
 "description":"2-3 sentences grounded in the data",
 "action_items":["concrete next step", "..."]}

SNAPSHOT:
"""

_PROJECT_PROMPT = """You are a delivery-risk analyst. Below is a CURRENT snapshot of ONE project
(status, timebox vs days elapsed/remaining, task health, blocked/at-risk tasks, deadline
extensions, recent standup blockers).

Assess whether it is on-track, at-risk, or critical, and surface the key risks/blockers and
the highest-leverage actions. Be specific to this project's data.

Return ONLY a JSON array (3-6 items), each:
{"type":"risk|opportunity|blocker|performance|suggestion",
 "severity":"low|medium|high|critical",
 "title":"<=90 char headline",
 "description":"2-3 sentences grounded in the data",
 "action_items":["concrete next step", "..."]}

SNAPSHOT:
"""

_PRODUCTIVITY_PROMPT = """You are a people-analytics advisor to a CEO. Below is a CURRENT productivity
snapshot. For PER-PERSON data assess each member; for a single person assess that person.
Judge throughput, reliability (on-time rate, hours estimate accuracy), workload balance and
morale (mood, blockers, escalations). Be fair and evidence-based; flag both strengths and concerns.

Return ONLY a JSON object:
{"summary":"3-4 sentence overall productivity assessment",
 "people":[{"name":"<exact name from data>",
            "severity":"low|medium|high|critical (concern level; low = healthy)",
            "assessment":"2-3 sentences",
            "action_items":["coaching/support action", "..."]}]}

SNAPSHOT:
"""

_LEAVE_PROMPT = """You are an HR/operations analyst. Below is a CURRENT leave & availability snapshot
(per-person FY balances, recent UNPLANNED leave, upcoming leave, and coverage gaps).
Assess burnout / over-reliance risk (high unplanned or sick leave), coverage gaps for upcoming
leave, and fairness of distribution. Be specific and name people from the data.

Return ONLY a JSON object:
{"summary":"3-4 sentence org leave-health assessment",
 "findings":[{"name":"<exact person name, or 'Team' for org-wide>",
              "kind":"risk|suggestion",
              "severity":"low|medium|high|critical",
              "assessment":"2-3 sentences",
              "action_items":["action", "..."]}]}

SNAPSHOT:
"""

_REVIEW_PROMPT = """You are a senior technical reviewer. Review the submitted work below and give
concise, constructive, actionable feedback.

Return ONLY a JSON object:
{"summary":"2-3 sentence overall assessment",
 "issues":[{"description":"specific issue","severity":"low|medium|high"}],
 "suggestions":["actionable improvement", "..."],
 "score": <integer 0-100 quality score>}

CONTENT TYPE: %s
CONTEXT: %s
SUBMITTED WORK:
%s
"""

_BRIEFING_PROMPT = """You are the CEO's chief of staff. Write a crisp morning briefing (markdown,
~150-220 words) from the snapshot below: lead with what needs the CEO's attention TODAY, then
delivery risks, team health, and approvals waiting. Be specific with names/projects. No preamble.

SNAPSHOT:
"""


def generate_org_insights() -> list[dict]:
    ctx = build_org_context()
    items = _gen_array(_ORG_PROMPT + json.dumps(ctx, default=str))
    _dismiss("project_id IS NULL AND user_id IS NULL", ())
    out = []
    for it in items[:9]:
        out.append(_insert(None, None, it.get("type"), it.get("severity"),
                           it.get("title"), it.get("description"), it.get("action_items")))
    return out


def generate_project_insights(project_id: str) -> list[dict]:
    ctx = build_project_context(project_id)
    if ctx.get("error"):
        return []
    items = _gen_array(_PROJECT_PROMPT + json.dumps(ctx, default=str))
    _dismiss("project_id = %s", (project_id,))
    out = []
    for it in items[:6]:
        out.append(_insert(project_id, None, it.get("type"), it.get("severity"),
                           it.get("title"), it.get("description"), it.get("action_items")))
    return out


def assess_productivity(user_id: str | None = None) -> dict:
    ctx = build_person_context(user_id) if user_id else build_team_productivity_context()
    if ctx.get("error"):
        return {"error": "not_found"}
    result = _gen_object(_PRODUCTIVITY_PROMPT + json.dumps(ctx, default=str))
    users, _ = _lookup_maps()
    if user_id:
        _dismiss("user_id = %s AND project_id IS NULL AND type = 'performance'", (user_id,))
    else:
        _dismiss("user_id IS NOT NULL AND project_id IS NULL AND type = 'performance'", ())
    for p in result.get("people", []):
        uid = user_id or users.get((p.get("name") or "").lower())
        if not uid:
            continue
        _insert(None, uid, "performance", p.get("severity"),
                p.get("name", "Productivity"), p.get("assessment"), p.get("action_items"))
    return result


def assess_leave() -> dict:
    ctx = build_leave_context()
    result = _gen_object(_LEAVE_PROMPT + json.dumps(ctx, default=str))
    users, _ = _lookup_maps()
    _dismiss("user_id IS NOT NULL AND project_id IS NULL AND type <> 'performance'", ())
    for f in result.get("findings", []):
        uid = users.get((f.get("name") or "").lower())
        if not uid:
            continue
        itype = "suggestion" if f.get("kind") == "suggestion" else "risk"
        _insert(None, uid, itype, f.get("severity"),
                f"Leave: {f.get('name')}", f.get("assessment"), f.get("action_items"))
    return result


def review_content(content: str, content_type: str = "text", context: str = "") -> dict:
    prompt = _REVIEW_PROMPT % (content_type, context or "(none)", content[:12000])
    return _gen_object(prompt)


def generate_briefing() -> dict:
    ctx = build_org_context()
    text = gemini.generate_text(_BRIEFING_PROMPT + json.dumps(ctx, default=str), max_tokens=2048)
    return {"briefing": text.strip()}
