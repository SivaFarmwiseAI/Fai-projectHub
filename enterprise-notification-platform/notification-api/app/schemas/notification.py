from pydantic import BaseModel
from typing import Literal


class CreateNotificationRequest(BaseModel):
    applicationId: str
    userId: str
    title: str
    message: str

    type: Literal[
        "info",
        "success",
        "warning",
        "error",
        "critical"
    ]

    category: Literal[
        "TASK",
        "APPROVAL",
        "SYSTEM",
        "SECURITY",
        "CHAT"
    ]

    priority: Literal[
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL"
    ]


class Notification(BaseModel):
    id: str

    applicationId: str

    userId: str

    title: str

    message: str

    type: Literal[
        "info",
        "success",
        "warning",
        "error",
        "critical"
    ]

    category: Literal[
        "TASK",
        "APPROVAL",
        "SYSTEM",
        "SECURITY",
        "CHAT"
    ]

    priority: Literal[
        "LOW",
        "MEDIUM",
        "HIGH",
        "CRITICAL"
    ]

    isRead: bool = False

    createdAt: str