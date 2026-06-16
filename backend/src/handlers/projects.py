"""Projects Lambda handler — /api/projects/*"""
import base64
import json
import logging
import uuid
from urllib.parse import unquote, urlparse

import boto3
from botocore.exceptions import ClientError

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user, require_auth
from ..config import get_settings
from ..database import call_fn, call_proc, execute, execute_returning, fetchall, fetchone
from ..exceptions import HTTPError
from ..models.requests import (
    CreateProjectRequest, CreateProjectUpdateRequest, UpdateProjectRequest,
    MultipartCompleteRequest,
)

log = logging.getLogger(__name__)

# Roles that may view every project regardless of assignment.
# Team Leads and Members are scoped to projects they own, co-own, or are
# assigned to.
_PRIVILEGED_ROLES = ("CEO", "Admin")


def _require_view_access(event, project_id):
    """Authenticate the caller and ensure they may view this project.

    CEO/Admin can view everything. A Team Lead or Member may only view a
    project they own, co-own, or are assigned to. Raises 404 if the project
    does not exist and 403 if it exists but the caller is not on it.
    Returns the current user dict on success.
    """
    user = get_current_user(event)
    if user["role_type"] in _PRIVILEGED_ROLES:
        return user
    row = fetchone(
        """
        SELECT (
              p.owner_id = %s
           OR EXISTS (SELECT 1 FROM project_co_owners co
                        WHERE co.project_id = p.id AND co.user_id = %s)
           OR EXISTS (SELECT 1 FROM project_assignees pa
                        WHERE pa.project_id = p.id AND pa.user_id = %s)
        ) AS has_access
        FROM projects p
        WHERE p.id = %s
        """,
        (user["id"], user["id"], user["id"], project_id),
    )
    if row is None:
        raise HTTPError(404, "Project not found")
    if not row["has_access"]:
        raise HTTPError(403, "You do not have access to this project")
    return user


def _timeline(event, origin):
    current_user = get_current_user(event)
    return resp(
        call_fn("fn_timeline_data", current_user["id"], current_user["role_type"])
        or {"projects": []},
        origin=origin,
    )


def _global_search(event, origin):
    current_user = get_current_user(event)
    q = get_query(event).get("q", "")
    if len(q) < 2:
        raise HTTPError(400, "Query must be at least 2 characters")
    return resp(
        call_fn("fn_global_search", q, current_user["id"], current_user["role_type"])
        or {"projects": [], "tasks": [], "users": []},
        origin=origin,
    )


def _list_projects(event, origin):
    current_user = get_current_user(event)
    p = get_query(event)
    # Team Leads and Members only see projects they own, co-own, or are
    # assigned to. CEO/Admin (or NULL viewer) see everything. The viewer
    # scoping is applied inside fn_projects_list so pagination/totals stay
    # correct.
    result = call_fn(
        "fn_projects_list",
        p.get("status"), p.get("type"), p.get("priority"),
        p.get("owner_id"), p.get("assignee_id"), p.get("search"),
        int(p.get("limit", 50)), int(p.get("offset", 0)),
        current_user["id"], current_user["role_type"],
    )
    return resp(result or {"projects": [], "total": 0}, origin=origin)


_PART_SIZE = 10 * 1024 * 1024  # 10 MB — minimum S3 part size is 5 MB


