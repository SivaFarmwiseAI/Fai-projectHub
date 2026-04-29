"""AI Capture Lambda handler — /api/capture/*"""
import asyncio
import json
import logging
import re
from datetime import date, timedelta
from typing import Optional

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user
from ..config import get_settings
from ..database import execute_returning, fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import CreateCaptureSessionRequest, UpdateCaptureItemRequest

log = logging.getLogger(__name__)

_TYPE_KEYWORDS = {
    "follow_up":       ["follow up", "follow-up", "check with", "ping", "reach out", "get back to"],
    "commitment":      ["commit", "promised", "committed to", "will deliver", "by eod", "by tomorrow", "by monday"],
    "meeting":         ["meeting", "call", "sync", "standup", "review session", "demo", "presentation"],
    "review_reminder": ["review", "check", "look at", "validate", "sign off", "approve"],
    "timeline":        ["deadline", "due date", "target date", "by end of", "must ship"],
    "todo":            [],
}


def _classify_type(text: str) -> str:
    lower = text.lower()
    for t, keywords in _TYPE_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return t
    return "todo"


def _extract_priority(text: str) -> str:
    lower = text.lower()
    if any(w in lower for w in ["urgent", "critical", "asap", "immediately", "high priority", "blocker"]):
        return "high"
    if any(w in lower for w in ["low priority", "when possible", "nice to have"]):
        return "low"
    return "medium"


def _infer_due_date(text: str) -> Optional[date]:
    lower = text.lower()
    today = date.today()
    if "today" in lower or "eod" in lower:     return today
    if "tomorrow" in lower:                     return today + timedelta(days=1)
    if "this week" in lower:                    return today + timedelta(days=(4 - today.weekday()) % 7 or 7)
    if "next week" in lower:                    return today + timedelta(days=7)
    if "monday" in lower:                       return today + timedelta(days=(0 - today.weekday()) % 7 or 7)
    if "wednesday" in lower:                    return today + timedelta(days=(2 - today.weekday()) % 7 or 7)
    if "friday" in lower:                       return today + timedelta(days=(4 - today.weekday()) % 7 or 7)
    return None


def _parse_sentences(raw_text: str, users: list[dict]) -> list[dict]:
    sentences = re.split(r"[.!?\n;]+", raw_text)
    name_to_id = {u["name"].lower(): u["id"] for u in users}
    items = []
    for s in sentences:
        s = s.strip()
        if len(s) < 5:
            continue
        assignee_id = next((uid for name, uid in name_to_id.items() if name in s.lower()), None)
        items.append({
            "type":        _classify_type(s),
            "title":       s[:200],
            "description": s,
            "assignee_id": assignee_id,
            "due_date":    _infer_due_date(s),
            "priority":    _extract_priority(s),
        })
    return items


