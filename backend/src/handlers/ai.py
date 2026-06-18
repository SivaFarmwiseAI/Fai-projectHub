"""AI Lambda handler — /api/ai/*"""
import base64
import json
import logging
import urllib.request

from .base import get_body, get_query, make_handler, resp
from .. import gemini, ai_intel
from ..auth import get_current_user
from ..database import fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import AIReviewRequest, GeneratePlanRequest, SuggestStackRequest

log = logging.getLogger(__name__)

_STACK_DEFAULTS = {
    "engineering":  ["Python", "FastAPI", "PostgreSQL", "Docker", "Redis"],
    "data_science": ["Python", "Pandas", "XGBoost", "MLflow", "Jupyter"],
    "design":       ["Figma", "Adobe XD", "Storybook", "Tailwind CSS"],
    "strategy":     ["Google Sheets", "Notion", "Tableau"],
    "marketing":    ["HubSpot", "Mailchimp", "Google Analytics"],
    "operations":   ["Zapier", "Notion", "Slack API"],
    "hr":           ["BambooHR", "Notion", "Slack API"],
    "legal":        ["Notion", "DocuSign"],
    "finance":      ["Excel", "QuickBooks", "Tableau"],
    "research":     ["Python", "Jupyter", "Pandas", "R", "LaTeX"],
}

_PLAN_TEMPLATES = {
    "engineering": {
        "summary": "Build a production-grade system following engineering best practices.",
        "risks": [
            {"risk": "Scope creep", "mitigation": "Strict requirement freeze after phase 1", "severity": "medium"},
            {"risk": "Performance bottlenecks under load", "mitigation": "Load testing in phase 4", "severity": "high"},
        ],
        "killCriteria": [
            "Core requirement cannot be met within timebox",
            "Performance targets are fundamentally unachievable with chosen approach",
        ],
    },
    "research": {
        "summary": "Investigate feasibility and validate the approach with a time-boxed PoC.",
        "risks": [
            {"risk": "Insufficient data quality", "mitigation": "Data audit and cleaning sprint before modelling", "severity": "high"},
            {"risk": "Model overfitting", "mitigation": "Walk-forward cross-validation + holdout set", "severity": "medium"},
        ],
        "killCriteria": [
            "Target metric unachievable after 3 tuning iterations",
            "Training data coverage < 70% of target cases",
        ],
    },
}


def _template_plan(req: GeneratePlanRequest) -> dict:
    tpl = _PLAN_TEMPLATES.get(req.project_type, _PLAN_TEMPLATES["engineering"])
    return {
        "summary":      f"{tpl['summary']} Timebox: {req.timebox_days} days.",
        "techStack":    req.tech_stack or _STACK_DEFAULTS.get(req.project_type, []),
        "risks":        tpl["risks"],
        "killCriteria": tpl["killCriteria"],
    }


def _parse_json(text: str) -> dict:
    text = text.strip()
    if "```" in text:
        for part in text.split("```"):
            candidate = part.strip().lstrip("json").strip()
            try:
                return json.loads(candidate)
            except (json.JSONDecodeError, ValueError):
                continue
    return json.loads(text)


def _generate_plan(event, origin):
    get_current_user(event)
    body = GeneratePlanRequest(**get_body(event))

    if not gemini.is_configured():
        return resp({"plan": _template_plan(body)}, origin=origin)

    prompt = f"""Generate a structured execution plan for this project.

Project Type: {body.project_type}
Objective: {body.objective or body.requirement}
Timebox: {body.timebox_days} days
Tech Stack: {', '.join(body.tech_stack or []) or 'to be determined'}

Return ONLY a valid JSON object — no markdown, no explanation:
{{
  "summary": "2-3 sentence executive summary of the plan and approach",
  "techStack": ["technology1", "technology2"],
  "risks": [
    {{"risk": "risk description", "mitigation": "mitigation strategy", "severity": "high|medium|low"}}
  ],
  "killCriteria": [
    "criterion that would cause project termination"
  ]
}}"""

    try:
        text = gemini.generate_text(prompt, max_tokens=2048)
        plan = _parse_json(text)
    except Exception as e:
        log.warning("Gemini plan generation failed, using template: %s", e)
        plan = _template_plan(body)

    return resp({"plan": plan}, origin=origin)


