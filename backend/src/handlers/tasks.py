"""Tasks Lambda handler — /api/tasks/*"""
import json
import logging

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user
from ..database import call_fn, execute, execute_returning, fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import (
    CreateDeadlineExtensionRequest, CreateMilestoneRequest, CreateTaskRequest,
    CreateTaskStepRequest, CreateTaskUpdateRequest, UpdateDeadlineExtensionRequest,
    UpdateMilestoneRequest, UpdateTaskRequest, UpdateTaskStepRequest,
)

log = logging.getLogger(__name__)

# Valid deliverable_type enum values — validated here so a bad value is a 400,
# not a 500 from the Postgres enum cast.
DELIVERABLE_TYPES = {"code", "document", "ppt", "text", "meeting_notes", "data"}

VERDICT_LABEL = {
    "met": "Met", "partially_met": "Partially met",
    "not_met": "Not met", "deferred": "Deferred",
}


# ── Outcome / deliverable enforcement helpers ────────────────────────────────

def _insert_deliverables(current_user, items, task_id=None, milestone_id=None,
                         submitted_at=None):
    """Insert inline deliverable evidence rows (status 'submitted').

    Milestone deliverables carry milestone_id only; task-level deliverables
    carry task_id only — fn_task_full aggregates each level separately.
    `submitted_at` lets a completion backdate its evidence to the entered
    end date, so the deliverable lands in the same week as the completion."""
    rows = []
    for item in items:
        title = (item.get("title") or "").strip()
        if not title:
            continue
        dtype = item.get("type") or "document"
        if dtype not in DELIVERABLE_TYPES:
            raise HTTPError(400, f"Invalid deliverable type '{dtype}'",
                            code="INVALID_DELIVERABLE_TYPE")
        url = item.get("url")
        rows.append(execute_returning("""
            INSERT INTO deliverables
              (task_id, milestone_id, type, title, description, status,
               document_url, code_pr_url, text_content, submitted_by, submitted_at)
            VALUES (%s,%s,%s,%s,%s,'submitted',%s,%s,%s,%s,COALESCE(%s, NOW())) RETURNING *
        """, (task_id, milestone_id, dtype, title, item.get("description"),
              url if dtype != "code" else None,
              url if dtype == "code" else None,
              item.get("text_content"), current_user["id"], submitted_at)))
    return rows


def _has_task_evidence(task_id):
    """A milestone-less task counts as evidenced if it has a deliverable row,
    a standalone attachment, or (legacy) a revision attachment."""
    return bool(fetchone("""
        SELECT 1 WHERE EXISTS (SELECT 1 FROM deliverables WHERE task_id = %s)
           OR EXISTS (SELECT 1 FROM task_attachments WHERE task_id = %s)
           OR EXISTS (SELECT 1 FROM task_revision_attachments a
                      JOIN task_revisions r ON r.id = a.revision_id
                      WHERE r.task_id = %s)
    """, (task_id, task_id, task_id)))


def _has_milestone_evidence(ms_id):
    return bool(fetchone("""
        SELECT 1 WHERE EXISTS (SELECT 1 FROM deliverables WHERE milestone_id = %s)
           OR EXISTS (SELECT 1 FROM milestone_revision_attachments a
                      JOIN milestone_revisions mr ON mr.id = a.revision_id
                      WHERE mr.milestone_id = %s)
    """, (ms_id, ms_id)))


# ── Deadline extensions ───────────────────────────────────────────────────────

