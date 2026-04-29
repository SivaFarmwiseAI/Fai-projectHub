"""Health check Lambda handler."""
import json
from .base import CORS_HEADERS, get_origin
from ..config import get_settings


def handler(event: dict, context) -> dict:
    origin = get_origin(event)
    cfg = get_settings()
    return {
        "statusCode": 200,
        "headers": {
            **CORS_HEADERS,
            "Access-Control-Allow-Origin": origin,
            "Content-Type": "application/json",
        },
        "body": json.dumps({"status": "ok", "env": cfg.environment}),
    }
