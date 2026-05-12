"""Projects Lambda handler — /api/projects/*"""
import base64
import json
import logging
import uuid

import boto3
from botocore.exceptions import ClientError

from .base import PARAM, get_body, get_query, make_handler, resp
from ..auth import get_current_user, require_auth
from ..config import get_settings
from ..database import call_fn, call_proc, execute, execute_returning, fetchall
from ..exceptions import HTTPError
from ..models.requests import (
    CreateProjectRequest, CreateProjectUpdateRequest, UpdateProjectRequest,
    MultipartCompleteRequest,
)

log = logging.getLogger(__name__)


def _timeline(event, origin):
    get_current_user(event)
    return resp(call_fn("fn_timeline_data") or {"projects": []}, origin=origin)


def _global_search(event, origin):
    get_current_user(event)
    q = get_query(event).get("q", "")
    if len(q) < 2:
        raise HTTPError(400, "Query must be at least 2 characters")
    return resp(call_fn("fn_global_search", q) or {"projects": [], "tasks": [], "users": []}, origin=origin)


def _list_projects(event, origin):
    get_current_user(event)
    p = get_query(event)
    result = call_fn(
        "fn_projects_list",
        p.get("status"), p.get("type"), p.get("priority"),
        p.get("owner_id"), p.get("assignee_id"), p.get("search"),
        int(p.get("limit", 50)), int(p.get("offset", 0)),
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


def _create_project(event, origin):
    get_current_user(event)
    body = CreateProjectRequest(**get_body(event))
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
    if body.document_url:
        execute(
            "UPDATE projects SET metadata = jsonb_set(metadata, '{document_url}', %s::jsonb) WHERE id = %s",
            (json.dumps(body.document_url), str(project_id)),
        )
    return resp({"project": call_fn("fn_project_full", str(project_id))}, 201, origin)


def _get_project(event, origin, project_id):
    get_current_user(event)
    data = call_fn("fn_project_full", project_id)
    if not data:
        raise HTTPError(404, "Project not found")
    return resp({"project": data}, origin=origin)


def _update_project(event, origin, project_id):
    get_current_user(event)
    body = UpdateProjectRequest(**get_body(event))
    fields = {k: v for k, v in body.model_dump().items() if v is not None}
    if not fields:
        raise HTTPError(400, "No fields to update")
    for key in ("tech_stack", "ai_plan"):
        if key in fields:
            fields[key] = json.dumps(fields[key])
    updated = execute_returning(
        f"UPDATE projects SET {', '.join(f'{k} = %s' for k in fields)}, updated_at = NOW() "
        f"WHERE id = %s RETURNING id, title, status, priority, updated_at",
        list(fields.values()) + [project_id],
    )
    if not updated:
        raise HTTPError(404, "Project not found")
    return resp({"project": updated}, origin=origin)


def _delete_project(event, origin, project_id):
    require_auth(event, "CEO", "Admin", "Team Lead")
    if execute("DELETE FROM projects WHERE id = %s", (project_id,)) == 0:
        raise HTTPError(404, "Project not found")
    return {"statusCode": 204, "headers": {"Access-Control-Allow-Origin": origin}, "body": ""}


def _project_tasks(event, origin, project_id):
    get_current_user(event)
    tasks = fetchall("""
        SELECT
          t.id, t.title, t.status, t.priority, t.assignee_id,
          t.estimated_hours, t.actual_hours, t.plan_status,
          t.review_status, t.order_index, t.phase_id, t.created_at, t.completed_at,
          u.name AS assignee_name, u.avatar_color AS assignee_color, ph.phase_name,
          (SELECT COUNT(*) FROM task_steps ts WHERE ts.task_id = t.id) AS step_count,
          (SELECT COUNT(*) FROM task_milestones tm WHERE tm.task_id = t.id) AS milestone_count
        FROM tasks t
        LEFT JOIN users u  ON u.id  = t.assignee_id
        LEFT JOIN phases ph ON ph.id = t.phase_id
        WHERE t.project_id = %s
        ORDER BY t.order_index, t.created_at
    """, (project_id,))
    return resp({"tasks": tasks}, origin=origin)


def _project_kanban(event, origin, project_id):
    get_current_user(event)
    return resp(call_fn("fn_kanban_board", project_id) or {"columns": {}}, origin=origin)


def _project_updates(event, origin, project_id):
    get_current_user(event)
    updates = fetchall("""
        SELECT pu.*, u.name AS author_name, u.avatar_color
        FROM project_updates pu JOIN users u ON u.id = pu.user_id
        WHERE pu.project_id = %s ORDER BY pu.created_at DESC LIMIT 50
    """, (project_id,))
    return resp({"updates": updates}, origin=origin)


def _create_update(event, origin, project_id):
    current_user = get_current_user(event)
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
    get_current_user(event)
    docs = fetchall("SELECT * FROM project_documents WHERE project_id = %s ORDER BY updated_at DESC", (project_id,))
    return resp({"documents": docs}, origin=origin)


def _project_insights(event, origin, project_id):
    get_current_user(event)
    insights = fetchall("""
        SELECT ai.*, u.name AS user_name
        FROM ai_insights ai LEFT JOIN users u ON u.id = ai.user_id
        WHERE ai.project_id = %s AND ai.status = 'active'
        ORDER BY CASE ai.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END
    """, (project_id,))
    return resp({"insights": insights}, origin=origin)


def _project_checkpoints(event, origin, project_id):
    get_current_user(event)
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
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/insights",     _project_insights),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})/checkpoints",  _project_checkpoints),
    ("GET",    rf"/api/projects/(?P<project_id>{PARAM})",              _get_project),
    ("PATCH",  rf"/api/projects/(?P<project_id>{PARAM})",              _update_project),
    ("DELETE", rf"/api/projects/(?P<project_id>{PARAM})",              _delete_project),
])