async def _parse_with_claude(raw_text: str, users: list[dict]) -> list[dict]:
    cfg = get_settings()
    if not cfg.anthropic_api_key:
        return _parse_sentences(raw_text, users)
    try:
        import anthropic
        client = anthropic.Anthropic(api_key=cfg.anthropic_api_key)
        user_list = json.dumps([{"name": u["name"], "id": u["id"]} for u in users])
        prompt = f"""Parse this work capture text into discrete action items.

Team members: {user_list}

Text to parse:
{raw_text}

Return a JSON array. Each item must have:
- type: "todo" | "follow_up" | "commitment" | "meeting" | "review_reminder" | "timeline"
- title: concise title (max 100 chars)
- description: full context
- assignee_name: name of person mentioned (or null)
- due_date: inferred date as YYYY-MM-DD (or null)
- priority: "low" | "medium" | "high"

Return only the JSON array, no explanation."""
        msg = client.messages.create(
            model=cfg.anthropic_model,
            max_tokens=2000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = msg.content[0].text.strip()
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if not match:
            return _parse_sentences(raw_text, users)
        parsed = json.loads(match.group())
        name_to_id = {u["name"].lower(): u["id"] for u in users}
        return [{
            "type":        item.get("type", "todo"),
            "title":       item.get("title", "")[:200],
            "description": item.get("description", ""),
            "assignee_id": name_to_id.get((item.get("assignee_name") or "").lower()),
            "due_date":    item.get("due_date"),
            "priority":    item.get("priority", "medium"),
        } for item in parsed]
    except Exception as e:
        log.warning(f"Claude capture parsing failed, falling back to keyword parser: {e}")
        return _parse_sentences(raw_text, users)


# ── Routes ────────────────────────────────────────────────────────────────────

def _capture_stats(event, origin):
    current_user = get_current_user(event)
    stats = fetchone("""
        SELECT
          COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
          COUNT(*) FILTER (WHERE status = 'converted') AS converted,
          COUNT(*) FILTER (WHERE status = 'dismissed') AS dismissed,
          COUNT(*) AS total
        FROM capture_items
        WHERE user_id = %s
    """, (current_user["id"],))
    return resp({"stats": stats}, origin=origin)


def _list_items(event, origin):
    current_user = get_current_user(event)
    p = get_query(event)
    conds = ["ci.user_id = %s"]
    params: list = [current_user["id"]]
    if p.get("status"): conds.append("ci.status = %s"); params.append(p["status"])
    if p.get("type"):   conds.append("ci.type = %s");   params.append(p["type"])
    items = fetchall(f"""
        SELECT ci.*,
          u.name AS assignee_name,
          cs.raw_text AS session_raw_text
        FROM capture_items ci
        LEFT JOIN users u ON u.id = ci.assignee_id
        LEFT JOIN capture_sessions cs ON cs.id = ci.session_id
        WHERE {" AND ".join(conds)}
        ORDER BY ci.created_at DESC
    """, tuple(params))
    return resp({"items": items}, origin=origin)


def _create_session(event, origin):
    current_user = get_current_user(event)
    body = CreateCaptureSessionRequest(**get_body(event))
    session = execute_returning(
        "INSERT INTO capture_sessions (user_id, raw_text) VALUES (%s,%s) RETURNING *",
        (current_user["id"], body.raw_text),
    )
    users = fetchall("SELECT id, name FROM users WHERE is_active")
    parsed_items = asyncio.run(_parse_with_claude(body.raw_text, users))
    created = []
    for item in parsed_items:
        ci = execute_returning("""
            INSERT INTO capture_items
              (session_id, user_id, type, title, description,
               assignee_id, due_date, priority)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
        """, (
            session["id"], current_user["id"],
            item["type"], item["title"], item["description"],
            item.get("assignee_id"), item.get("due_date"), item["priority"],
        ))
        created.append(ci)
    return resp({"session": session, "items": created}, 201, origin)


def _update_item(event, origin, item_id):
    current_user = get_current_user(event)
    body = UpdateCaptureItemRequest(**get_body(event))
    item = fetchone(
        "SELECT * FROM capture_items WHERE id = %s AND user_id = %s",
        (item_id, current_user["id"])
    )
    if not item:
        raise HTTPError(404, "Capture item not found")
    fields: dict = {"status": body.status}
    if body.converted_to_task_id:
        fields["converted_to_task_id"] = str(body.converted_to_task_id)
    if body.converted_to_review_id:
        fields["converted_to_review_id"] = str(body.converted_to_review_id)
    set_clause = ", ".join(f"{k} = %s" for k in fields)
    params = list(fields.values()) + [item_id]
    updated = execute_returning(
        f"UPDATE capture_items SET {set_clause}, updated_at = NOW() WHERE id = %s RETURNING *", params
    )
    return resp({"item": updated}, origin=origin)


# Static /stats and /sessions BEFORE dynamic /items/<item_id>
handler = make_handler([
    ("GET",   r"/api/capture/stats",                               _capture_stats),
    ("GET",   r"/api/capture",                                     _list_items),
    ("POST",  r"/api/capture/sessions",                            _create_session),
    ("PATCH", rf"/api/capture/items/(?P<item_id>{PARAM})",         _update_item),
])
