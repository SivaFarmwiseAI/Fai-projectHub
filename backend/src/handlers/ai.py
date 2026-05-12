"""AI Lambda handler — /api/ai/*"""
import base64
import json
import logging
import urllib.request

import anthropic as _ant

from .base import get_body, get_query, make_handler, resp
from ..auth import get_current_user
from ..config import get_settings
from ..database import fetchone
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


def _get_client(settings):
    if not settings.anthropic_api_key:
        return None
    return _ant.Anthropic(api_key=settings.anthropic_api_key)


def _parse_json_from_claude(text: str) -> dict:
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
    settings = get_settings()
    body = GeneratePlanRequest(**get_body(event))

    client = _get_client(settings)
    if not client:
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
        msg = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=1024,
            messages=[{"role": "user", "content": prompt}],
        )
        plan = _parse_json_from_claude(msg.content[0].text)
    except Exception as e:
        log.warning("Claude plan generation failed, using template: %s", e)
        plan = _template_plan(body)

    return resp({"plan": plan}, origin=origin)


def _extract_document(event, origin):
    get_current_user(event)
    settings = get_settings()
    body = get_body(event)
    document_url = body.get("document_url", "")
    if not document_url:
        raise HTTPError(400, "document_url is required")

    client = _get_client(settings)
    if not client:
        raise HTTPError(503, "AI not configured — set ANTHROPIC_API_KEY")

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
        msg = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=2048,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {"type": "base64", "media_type": ct, "data": pdf_b64},
                    },
                    {"type": "text", "text": extract_prompt},
                ],
            }],
        )
        extracted = _parse_json_from_claude(msg.content[0].text)
    except json.JSONDecodeError:
        raise HTTPError(500, "AI returned an unparseable response")
    except _ant.APIError as e:
        log.error("Anthropic API error during extraction: %s", e)
        raise HTTPError(502, "AI extraction failed")

    return resp({"extracted": extracted}, origin=origin)


def _ai_review(event, origin):
    get_current_user(event)
    return resp({"review": {"summary": "AI review not available.", "issues": [], "suggestions": [], "score": None}}, origin=origin)


def _suggest_stack(event, origin):
    get_current_user(event)
    body = SuggestStackRequest(**get_body(event))
    stack = _STACK_DEFAULTS.get(body.project_type, ["Python", "PostgreSQL", "Docker"])
    return resp({"stack": stack, "rationale": "Default stack for project type."}, origin=origin)


def _generate_insights(event, origin):
    get_current_user(event)
    project_id = get_query(event).get("project_id", "")
    project = fetchone("SELECT id FROM projects WHERE id = %s", (project_id,))
    if not project:
        raise HTTPError(404, "Project not found")
    return resp({"insights": []}, origin=origin)


handler = make_handler([
    ("POST", r"/api/ai/generate-plan",      _generate_plan),
    ("POST", r"/api/ai/extract-document",   _extract_document),
    ("POST", r"/api/ai/review",             _ai_review),
    ("POST", r"/api/ai/suggest-stack",      _suggest_stack),
    ("POST", r"/api/ai/insights/generate",  _generate_insights),
])
