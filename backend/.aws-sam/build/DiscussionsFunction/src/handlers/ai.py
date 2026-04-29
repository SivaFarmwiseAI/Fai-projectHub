"""AI Lambda handler — /api/ai/*"""
import logging

from .base import get_body, get_query, make_handler, resp
from ..auth import get_current_user
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
    "data_science": {
        "summary": "Build and validate an ML model with production deployment pipeline.",
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


def _generate_plan(event, origin):
    get_current_user(event)
    body = GeneratePlanRequest(**get_body(event))
    return resp({"plan": _template_plan(body)}, origin=origin)


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
    ("POST", r"/api/ai/review",             _ai_review),
    ("POST", r"/api/ai/suggest-stack",      _suggest_stack),
    ("POST", r"/api/ai/insights/generate",  _generate_insights),
])