def _create_extension(event, origin):
    current_user = get_current_user(event)
    body = CreateDeadlineExtensionRequest(**get_body(event))
    ext = execute_returning("""
        INSERT INTO deadline_extensions
          (project_id, task_id, milestone_id, requested_by,
           original_deadline, requested_deadline, reason, reason_detail, impact)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (str(body.project_id),
          str(body.task_id)      if body.task_id      else None,
          str(body.milestone_id) if body.milestone_id else None,
          current_user["id"],
          body.original_deadline, body.requested_deadline,
          body.reason, body.reason_detail, body.impact))
    return resp({"extension": ext}, 201, origin)


def _update_extension(event, origin, ext_id):
    current_user = get_current_user(event)
    body = UpdateDeadlineExtensionRequest(**get_body(event))
    ext = execute_returning("""
        UPDATE deadline_extensions
        SET status = %s, ceo_comment = %s, action_taken = %s, approved_by = %s, approved_at = NOW()
        WHERE id = %s RETURNING *
    """, (body.status, body.ceo_comment, body.action_taken, current_user["id"], ext_id))
    if not ext:
        raise HTTPError(404, "Extension not found")
    return resp({"extension": ext}, origin=origin)


# ── Tasks ─────────────────────────────────────────────────────────────────────

def _list_tasks(event, origin):
    get_current_user(event)
    p = get_query(event)
    conds = ["1=1"]
    params: list = []
    if p.get("project_id"):  conds.append("t.project_id = %s");  params.append(p["project_id"])
    if p.get("assignee_id"):
        # Match either the primary assignee_id OR any row in task_assignees.
        conds.append(
            "(t.assignee_id = %s OR EXISTS "
            "(SELECT 1 FROM task_assignees ta WHERE ta.task_id = t.id AND ta.user_id = %s))"
        )
        params.extend([p["assignee_id"], p["assignee_id"]])
    if p.get("status"):      conds.append("t.status = %s");      params.append(p["status"])
    if p.get("priority"):    conds.append("t.priority = %s");    params.append(p["priority"])
    tasks = fetchall(f"""
        SELECT t.id, t.title, t.description, t.status, t.priority, t.assignee_id,
          t.estimated_hours, t.actual_hours, t.plan_status,
          t.review_status, t.order_index, t.phase_id, t.created_at, t.completed_at,
          u.name AS assignee_name, u.avatar_color AS assignee_color,
          pr.title AS project_title, ph.phase_name,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', au.id, 'name', au.name, 'avatar_color', au.avatar_color,
              'role', au.role, 'department', au.department
            ) ORDER BY au.name)
            FROM task_assignees ta JOIN users au ON au.id = ta.user_id
            WHERE ta.task_id = t.id
          ), '[]'::JSON) AS assignees
        FROM tasks t
        LEFT JOIN users u       ON u.id    = t.assignee_id
        LEFT JOIN projects pr   ON pr.id   = t.project_id
        LEFT JOIN phases ph     ON ph.id   = t.phase_id
        WHERE {" AND ".join(conds)}
        ORDER BY CASE t.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, t.created_at DESC
    """, tuple(params))
    return resp({"tasks": tasks}, origin=origin)


def _create_task(event, origin):
    current_user = get_current_user(event)
    body = CreateTaskRequest(**get_body(event))

    # Resolve the assignee set. Accept either:
    #   - assignee_ids: ["u1","u2",...]  (preferred — full list)
    #   - assignee_id:  "u1"             (legacy single)
    all_ids = [str(u) for u in body.assignee_ids]
    if body.assignee_id:
        primary = str(body.assignee_id)
        if primary not in all_ids:
            all_ids.insert(0, primary)
    primary_id = all_ids[0] if all_ids else None

    task = execute_returning("""
        INSERT INTO tasks
          (project_id, phase_id, title, description, assignee_id, approach,
           priority, estimated_hours, success_criteria, kill_criteria, order_index,
           expected_outcome_type, expected_deliverable, created_by)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (str(body.project_id),
          str(body.phase_id)    if body.phase_id    else None,
          body.title, body.description, primary_id,
          body.approach, body.priority, body.estimated_hours,
          json.dumps(body.success_criteria), json.dumps(body.kill_criteria),
          body.order_index,
          body.expected_outcome_type, body.expected_deliverable or None,
          current_user["id"]))

    for uid in all_ids:
        # Auto-add the assignee to the project (so "Add People" can pull in a
        # user who isn't a member yet), then assign them to the task. Both
        # inserts are dedup-safe via ON CONFLICT, so existing members are a no-op.
        execute(
            "INSERT INTO project_assignees (project_id, user_id) "
            "VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (str(body.project_id), uid),
        )
        execute(
            "INSERT INTO task_assignees (task_id, user_id, added_by) "
            "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
            (task["id"], uid, current_user["id"]),
        )

    task["assignees"] = fetchall("""
        SELECT u.id, u.name, u.avatar_color, u.role, u.department
        FROM task_assignees ta JOIN users u ON u.id = ta.user_id
        WHERE ta.task_id = %s ORDER BY u.name
    """, (task["id"],))
    return resp({"task": task}, 201, origin)