def _upload_file(event, origin):
    """Single-shot server-side upload — accepts base64 JSON, no browser→S3 CORS needed."""
    get_current_user(event)
    settings = get_settings()
    if not settings.s3_bucket or not settings.cloudfront_domain:
        raise HTTPError(503, "File upload not configured")
    body = get_body(event)
    filename = body.get("filename", "upload")
    content_type = body.get("content_type", "application/octet-stream")
    data_b64 = body.get("data", "")
    if not data_b64:
        raise HTTPError(400, "data is required (base64-encoded file content)")
    try:
        file_bytes = base64.b64decode(data_b64)
    except Exception:
        raise HTTPError(400, "Invalid base64 data")
    if len(file_bytes) > 8 * 1024 * 1024:
        raise HTTPError(413, "File too large — max 8 MB")
    key = f"projects/briefs/{uuid.uuid4()}/{filename}"
    try:
        s3 = boto3.client("s3", region_name=settings.s3_region)
        s3.put_object(Bucket=settings.s3_bucket, Key=key, Body=file_bytes, ContentType=content_type)
    except ClientError as e:
        log.error("S3 put_object error: %s", e)
        raise HTTPError(500, "Failed to upload file")
    return resp({"url": f"https://{settings.cloudfront_domain}/{key}", "key": key}, origin=origin)


