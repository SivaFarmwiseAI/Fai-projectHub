from fastapi import APIRouter
import uuid
from datetime import datetime, timezone

from app.schemas.notification import CreateNotificationRequest
from app.websocket.manager import manager
from app.database.db import get_connection

router = APIRouter()


@router.post("/notifications")
async def create_notification(
    request: CreateNotificationRequest
):
    notification = {
        "id": str(uuid.uuid4()),
        "applicationId": request.applicationId,
        "userId": request.userId,
        "title": request.title,
        "message": request.message,
        "type": request.type,
        "category": request.category,
        "priority": request.priority,
        "isRead": False,
        "createdAt": datetime.now(timezone.utc).isoformat()
    }

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        INSERT INTO notifications
        (
            id,
            application_id,
            user_id,
            title,
            message,
            type,
            category,
            priority,
            is_read,
            created_at
        )
        VALUES
        (
            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s
        )
        """,
        (
            notification["id"],
            notification["applicationId"],
            notification["userId"],
            notification["title"],
            notification["message"],
            notification["type"],
            notification["category"],
            notification["priority"],
            False,
            datetime.now(timezone.utc)
        )
    )

    conn.commit()

    cursor.close()
    conn.close()

    await manager.broadcast({
        "event": "notification.created",
        "applicationId": request.applicationId,
        "userId": request.userId,
        "data": notification
    })

    return {
        "success": True,
        "data": notification
    }


@router.get("/notifications")
def get_notifications(
    applicationId: str,
    userId: str
):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT
            id,
            application_id,
            user_id,
            title,
            message,
            type,
            category,
            priority,
            is_read,
            created_at
        FROM notifications
        WHERE application_id=%s
        AND user_id=%s
        ORDER BY created_at DESC
        """,
        (
            applicationId,
            userId
        )
    )

    rows = cursor.fetchall()

    cursor.close()
    conn.close()

    return [
        {
            "id": row[0],
            "applicationId": row[1],
            "userId": row[2],
            "title": row[3],
            "message": row[4],
            "type": row[5],
            "category": row[6],
            "priority": row[7],
            "isRead": row[8],
            "createdAt": row[9].isoformat()
            if row[9]
            else None
        }
        for row in rows
    ]


@router.put("/notifications/{notification_id}/read")
def mark_read(notification_id: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        UPDATE notifications
        SET is_read = TRUE
        WHERE id=%s
        """,
        (notification_id,)
    )

    conn.commit()

    updated = cursor.rowcount

    cursor.close()
    conn.close()

    return {
        "success": updated > 0
    }


@router.delete("/notifications/{notification_id}")
def delete_notification(notification_id: str):
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        DELETE FROM notifications
        WHERE id=%s
        """,
        (notification_id,)
    )

    conn.commit()

    deleted = cursor.rowcount

    cursor.close()
    conn.close()

    return {
        "success": deleted > 0
    }