def _add_task_assignee(event, origin, task_id):
    current_user = get_current_user(event)
    body = get_body(event)
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPError(400, "user_id is required")
    task_row = fetchone("SELECT project_id FROM tasks WHERE id = %s", (task_id,))
    if not task_row:
        raise HTTPError(404, "Task not found")
    if not fetchone("SELECT 1 FROM users WHERE id = %s AND is_active", (user_id,)):
        raise HTTPError(404, "User not found")
    # "Add People" can assign a user who isn't a project member yet — auto-add
    # them to the project first (dedup-safe), then assign them to the task.
    execute(
        "INSERT INTO project_assignees (project_id, user_id) "
        "VALUES (%s, %s) ON CONFLICT DO NOTHING",
        (task_row["project_id"], user_id),
    )
    execute(
        "INSERT INTO task_assignees (task_id, user_id, added_by) "
        "VALUES (%s, %s, %s) ON CONFLICT DO NOTHING",
        (task_id, user_id, current_user["id"]),
    )
    # If the task has no primary assignee yet, promote this user.
    execute(
        "UPDATE tasks SET assignee_id = %s, updated_at = NOW() "
        "WHERE id = %s AND assignee_id IS NULL",
        (user_id, task_id),
    )
    assignees = fetchall("""
        SELECT u.id, u.name, u.avatar_color, u.role, u.department
        FROM task_assignees ta JOIN users u ON u.id = ta.user_id
        WHERE ta.task_id = %s ORDER BY u.name
    """, (task_id,))
    return resp({"task_id": task_id, "assignees": assignees}, 201, origin)


def _remove_task_assignee(event, origin, task_id, user_id):
    get_current_user(event)
    if not fetchone("SELECT 1 FROM tasks WHERE id = %s", (task_id,)):
        raise HTTPError(404, "Task not found")
    execute(
        "DELETE FROM task_assignees WHERE task_id = %s AND user_id = %s",
        (task_id, user_id),
    )
    # If the removed user was the primary assignee, fall back to another.
    task = fetchone("SELECT assignee_id FROM tasks WHERE id = %s", (task_id,))
    if task and task["assignee_id"] and str(task["assignee_id"]) == str(user_id):
        next_assignee = fetchone(
            "SELECT user_id FROM task_assignees WHERE task_id = %s ORDER BY added_at LIMIT 1",
            (task_id,),
        )
        execute(
            "UPDATE tasks SET assignee_id = %s, updated_at = NOW() WHERE id = %s",
            (next_assignee["user_id"] if next_assignee else None, task_id),
        )
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


def _get_task(event, origin, task_id):
    get_current_user(event)
    data = call_fn("fn_task_full", task_id)
    if not data:
        raise HTTPError(404, "Task not found")
    return resp({"task": data}, origin=origin)


