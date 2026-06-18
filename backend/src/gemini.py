"""Gemini LLM helper.

Calls the Google Generative Language REST API directly with urllib so no extra
SDK has to be vendored into the Lambda layer (mirrors the raw-urllib style
already used to fetch documents in handlers/ai.py).

gemini-3.5-flash is a *thinking* model: its internal reasoning tokens count
against maxOutputTokens, so callers should pass a generous budget or the visible
answer can be truncated to an empty string.
"""
from __future__ import annotations

import json
import logging
import urllib.request

from .config import get_settings

log = logging.getLogger(__name__)

_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
# Keep under the API Gateway 29 s integration cap so the Lambda returns before
# the gateway gives up with a 504.
_TIMEOUT = 25


def is_configured() -> bool:
    return bool(get_settings().gemini_api_key)


def _extract_text(body: dict) -> str:
    candidates = body.get("candidates") or []
    if not candidates:
        raise RuntimeError(f"Gemini returned no candidates: {json.dumps(body)[:300]}")
    cand = candidates[0]
    parts = cand.get("content", {}).get("parts", []) or []
    text = "".join(p.get("text", "") for p in parts if "text" in p).strip()
    if not text:
        raise RuntimeError(
            f"Gemini returned empty text (finishReason={cand.get('finishReason')})"
        )
    return text


def _generate(payload: dict, max_tokens: int) -> str:
    cfg = get_settings()
    if not cfg.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    payload.setdefault("generationConfig", {})["maxOutputTokens"] = max_tokens
    url = f"{_BASE}/{cfg.gemini_model}:generateContent?key={cfg.gemini_api_key}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as r:
        body = json.loads(r.read())
    return _extract_text(body)


def generate_text(prompt: str, max_tokens: int = 2048) -> str:
    """Single-prompt text/JSON generation."""
    return _generate({"contents": [{"parts": [{"text": prompt}]}]}, max_tokens)


def generate_with_pdf(
    prompt: str, pdf_b64: str, mime_type: str = "application/pdf", max_tokens: int = 4096
) -> str:
    """Multimodal generation: an inline PDF (base64) plus a text instruction."""
    return _generate(
        {
            "contents": [
                {
                    "parts": [
                        {"inline_data": {"mime_type": mime_type, "data": pdf_b64}},
                        {"text": prompt},
                    ]
                }
            ]
        },
        max_tokens,
    )