def _multipart_start(event, origin):
    get_current_user(event)
    settings = get_settings()
    if not settings.s3_bucket or not settings.cloudfront_domain:
        raise HTTPError(503, "File upload not configured")
    p = get_query(event)
    filename = p.get("filename", "upload")
    content_type = p.get("content_type", "application/octet-stream")
    try:
        file_size = int(p.get("file_size", 0))
    except (ValueError, TypeError):
        file_size = 0
    if file_size <= 0:
        raise HTTPError(400, "file_size query parameter is required")

    key = f"projects/briefs/{uuid.uuid4()}/{filename}"
    num_parts = max(1, (file_size + _PART_SIZE - 1) // _PART_SIZE)

    try:
        s3 = boto3.client("s3", region_name=settings.s3_region)
        upload_id = s3.create_multipart_upload(
            Bucket=settings.s3_bucket,
            Key=key,
            ContentType=content_type,
        )["UploadId"]
        part_urls = [
            s3.generate_presigned_url(
                "upload_part",
                Params={"Bucket": settings.s3_bucket, "Key": key,
                        "UploadId": upload_id, "PartNumber": pn},
                ExpiresIn=3600,
            )
            for pn in range(1, num_parts + 1)
        ]
    except ClientError as e:
        log.error("S3 multipart start error: %s", e)
        raise HTTPError(500, "Failed to initiate upload")

    return resp({
        "upload_id": upload_id,
        "key": key,
        "part_urls": part_urls,
        "part_size": _PART_SIZE,
        "cloudfront_url": f"https://{settings.cloudfront_domain}/{key}",
    }, origin=origin)


def _multipart_complete(event, origin):
    get_current_user(event)
    settings = get_settings()
    if not settings.s3_bucket or not settings.cloudfront_domain:
        raise HTTPError(503, "File upload not configured")
    body = MultipartCompleteRequest(**get_body(event))
    try:
        s3 = boto3.client("s3", region_name=settings.s3_region)
        s3.complete_multipart_upload(
            Bucket=settings.s3_bucket,
            Key=body.key,
            UploadId=body.upload_id,
            MultipartUpload={
                "Parts": [
                    {"ETag": p.etag, "PartNumber": p.part_number}
                    for p in sorted(body.parts, key=lambda x: x.part_number)
                ]
            },
        )
    except ClientError as e:
        log.error("S3 multipart complete error: %s", e)
        raise HTTPError(500, "Failed to complete upload")

    return resp({"cloudfront_url": f"https://{settings.cloudfront_domain}/{body.key}"}, origin=origin)


def _filename_from_url(url: str) -> str:
    try:
        path = urlparse(url).path
        return unquote(path.rsplit("/", 1)[-1]) or "document"
    except Exception:
        return "document"


def _create_project(event, origin):
    current_user = get_current_user(event)
    data = get_body(event)
    log.info(f"DEBUG: Creating project with payload: {json.dumps(data)}")

    body = CreateProjectRequest(**data)
    project_id = call_proc(
        "fn_create_project",
        body.title, body.type, body.requirement, body.objective,
        body.outcome_type, body.outcome_description, body.priority,
        str(body.owner_id),
        [str(u) for u in body.assignee_ids] or None,
        [str(u) for u in body.co_owner_ids] or None,
        body.timebox_days, body.start_date,
        json.dumps(body.tech_stack), json.dumps(body.ai_plan),
    )
    if not project_id:
        raise HTTPError(500, "Project creation failed")
    if body.end_date:
        execute(
            "UPDATE projects SET end_date = %s WHERE id = %s",
            (body.end_date, str(project_id)),
        )
    if body.document_url:
        execute(
            "UPDATE projects SET metadata = jsonb_set(metadata, '{document_url}', %s::jsonb) WHERE id = %s",
            (json.dumps(body.document_url), str(project_id)),
        )
        file_name = _filename_from_url(body.document_url)
        execute(
            """
            INSERT INTO project_documents
              (project_id, type, title, status, file_url, file_name, created_by)
            VALUES (%s, 'requirement', %s, 'active', %s, %s, %s)
            """,
            (str(project_id), file_name, body.document_url, file_name, current_user["id"]),
        )
    return resp({"project": call_fn("fn_project_full", str(project_id))}, 201, origin)


def _get_project(event, origin, project_id):
    _require_view_access(event, project_id)
    data = call_fn("fn_project_full", project_id)
    if not data:
        raise HTTPError(404, "Project not found")
    return resp({"project": data}, origin=origin)


def _update_project(event, origin, project_id):
    current_user = _require_view_access(event, project_id)
    body = UpdateProjectRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPError(400, "No fields to update")
    # document_url is handled separately — it's not a column on projects
    document_url = fields.pop("document_url", None)
    for key in ("tech_stack", "ai_plan"):
        if key in fields:
            fields[key] = json.dumps(fields[key])
    if fields:
        updated = execute_returning(
            f"UPDATE projects SET {', '.join(f'{k} = %s' for k in fields)}, updated_at = NOW() "
            f"WHERE id = %s RETURNING id, title, status, priority, updated_at",
            list(fields.values()) + [project_id],
        )
        if not updated:
            raise HTTPError(404, "Project not found")
    else:
        updated = execute_returning(
            "SELECT id, title, status, priority, updated_at FROM projects WHERE id = %s",
            (project_id,),
        )
        if not updated:
            raise HTTPError(404, "Project not found")
    if document_url:
        execute(
            "UPDATE projects SET metadata = jsonb_set(metadata, '{document_url}', %s::jsonb) WHERE id = %s",
            (json.dumps(document_url), project_id),
        )
        file_name = _filename_from_url(document_url)
        execute(
            """
            INSERT INTO project_documents
              (project_id, type, title, status, file_url, file_name, created_by)
            VALUES (%s, 'custom', %s, 'active', %s, %s, %s)
            """,
            (project_id, file_name, document_url, file_name, current_user["id"]),
        )
    return resp({"project": updated}, origin=origin)


def _can_manage_team(current_user, project_id):
    if current_user["role_type"] in ("CEO", "Admin"):
        return True
    owner = fetchone("SELECT owner_id FROM projects WHERE id = %s", (project_id,))
    if not owner:
        raise HTTPError(404, "Project not found")
    return str(owner["owner_id"]) == str(current_user["id"])


def _add_project_assignee(event, origin, project_id):
    current_user = get_current_user(event)
    if not _can_manage_team(current_user, project_id):
        raise HTTPError(403, "Only project owner, CEO, or Admin can manage team")
    body = get_body(event)
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPError(400, "user_id is required")
    if not fetchone("SELECT 1 FROM users WHERE id = %s AND is_active", (user_id,)):
        raise HTTPError(404, "User not found")
    execute(
        "INSERT INTO project_assignees (project_id, user_id) VALUES (%s, %s) "
        "ON CONFLICT DO NOTHING",
        (project_id, user_id),
    )
    return resp({"project_id": project_id, "user_id": user_id, "role": "assignee"}, 201, origin)


def _remove_project_assignee(event, origin, project_id, user_id):
    current_user = get_current_user(event)
    if not _can_manage_team(current_user, project_id):
        raise HTTPError(403, "Only project owner, CEO, or Admin can manage team")
    owner = fetchone("SELECT owner_id FROM projects WHERE id = %s", (project_id,))
    if owner and str(owner["owner_id"]) == str(user_id):
        raise HTTPError(400, "Cannot remove project owner. Transfer ownership first.")
    execute(
        "DELETE FROM project_assignees WHERE project_id = %s AND user_id = %s",
        (project_id, user_id),
    )
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


def _add_project_co_owner(event, origin, project_id):
    current_user = get_current_user(event)
    if not _can_manage_team(current_user, project_id):
        raise HTTPError(403, "Only project owner, CEO, or Admin can manage team")
    body = get_body(event)
    user_id = body.get("user_id")
    if not user_id:
        raise HTTPError(400, "user_id is required")
    if not fetchone("SELECT 1 FROM users WHERE id = %s AND is_active", (user_id,)):
        raise HTTPError(404, "User not found")
    execute(
        "INSERT INTO project_co_owners (project_id, user_id) VALUES (%s, %s) "
        "ON CONFLICT DO NOTHING",
        (project_id, user_id),
    )
    return resp({"project_id": project_id, "user_id": user_id, "role": "co_owner"}, 201, origin)


def _remove_project_co_owner(event, origin, project_id, user_id):
    current_user = get_current_user(event)
    if not _can_manage_team(current_user, project_id):
        raise HTTPError(403, "Only project owner, CEO, or Admin can manage team")
    execute(
        "DELETE FROM project_co_owners WHERE project_id = %s AND user_id = %s",
        (project_id, user_id),
    )
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


def _delete_project(event, origin, project_id):
    # CEO/Admin may delete any project; a Team Lead may only delete a project
    # they own. Members cannot delete projects at all.
    current_user = require_auth(event, "CEO", "Admin", "Team Lead")
    if not _can_manage_team(current_user, project_id):
        raise HTTPError(403, "Only the project owner, CEO, or Admin can delete this project")
    try:
        deleted = execute("DELETE FROM projects WHERE id = %s", (project_id,))
    except Exception as e:
        # pg8000 surfaces FK violations as a generic DatabaseError; the message
        # contains the constraint name, which is the actionable bit for ops.
        msg = str(e)
        log.error("Project delete failed for %s: %s", project_id, msg)
        if "foreign key" in msg.lower() or "violates" in msg.lower():
            raise HTTPError(409, f"Cannot delete project — related records still reference it ({msg})")
        raise HTTPError(500, "Failed to delete project")
    if deleted == 0:
        raise HTTPError(404, "Project not found")
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


def _project_tasks(event, origin, project_id):
    _require_view_access(event, project_id)
    # Return the FULL task shape (steps, milestones, criteria, deadline
    # extensions, …) — not just counts. The project-detail page renders nested
    # milestones/steps from these arrays and refetches this endpoint after every
    # mutation, so a thin summary leaves created/updated milestones invisible.
    rows = fetchall("""
        SELECT fn_task_full(t.id) AS task
        FROM tasks t
        WHERE t.project_id = %s
        ORDER BY t.order_index, t.created_at
    """, (project_id,))
    tasks = [r["task"] for r in rows]
    return resp({"tasks": tasks}, origin=origin)


def _project_kanban(event, origin, project_id):
    _require_view_access(event, project_id)
    return resp(call_fn("fn_kanban_board", project_id) or {"columns": {}}, origin=origin)


def _project_updates(event, origin, project_id):
    _require_view_access(event, project_id)
    updates = fetchall("""
        SELECT pu.*, u.name AS author_name, u.avatar_color
        FROM project_updates pu JOIN users u ON u.id = pu.user_id
        WHERE pu.project_id = %s ORDER BY pu.created_at DESC LIMIT 50
    """, (project_id,))
    return resp({"updates": updates}, origin=origin)


def _create_update(event, origin, project_id):
    current_user = _require_view_access(event, project_id)
    body = CreateProjectUpdateRequest(**get_body(event))
    update = execute_returning("""
        INSERT INTO project_updates
          (project_id, user_id, type, title, description, link,
           what_was_done, blockers, next_steps, attendees, decisions, action_items)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING *
    """, (project_id, current_user["id"], body.type, body.title, body.description, body.link,
          body.what_was_done, body.blockers, body.next_steps,
          json.dumps(body.attendees), json.dumps(body.decisions), json.dumps(body.action_items)))
    return resp({"update": update}, 201, origin)


def _project_documents(event, origin, project_id):
    _require_view_access(event, project_id)
    docs = fetchall("SELECT * FROM project_documents WHERE project_id = %s ORDER BY updated_at DESC", (project_id,))
    return resp({"documents": docs}, origin=origin)


def _delete_document(event, origin, project_id, doc_id):
    _require_view_access(event, project_id)
    if execute(
        "DELETE FROM project_documents WHERE id = %s AND project_id = %s",
        (doc_id, project_id),
    ) == 0:
        raise HTTPError(404, "Document not found")
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


def _project_insights(event, origin, project_id):
    _require_view_access(event, project_id)
    insights = fetchall("""
        SELECT ai.*, u.name AS user_name
        FROM ai_insights ai LEFT JOIN users u ON u.id = ai.user_id
        WHERE ai.project_id = %s AND ai.status = 'active'
        ORDER BY CASE ai.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    """, (project_id,))
    return resp({"insights": insights}, origin=origin)


def _project_checkpoints(event, origin, project_id):
    _require_view_access(event, project_id)
    rows = fetchall("""
        SELECT c.*, u.name AS decided_by_name
        FROM checkpoints c LEFT JOIN users u ON u.id = c.decided_by
        WHERE c.project_id = %s ORDER BY c.created_at DESC
    """, (project_id,))
    return resp({"checkpoints": rows}, origin=origin)


# Static routes BEFORE dynamic /<project_id> to prevent shadowing
handler = make_handler([
    ("GET",    r"/api/projects/timeline/all",                         _timeline),
    ("GET",    r"/api/projects/search/global",                        _global_search),
    ("POST",   r"/api/projects/upload/file",                          _upload_file),
    ("GET",    r"/api/projects/upload/multipart/start",               _multipart_start),
    ("POST",   r"/api/projects/upload/multipart/complete",            _multipart_complete),
    ("GET",    r"/api/projects",                                      _list_projects),
    ("POST",   r"/api/projects",                                      _create_project),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/tasks",        _project_tasks),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/kanban",       _project_kanban),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/updates",      _project_updates),
    ("POST",   rf"/api/projects/(?P<project_id>{PARAM})/updates",      _create_update),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/documents",    _project_documents),
    ("DELETE", rf"/api/projects/(?P<project_id>{PARAM})/documents/(?P<doc_id>{PARAM})", _delete_document),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/insights",     _project_insights),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/checkpoints",  _project_checkpoints),
    ("POST",   rf"/api/projects/(?P<project_id>{PARAM})/assignees",    _add_project_assignee),
    ("DELETE", rf"/api/projects/(?P<project_id>{PARAM})/assignees/(?P<user_id>{PARAM})", _remove_project_assignee),
    ("POST",   rf"/api/projects/(?P<project_id>{PARAM})/co-owners",    _add_project_co_owner),
    ("DELETE", rf"/api/projects/(?P<project_id>{PARAM})/co-owners/(?P<user_id>{PARAM})", _remove_project_co_owner),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})",              _get_project),
    ("PATCH",  rf"/api/projects/(?P<project_id>{PARAM})",              _update_project),
    ("DELETE", rf"/api/projects/(?P<project_id>{PARAM})",              _delete_project),
])