def _update_task(event, origin, task_id):
    current_user = get_current_user(event)
    body = UpdateTaskRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    # Inline deliverable evidence — not a tasks column.
    deliverable_items = fields.pop("deliverables", []) or []
    # Actual end date entered at completion — applied as completed_at below.
    completed_date = fields.pop("completed_date", None)
    if not fields and not deliverable_items:
        raise HTTPError(400, "No fields to update")
    for key in ("success_criteria", "kill_criteria"):
        if key in fields: fields[key] = json.dumps(fields[key])
    if "assignee_id" in fields and fields["assignee_id"]:
        fields["assignee_id"] = str(fields["assignee_id"])

    # Completion gate — only on the transition INTO 'completed'.
    #   Task has milestones  -> every milestone must already be completed
    #                           (each one carries its own outcome + evidence);
    #                           no task-level outcome is demanded.
    #   Task has none        -> verdict + notes + deliverable evidence required.
    completing = False
    current = None
    if fields.get("status") == "completed":
        current = fetchone(
            "SELECT status, outcome, outcome_notes FROM tasks WHERE id = %s", (task_id,))
        if not current:
            raise HTTPError(404, "Task not found")
        completing = current["status"] != "completed"
    if completing:
        counts = fetchone("""
            SELECT COUNT(*) AS total,
                   COUNT(*) FILTER (WHERE status <> 'completed') AS open
            FROM task_milestones WHERE task_id = %s
        """, (task_id,))
        if counts["total"] > 0:
            if counts["open"] > 0:
                raise HTTPError(
                    400,
                    f"Complete all {counts['total']} milestones before completing "
                    f"this task ({counts['open']} remaining)",
                    code="MILESTONES_INCOMPLETE")
        else:
            verdict = fields.get("outcome") or current["outcome"]
            if not verdict:
                raise HTTPError(400, "An outcome verdict (met / partially met / "
                                "not met / deferred) is required to complete this task",
                                code="OUTCOME_REQUIRED")
            notes = (fields.get("outcome_notes") or current["outcome_notes"] or "").strip()
            if not notes:
                raise HTTPError(400, "Outcome notes are required to complete this task",
                                code="OUTCOME_NOTES_REQUIRED")
            if not any((i.get("title") or "").strip() for i in deliverable_items) \
                    and not _has_task_evidence(task_id):
                raise HTTPError(400, "At least one deliverable (file, link or text) "
                                "is required to complete this task",
                                code="DELIVERABLE_REQUIRED")

    if deliverable_items:
        _insert_deliverables(current_user, deliverable_items, task_id=task_id,
                             submitted_at=completed_date if completing else None)

    if not fields:
        updated = fetchone("SELECT * FROM tasks WHERE id = %s", (task_id,))
        if not updated:
            raise HTTPError(404, "Task not found")
        return resp({"task": updated}, origin=origin)

    if "status" in fields:
        # Stamp completion when finishing (honouring a user-entered end date);
        # clear a stale stamp when re-opening.
        if fields["status"] == "completed":
            fields["completed_at"] = completed_date or "NOW()"
        else:
            fields["completed_at"] = None
    set_clause = ", ".join(f"{k} = NOW()" if v == "NOW()" else f"{k} = %s" for k, v in fields.items())
    params = [v for v in fields.values() if v != "NOW()"] + [task_id]
    updated = execute_returning(f"UPDATE tasks SET {set_clause}, updated_at = NOW() WHERE id = %s RETURNING *", params)
    if not updated:
        raise HTTPError(404, "Task not found")

    if completing:
        # Best-effort history entry — the timeline note is no longer the
        # frontend's job, and its failure must not fail the completion.
        try:
            verdict = fields.get("outcome") or (current["outcome"] if current else None)
            notes = fields.get("outcome_notes") or (current["outcome_notes"] if current else None)
            summary = "Task completed"
            if verdict:
                summary += f" — outcome: {VERDICT_LABEL.get(verdict, verdict)}"
            execute("""
                INSERT INTO task_revisions (task_id, author_id, change_type, summary, details)
                VALUES (%s,%s,'closure',%s,%s)
            """, (task_id, current_user["id"], summary[:500], notes))
        except Exception as e:
            log.warning("Completion revision skipped for task %s: %s", task_id, e)
    # If the user switched hours back to "auto" (not overridden), immediately
    # re-derive the totals from the milestones so the response is consistent.
    if fields.get("hours_overridden") is False:
        _rollup_task_hours(task_id)
        updated = fetchone("SELECT * FROM tasks WHERE id = %s", (task_id,))
    return resp({"task": updated}, origin=origin)


def _delete_task(event, origin, task_id):
    get_current_user(event)
    execute("DELETE FROM tasks WHERE id = %s", (task_id,))
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


# ── Steps ─────────────────────────────────────────────────────────────────────

