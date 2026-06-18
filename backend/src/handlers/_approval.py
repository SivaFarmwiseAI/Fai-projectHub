"""Shared helpers for the schedule-requests approval queue.

Other handlers (commitments, discussions, reviews, leave, meetings) call
`auto_request()` after a successful create to drop a pending row into the queue.

The schedule_requests table has a UNIQUE(entity_type, entity_id) constraint, so
calling auto_request() twice for the same entity is a no-op (idempotent via ON
CONFLICT DO NOTHING).
"""
from __future__ import annotations

import logging
from typing import Optional

from ..database import execute

log = logging.getLogger(__name__)

VALID_TYPES = {"meeting", "review", "commitment", "discussion", "leave", "follow_up"}


def auto_request(
    *,
    entity_type: str,
    entity_id: str,
    requested_by: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    proposed_at: Optional[str] = None,
    project_id: Optional[str] = None,
) -> None:
    """Insert a pending schedule_request for an entity. Idempotent.

    Failures here MUST NOT break the parent create — the entity is already
    persisted. We log and swallow.
    """
    if entity_type not in VALID_TYPES:
        log.warning("auto_request: invalid entity_type %r", entity_type)
        return
    try:
        execute(
            """
            INSERT INTO schedule_requests
              (entity_type, entity_id, status, title, description,
               proposed_at, project_id, requested_by)
            VALUES (%s, %s, 'pending', %s, %s, %s, %s, %s)
            ON CONFLICT (entity_type, entity_id) DO NOTHING
            """,
            (
                entity_type,
                str(entity_id),
                title,
                description,
                proposed_at,
                str(project_id) if project_id else None,
                str(requested_by),
            ),
        )
    except Exception as e:
        # Don't let approval-queue plumbing break entity creation.
        log.error("auto_request failed for %s:%s — %s", entity_type, entity_id, e)
