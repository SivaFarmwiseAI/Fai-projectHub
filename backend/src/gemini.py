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
import urllib.error
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


def _generate(payload: dict, max_tokens: int, json_mode: bool = False,
              thinking_level: str | None = None) -> str:
    cfg = get_settings()
    if not cfg.gemini_api_key:
        raise RuntimeError("GEMINI_API_KEY not set")
    gen = payload.setdefault("generationConfig", {})
    gen["maxOutputTokens"] = max_tokens
    if json_mode:
        # Force strictly-valid JSON output (no markdown fences, no prose).
        gen["responseMimeType"] = "application/json"
    if thinking_level:
        # gemini-3.x thinking control — 'low' keeps light reasoning but cuts the
        # latency that risks the API Gateway 29s cap on big analysis prompts.
        gen["thinkingConfig"] = {"thinkingLevel": thinking_level}
    url = f"{_BASE}/{cfg.gemini_model}:generateContent?key={cfg.gemini_api_key}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}, method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as r:
            body = json.loads(r.read())
    except urllib.error.HTTPError as e:
        # Google returns a detailed JSON error body (size limit, unknown field,
        # bad model, etc.) that is lost if we only surface str(e). Read it so the
        # caller's log line shows the real reason instead of "HTTP Error 400".
        detail = e.read().decode("utf-8", "replace")[:1000]
        raise RuntimeError(f"Gemini HTTP {e.code} for model {cfg.gemini_model}: {detail}") from e
    return _extract_text(body)


def generate_text(prompt: str, max_tokens: int = 2048, json_mode: bool = False,
                  thinking_level: str | None = None) -> str:
    """Single-prompt text/JSON generation. json_mode forces strict JSON output;
    thinking_level ('low'/'high') tunes gemini-3.x reasoning depth vs latency."""
    return _generate({"contents": [{"parts": [{"text": prompt}]}]},
                     max_tokens, json_mode, thinking_level)


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