def _create_step(event, origin, task_id):
    get_current_user(event)
    body = CreateTaskStepRequest(**get_body(event))
    step = execute_returning("""
        INSERT INTO task_steps
          (task_id, description, expected_outcome, category, estimated_hours, assignee_id, order_index)
        VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (task_id, body.description, body.expected_outcome, body.category, body.estimated_hours,
          str(body.assignee_id) if body.assignee_id else None, body.order_index))
    return resp({"step": step}, 201, origin)


def _update_step(event, origin, task_id, step_id):
    get_current_user(event)
    body = UpdateTaskStepRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPError(400, "No fields to update")
    if fields.get("status") == "completed":
        fields["completed_at"] = "NOW()"
    set_clause = ", ".join(f"{k} = NOW()" if v == "NOW()" else f"{k} = %s" for k, v in fields.items())
    params = [v for v in fields.values() if v != "NOW()"] + [step_id, task_id]
    updated = execute_returning(f"UPDATE task_steps SET {set_clause} WHERE id = %s AND task_id = %s RETURNING *", params)
    if not updated:
        raise HTTPError(404, "Step not found")
    return resp({"step": updated}, origin=origin)


# ── Task updates ──────────────────────────────────────────────────────────────

def _add_update(event, origin, task_id):
    current_user = get_current_user(event)
    body = CreateTaskUpdateRequest(**get_body(event))
    update = execute_returning("""
        INSERT INTO task_updates (task_id, user_id, message, revised_estimate)
        VALUES (%s,%s,%s,%s) RETURNING *
    """, (task_id, current_user["id"], body.message, body.revised_estimate))
    if body.revised_estimate is not None:
        execute("UPDATE tasks SET revised_estimate_hours = %s, updated_at = NOW() WHERE id = %s",
                (body.revised_estimate, task_id))
    return resp({"update": update}, 201, origin)


# ── Revisions (history) ──────────────────────────────────────────────────────

def _list_task_revisions(event, origin, task_id):
    get_current_user(event)
    revisions = fetchall("""
        SELECT r.*, u.name AS author_name, u.avatar_color AS author_color,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', a.id, 'title', a.title, 'type', a.type,
              'url', a.url, 'content', a.content, 'created_at', a.created_at
            ) ORDER BY a.created_at)
            FROM task_revision_attachments a WHERE a.revision_id = r.id
          ), '[]'::JSON) AS attachments
        FROM task_revisions r
        LEFT JOIN users u ON u.id = r.author_id
        WHERE r.task_id = %s
        ORDER BY r.created_at DESC
    """, (task_id,))
    return resp({"revisions": revisions}, origin=origin)


def _add_task_revision(event, origin, task_id):
    current_user = get_current_user(event)
    body = get_body(event)
    summary = (body.get("summary") or "").strip()
    if not summary:
        raise HTTPError(400, "summary is required")
    if not fetchone("SELECT 1 FROM tasks WHERE id = %s", (task_id,)):
        raise HTTPError(404, "Task not found")

    revision = execute_returning("""
        INSERT INTO task_revisions
          (task_id, author_id, change_type, summary, details, previous_value, new_value)
        VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (task_id, current_user["id"],
          body.get("change_type", "revision"),
          summary, body.get("details"),
          body.get("previous_value"), body.get("new_value")))

    attachments = []
    for att in (body.get("attachments") or []):
        title = (att.get("title") or "").strip()
        if not title:
            continue
        row = execute_returning("""
            INSERT INTO task_revision_attachments (revision_id, title, type, url, content)
            VALUES (%s,%s,%s,%s,%s) RETURNING *
        """, (revision["id"], title, att.get("type", "url"),
              att.get("url"), att.get("content")))
        attachments.append(row)

    revision["attachments"] = attachments
    revision["author_name"] = current_user.get("name")
    revision["author_color"] = current_user.get("avatar_color")
    return resp({"revision": revision}, 201, origin)


def _delete_task_revision(event, origin, task_id, revision_id):
    current_user = get_current_user(event)
    rev = fetchone(
        "SELECT id, author_id FROM task_revisions WHERE id = %s AND task_id = %s",
        (revision_id, task_id),
    )
    if not rev:
        raise HTTPError(404, "Revision not found")
    is_author = str(rev["author_id"]) == str(current_user["id"])
    is_admin = current_user["role_type"] in ("CEO", "Admin", "Team Lead")
    if not (is_author or is_admin):
        raise HTTPError(403, "Only the author or a CEO/Admin/Team Lead can delete this revision")
    execute("DELETE FROM task_revisions WHERE id = %s", (revision_id,))
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


# ── Task attachments (standalone, not tied to a revision) ────────────────────