def _extract_document(event, origin):
    get_current_user(event)
    body = get_body(event)
    document_url = body.get("document_url", "")
    if not document_url:
        raise HTTPError(400, "document_url is required")

    if not gemini.is_configured():
        raise HTTPError(503, "AI not configured — set GEMINI_API_KEY")

    try:
        req = urllib.request.Request(document_url, headers={"User-Agent": "ProjectHub/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            content = r.read()
            ct = r.headers.get("Content-Type", "application/pdf").split(";")[0].strip()
    except Exception as e:
        log.error("Failed to fetch document %s: %s", document_url, e)
        raise HTTPError(502, "Failed to fetch document for extraction")

    if ct not in ("application/pdf", "application/x-pdf"):
        ct = "application/pdf"

    pdf_b64 = base64.standard_b64encode(content).decode("utf-8")

    extract_prompt = """Extract the following fields from this project requirements document.
Return ONLY a valid JSON object — no markdown, no explanation:
{
  "title": "short project title (max 10 words)",
  "objective": "main goal of the project (2-4 sentences)",
  "scope": "what is in scope and explicitly out of scope",
  "outcome_type": "one of: product, enhancement, capability, delivery, research, migration",
  "success_criteria": ["measurable criterion 1", "measurable criterion 2"],
  "end_criteria": "definition of done — what constitutes project completion",
  "risks": ["known risk 1", "known risk 2"],
  "tech_stack": ["technology 1", "technology 2"],
  "type": "one of: engineering, research, mixed",
  "priority": "one of: low, medium, high, critical",
  "timebox_days": 21
}"""

    try:
        text = gemini.generate_with_pdf(extract_prompt, pdf_b64, ct, max_tokens=4096)
        extracted = _parse_json(text)
    except json.JSONDecodeError:
        raise HTTPError(500, "AI returned an unparseable response")
    except Exception as e:
        log.error("Gemini API error during extraction: %s", e)
        raise HTTPError(502, "AI extraction failed")

    return resp({"extracted": extracted}, origin=origin)


def _ai_review(event, origin):
    get_current_user(event)
    if not gemini.is_configured():
        raise HTTPError(503, "AI not configured — set GEMINI_API_KEY")
    body = get_body(event)
    content = body.get("content", "")
    if not content:
        raise HTTPError(400, "content is required")
    try:
        review = ai_intel.review_content(
            content, body.get("content_type", "text"), body.get("context", ""))
    except Exception as e:
        log.error("AI review failed: %s", e)
        raise HTTPError(502, "AI review failed")
    return resp({"review": review}, origin=origin)


def _suggest_stack(event, origin):
    get_current_user(event)
    body = SuggestStackRequest(**get_body(event))
    stack = _STACK_DEFAULTS.get(body.project_type, ["Python", "PostgreSQL", "Docker"])
    return resp({"stack": stack, "rationale": "Default stack for project type."}, origin=origin)


# ── Context-grounded intelligence (Gemini) ────────────────────────────────────

def _read_insights(where: str, params: tuple) -> list:
    return fetchall(f"""
        SELECT ai.*, p.title AS project_title, u.name AS user_name
        FROM ai_insights ai
        LEFT JOIN projects p ON p.id = ai.project_id
        LEFT JOIN users u    ON u.id = ai.user_id
        WHERE ai.status = 'active' AND {where}
        ORDER BY CASE ai.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1
                 WHEN 'medium' THEN 2 ELSE 3 END, ai.created_at DESC
    """, params)


def _generate_insights(event, origin):
    get_current_user(event)
    if not gemini.is_configured():
        raise HTTPError(503, "AI not configured — set GEMINI_API_KEY")
    q = get_query(event)
    scope = q.get("scope", "org")
    try:
        if scope == "project":
            project_id = q.get("project_id", "")
            if not fetchone("SELECT id FROM projects WHERE id = %s", (project_id,)):
                raise HTTPError(404, "Project not found")
            insights = ai_intel.generate_project_insights(project_id)
        else:
            insights = ai_intel.generate_org_insights()
    except HTTPError:
        raise
    except Exception as e:
        log.error("Insight generation failed: %s", e)
        raise HTTPError(502, "AI insight generation failed")
    return resp({"insights": insights}, origin=origin)


def _assess_productivity(event, origin):
    get_current_user(event)
    if not gemini.is_configured():
        raise HTTPError(503, "AI not configured — set GEMINI_API_KEY")
    user_id = (get_body(event) or {}).get("user_id") or get_query(event).get("user_id")
    try:
        result = ai_intel.assess_productivity(user_id)
    except Exception as e:
        log.error("Productivity assessment failed: %s", e)
        raise HTTPError(502, "AI productivity assessment failed")
    if result.get("error"):
        raise HTTPError(404, "User not found")
    return resp(result, origin=origin)


def _get_productivity(event, origin):
    get_current_user(event)
    user_id = get_query(event).get("user_id")
    if user_id:
        rows = _read_insights("ai.type='performance' AND ai.user_id = %s", (user_id,))
    else:
        rows = _read_insights("ai.type='performance' AND ai.project_id IS NULL", ())
    return resp({"insights": rows}, origin=origin)


def _assess_leave(event, origin):
    get_current_user(event)
    if not gemini.is_configured():
        raise HTTPError(503, "AI not configured — set GEMINI_API_KEY")
    try:
        result = ai_intel.assess_leave()
    except Exception as e:
        log.error("Leave assessment failed: %s", e)
        raise HTTPError(502, "AI leave assessment failed")
    return resp(result, origin=origin)


def _get_leave_insights(event, origin):
    get_current_user(event)
    rows = _read_insights(
        "ai.user_id IS NOT NULL AND ai.project_id IS NULL AND ai.type <> 'performance'", ())
    return resp({"insights": rows}, origin=origin)


def _ai_briefing(event, origin):
    get_current_user(event)
    if not gemini.is_configured():
        raise HTTPError(503, "AI not configured — set GEMINI_API_KEY")
    try:
        result = ai_intel.generate_briefing()
    except Exception as e:
        log.error("AI briefing failed: %s", e)
        raise HTTPError(502, "AI briefing failed")
    return resp(result, origin=origin)


handler = make_handler([
    ("POST", r"/api/ai/generate-plan",        _generate_plan),
    ("POST", r"/api/ai/extract-document",     _extract_document),
    ("POST", r"/api/ai/review",               _ai_review),
    ("POST", r"/api/ai/suggest-stack",        _suggest_stack),
    ("POST", r"/api/ai/insights/generate",    _generate_insights),
    ("POST", r"/api/ai/briefing",             _ai_briefing),
    ("POST", r"/api/ai/productivity",         _assess_productivity),
    ("GET",  r"/api/ai/productivity",         _get_productivity),
    ("POST", r"/api/ai/leave-assessment",     _assess_leave),
    ("GET",  r"/api/ai/leave-assessment",     _get_leave_insights),
])