def _list_task_attachments(event, origin, task_id):
    get_current_user(event)
    atts = fetchall("""
        SELECT ta.*, u.name AS uploader
        FROM task_attachments ta LEFT JOIN users u ON u.id = ta.uploaded_by
        WHERE ta.task_id = %s ORDER BY ta.created_at DESC
    """, (task_id,))
    return resp({"attachments": atts}, origin=origin)


def _add_task_attachment(event, origin, task_id):
    current_user = get_current_user(event)
    body = get_body(event)
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPError(400, "title is required")
    if not fetchone("SELECT 1 FROM tasks WHERE id = %s", (task_id,)):
        raise HTTPError(404, "Task not found")
    att = execute_returning("""
        INSERT INTO task_attachments (task_id, title, type, uploaded_by, url, content)
        VALUES (%s,%s,%s,%s,%s,%s) RETURNING *
    """, (task_id, title, body.get("type", "url"), current_user["id"],
          body.get("url"), body.get("content")))
    return resp({"attachment": att}, 201, origin)


# ── Milestones ────────────────────────────────────────────────────────────────

def _rollup_task_hours(task_id):
    """Recompute the parent task's estimated/actual hours as the sum of its
    milestones — unless the task is manually overridden (handled in SQL).

    Best-effort: a missing function (migration 019 not yet applied) or any other
    rollup error must NOT fail the milestone create/update/delete it follows."""
    try:
        execute("SELECT fn_rollup_task_hours(%s)", (task_id,))
    except Exception as e:
        log.warning("Task hours rollup skipped for %s: %s", task_id, e)


def _create_milestone(event, origin, task_id):
    get_current_user(event)
    body = CreateMilestoneRequest(**get_body(event))
    ms = execute_returning("""
        INSERT INTO task_milestones
          (task_id, title, description, deliverable_type, success_criteria,
           assignee_id, target_day, start_date, target_date, estimated_hours, order_index)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (task_id, body.title, body.description, body.deliverable_type, json.dumps(body.success_criteria),
          str(body.assignee_id) if body.assignee_id else None, body.target_day,
          body.start_date, body.target_date,
          body.estimated_hours, body.order_index))
    _rollup_task_hours(task_id)
    return resp({"milestone": ms}, 201, origin)


def _update_milestone(event, origin, task_id, ms_id):
    current_user = get_current_user(event)
    body = UpdateMilestoneRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    # Inline deliverable evidence — not a task_milestones column.
    deliverable_items = fields.pop("deliverables", []) or []
    # Actual end date entered at completion — applied as completed_at below.
    completed_date = fields.pop("completed_date", None)
    if not fields and not deliverable_items:
        raise HTTPError(400, "No fields to update")
    if "success_criteria" in fields:
        fields["success_criteria"] = json.dumps(fields["success_criteria"])
    if "assignee_id" in fields and fields["assignee_id"]:
        fields["assignee_id"] = str(fields["assignee_id"])

    # Completion gate — a milestone completes only with a structured verdict,
    # outcome notes, and at least one piece of deliverable evidence.
    completing = False
    current = None
    if fields.get("status") == "completed":
        current = fetchone(
            "SELECT status, outcome, outcome_notes FROM task_milestones "
            "WHERE id = %s AND task_id = %s", (ms_id, task_id))
        if not current:
            raise HTTPError(404, "Milestone not found")
        completing = current["status"] != "completed"
    if completing:
        verdict = fields.get("outcome") or current["outcome"]
        if not verdict:
            raise HTTPError(400, "An outcome verdict (met / partially met / "
                            "not met / deferred) is required to complete this milestone",
                            code="OUTCOME_REQUIRED")
        notes = (fields.get("outcome_notes") or current["outcome_notes"] or "").strip()
        if not notes:
            raise HTTPError(400, "Outcome notes are required to complete this milestone",
                            code="OUTCOME_NOTES_REQUIRED")
        if not any((i.get("title") or "").strip() for i in deliverable_items) \
                and not _has_milestone_evidence(ms_id):
            raise HTTPError(400, "At least one deliverable (file, link or text) "
                            "is required to complete this milestone",
                            code="DELIVERABLE_REQUIRED")

    if deliverable_items:
        _insert_deliverables(current_user, deliverable_items, milestone_id=ms_id,
                             submitted_at=completed_date if completing else None)

    if not fields:
        updated = fetchone(
            "SELECT * FROM task_milestones WHERE id = %s AND task_id = %s", (ms_id, task_id))
        if not updated:
            raise HTTPError(404, "Milestone not found")
        return resp({"milestone": updated}, origin=origin)

    if "status" in fields:
        # Stamp completion when finishing (honouring a user-entered end date);
        # clear a stale stamp when re-opening.
        if fields["status"] == "completed":
            fields["completed_at"] = completed_date or "NOW()"
        else:
            fields["completed_at"] = None
    set_clause = ", ".join(f"{k} = NOW()" if v == "NOW()" else f"{k} = %s" for k, v in fields.items())
    params = [v for v in fields.values() if v != "NOW()"] + [ms_id, task_id]
    updated = execute_returning(f"UPDATE task_milestones SET {set_clause} WHERE id = %s AND task_id = %s RETURNING *", params)
    if not updated:
        raise HTTPError(404, "Milestone not found")
    _rollup_task_hours(task_id)

    if completing:
        # Best-effort history entry; must not fail the completion.
        try:
            verdict = fields.get("outcome") or (current["outcome"] if current else None)
            notes = fields.get("outcome_notes") or (current["outcome_notes"] if current else None)
            summary = "Milestone completed"
            if verdict:
                summary += f" — outcome: {VERDICT_LABEL.get(verdict, verdict)}"
            execute("""
                INSERT INTO milestone_revisions (milestone_id, author_id, change_type, summary, details)
                VALUES (%s,%s,'closure',%s,%s)
            """, (ms_id, current_user["id"], summary[:500], notes))
        except Exception as e:
            log.warning("Completion revision skipped for milestone %s: %s", ms_id, e)
    return resp({"milestone": updated}, origin=origin)


def _delete_milestone(event, origin, task_id, ms_id):
    get_current_user(event)
    deleted = execute_returning(
        "DELETE FROM task_milestones WHERE id = %s AND task_id = %s RETURNING id",
        (ms_id, task_id),
    )
    if not deleted:
        raise HTTPError(404, "Milestone not found")
    _rollup_task_hours(task_id)
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


# ── Milestone revisions (history) — mirrors task revisions ────────────────────

def _list_milestone_revisions(event, origin, task_id, ms_id):
    get_current_user(event)
    revisions = fetchall("""
        SELECT r.*, u.name AS author_name, u.avatar_color AS author_color,
          COALESCE((
            SELECT json_agg(json_build_object(
              'id', a.id, 'title', a.title, 'type', a.type,
              'url', a.url, 'content', a.content, 'created_at', a.created_at
            ) ORDER BY a.created_at)
            FROM milestone_revision_attachments a WHERE a.revision_id = r.id
          ), '[]'::JSON) AS attachments
        FROM milestone_revisions r
        LEFT JOIN users u ON u.id = r.author_id
        WHERE r.milestone_id = %s
        ORDER BY r.created_at DESC
    """, (ms_id,))
    return resp({"revisions": revisions}, origin=origin)


def _add_milestone_revision(event, origin, task_id, ms_id):
    current_user = get_current_user(event)
    body = get_body(event)
    summary = (body.get("summary") or "").strip()
    if not summary:
        raise HTTPError(400, "summary is required")
    if not fetchone(
        "SELECT 1 FROM task_milestones WHERE id = %s AND task_id = %s", (ms_id, task_id)
    ):
        raise HTTPError(404, "Milestone not found")

    revision = execute_returning("""
        INSERT INTO milestone_revisions
          (milestone_id, author_id, change_type, summary, details, previous_value, new_value)
        VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (ms_id, current_user["id"],
          body.get("change_type", "revision"),
          summary, body.get("details"),
          body.get("previous_value"), body.get("new_value")))

    attachments = []
    for att in (body.get("attachments") or []):
        title = (att.get("title") or "").strip()
        if not title:
            continue
        row = execute_returning("""
            INSERT INTO milestone_revision_attachments (revision_id, title, type, url, content)
            VALUES (%s,%s,%s,%s,%s) RETURNING *
        """, (revision["id"], title, att.get("type", "url"),
              att.get("url"), att.get("content")))
        attachments.append(row)

    revision["attachments"] = attachments
    revision["author_name"] = current_user.get("name")
    revision["author_color"] = current_user.get("avatar_color")
    return resp({"revision": revision}, 201, origin)


def _delete_milestone_revision(event, origin, task_id, ms_id, revision_id):
    current_user = get_current_user(event)
    rev = fetchone(
        "SELECT id, author_id FROM milestone_revisions WHERE id = %s AND milestone_id = %s",
        (revision_id, ms_id),
    )
    if not rev:
        raise HTTPError(404, "Revision not found")
    is_author = str(rev["author_id"]) == str(current_user["id"])
    is_admin = current_user["role_type"] in ("CEO", "Admin", "Team Lead")
    if not (is_author or is_admin):
        raise HTTPError(403, "Only the author or a CEO/Admin/Team Lead can delete this revision")
    execute("DELETE FROM milestone_revisions WHERE id = %s", (revision_id,))
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


# Static deadline-extension routes BEFORE dynamic /<task_id>
handler = make_handler([
    ("POST",   r"/api/tasks/deadline-extensions",                                             _create_extension),
    ("PATCH",  rf"/api/tasks/deadline-extensions/(?P<ext_id>{PARAM})",                        _update_extension),
    ("GET",    r"/api/tasks",                                                                  _list_tasks),
    ("POST",   r"/api/tasks",                                                                  _create_task),
    ("POST",   rf"/api/tasks/(?P<task_id>{PARAM})/steps",                                     _create_step),
    ("PATCH",  rf"/api/tasks/(?P<task_id>{PARAM})/steps/(?P<step_id>{PARAM})",                _update_step),
    ("POST",   rf"/api/tasks/(?P<task_id>{PARAM})/updates",                                   _add_update),
    ("GET",    rf"/api/tasks/(?P<task_id>{PARAM})/revisions",                                 _list_task_revisions),
    ("POST",   rf"/api/tasks/(?P<task_id>{PARAM})/revisions",                                 _add_task_revision),
    ("DELETE", rf"/api/tasks/(?P<task_id>{PARAM})/revisions/(?P<revision_id>{PARAM})",        _delete_task_revision),
    ("GET",    rf"/api/tasks/(?P<task_id>{PARAM})/attachments",                               _list_task_attachments),
    ("POST",   rf"/api/tasks/(?P<task_id>{PARAM})/attachments",                               _add_task_attachment),
    ("POST",   rf"/api/tasks/(?P<task_id>{PARAM})/milestones",                                _create_milestone),
    ("GET",    rf"/api/tasks/(?P<task_id>{PARAM})/milestones/(?P<ms_id>{PARAM})/revisions",                          _list_milestone_revisions),
    ("POST",   rf"/api/tasks/(?P<task_id>{PARAM})/milestones/(?P<ms_id>{PARAM})/revisions",                          _add_milestone_revision),
    ("DELETE", rf"/api/tasks/(?P<task_id>{PARAM})/milestones/(?P<ms_id>{PARAM})/revisions/(?P<revision_id>{PARAM})", _delete_milestone_revision),
    ("PATCH",  rf"/api/tasks/(?P<task_id>{PARAM})/milestones/(?P<ms_id>{PARAM})",             _update_milestone),
    ("DELETE", rf"/api/tasks/(?P<task_id>{PARAM})/milestones/(?P<ms_id>{PARAM})",             _delete_milestone),
    ("POST",   rf"/api/tasks/(?P<task_id>{PARAM})/assignees",                                 _add_task_assignee),
    ("DELETE", rf"/api/tasks/(?P<task_id>{PARAM})/assignees/(?P<user_id>{PARAM})",            _remove_task_assignee),
    ("GET",    rf"/api/tasks/(?P<task_id>{PARAM})",                                           _get_task),
    ("PATCH",  rf"/api/tasks/(?P<task_id>{PARAM})",                                           _update_task),
    ("DELETE", rf"/api/tasks/(?P<task_id>{PARAM})",                                           _delete_task),
])
