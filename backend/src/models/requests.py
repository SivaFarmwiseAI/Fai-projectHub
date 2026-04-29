"""Pydantic v2 request models for all Lambda handlers."""
from __future__ import annotations

from datetime import date
from typing import Any, List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class CreateUserRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "Member"
    role_type: str = "Member"
    department: str = "General"
    avatar_color: str = "#64748b"


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    role: Optional[str] = None
    department: Optional[str] = None
    avatar_color: Optional[str] = None


# ── Projects ──────────────────────────────────────────────────────────────────

class CreateProjectRequest(BaseModel):
    title: str
    type: str
    requirement: str = ""
    objective: str = ""
    outcome_type: str = "other"
    outcome_description: str = ""
    priority: str = "medium"
    owner_id: UUID
    assignee_ids: List[UUID] = Field(default_factory=list)
    co_owner_ids: List[UUID] = Field(default_factory=list)
    timebox_days: int = 14
    start_date: Optional[str] = None
    tech_stack: List[str] = Field(default_factory=list)
    ai_plan: dict = Field(default_factory=dict)


class UpdateProjectRequest(BaseModel):
    title: Optional[str] = None
    type: Optional[str] = None
    requirement: Optional[str] = None
    objective: Optional[str] = None
    outcome_type: Optional[str] = None
    outcome_description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    current_phase: Optional[str] = None
    timebox_days: Optional[int] = None
    tech_stack: Optional[List[str]] = None
    ai_plan: Optional[dict] = None


class CreateProjectUpdateRequest(BaseModel):
    type: str = "general"
    title: str = ""
    description: str = ""
    link: Optional[str] = None
    what_was_done: Optional[str] = None
    blockers: Optional[str] = None
    next_steps: Optional[str] = None
    attendees: List[str] = Field(default_factory=list)
    decisions: List[str] = Field(default_factory=list)
    action_items: List[str] = Field(default_factory=list)


# ── Phases ────────────────────────────────────────────────────────────────────

class CreatePhaseRequest(BaseModel):
    project_id: UUID
    phase_name: str
    description: Optional[str] = None
    order_index: int = 0
    sign_off_required: bool = False
    estimated_duration: Optional[str] = None
    checklist: List[str] = Field(default_factory=list)


class UpdatePhaseRequest(BaseModel):
    status: Optional[str] = None
    checklist: Optional[List[str]] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None


# ── Tasks ─────────────────────────────────────────────────────────────────────

class CreateTaskRequest(BaseModel):
    project_id: UUID
    phase_id: Optional[UUID] = None
    title: str
    description: str = ""
    assignee_id: Optional[UUID] = None
    approach: str = ""
    priority: str = "medium"
    estimated_hours: Optional[float] = None
    success_criteria: List[str] = Field(default_factory=list)
    kill_criteria: List[str] = Field(default_factory=list)
    order_index: int = 0


class UpdateTaskRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[UUID] = None
    approach: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    plan_status: Optional[str] = None
    review_status: Optional[str] = None
    success_criteria: Optional[List[str]] = None
    kill_criteria: Optional[List[str]] = None
    order_index: Optional[int] = None
    phase_id: Optional[UUID] = None


class CreateTaskStepRequest(BaseModel):
    description: str
    expected_outcome: str = ""
    category: str = "development"
    estimated_hours: Optional[float] = None
    assignee_id: Optional[UUID] = None
    order_index: int = 0


class UpdateTaskStepRequest(BaseModel):
    description: Optional[str] = None
    expected_outcome: Optional[str] = None
    category: Optional[str] = None
    status: Optional[str] = None
    estimated_hours: Optional[float] = None
    actual_hours: Optional[float] = None
    assignee_id: Optional[UUID] = None
    order_index: Optional[int] = None


class CreateTaskUpdateRequest(BaseModel):
    message: str
    revised_estimate: Optional[float] = None


class CreateMilestoneRequest(BaseModel):
    title: str
    description: str = ""
    deliverable_type: str = "document"
    success_criteria: List[str] = Field(default_factory=list)
    assignee_id: Optional[UUID] = None
    target_day: Optional[int] = None
    order_index: int = 0


class UpdateMilestoneRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    deliverable_type: Optional[str] = None
    assignee_id: Optional[UUID] = None
    target_day: Optional[int] = None
    order_index: Optional[int] = None


class CreateDeadlineExtensionRequest(BaseModel):
    project_id: UUID
    task_id: Optional[UUID] = None
    milestone_id: Optional[UUID] = None
    original_deadline: str
    requested_deadline: str
    reason: str
    reason_detail: str = ""
    impact: str = ""


class UpdateDeadlineExtensionRequest(BaseModel):
    status: str
    ceo_comment: Optional[str] = None
    action_taken: Optional[str] = None


# ── Submissions / Feedback / Checkpoints ──────────────────────────────────────

class CreateSubmissionRequest(BaseModel):
    project_id: UUID
    phase_id: Optional[UUID] = None
    title: str
    type: str = "document"
    description: str = ""
    link: Optional[str] = None
    is_key_milestone: bool = False


class UpdateSubmissionRequest(BaseModel):
    status: Optional[str] = None
    reviewed_by: Optional[UUID] = None
    title: Optional[str] = None
    description: Optional[str] = None
    link: Optional[str] = None


class CreateFeedbackRequest(BaseModel):
    submission_id: UUID
    text: str
    is_ai: bool = False
    action_items: List[str] = Field(default_factory=list)


class CreateCheckpointRequest(BaseModel):
    project_id: UUID
    decision: str
    notes: str = ""
    ai_insights: Optional[str] = None
    action_items: List[str] = Field(default_factory=list)


# ── Leave ─────────────────────────────────────────────────────────────────────

class CreateLeaveRequest(BaseModel):
    type: str
    start_date: date
    end_date: date
    reason: str = ""
    cover_person_id: Optional[UUID] = None
    coverage_plan: Optional[str] = None
    contingency_note: Optional[str] = None
    is_planned: bool = True


class UpdateLeaveRequest(BaseModel):
    status: str
    cover_person_id: Optional[UUID] = None
    coverage_plan: Optional[str] = None


# ── Standup ───────────────────────────────────────────────────────────────────

class CreateStandupRequest(BaseModel):
    yesterday: str = ""
    today: str = ""
    blockers: Optional[str] = None
    mood: int = Field(default=3, ge=1, le=5)


# ── Capture ───────────────────────────────────────────────────────────────────

class CreateCaptureSessionRequest(BaseModel):
    raw_text: str


class UpdateCaptureItemRequest(BaseModel):
    status: str
    converted_to_task_id: Optional[UUID] = None
    converted_to_review_id: Optional[UUID] = None


# ── Reviews ───────────────────────────────────────────────────────────────────

class CreateReviewTaskRequest(BaseModel):
    title: str
    description: str = ""
    type: str = "document"
    assignee_id: Optional[UUID] = None
    project_id: Optional[UUID] = None
    task_id: Optional[UUID] = None
    submission_id: Optional[UUID] = None
    priority: str = "medium"
    due_date: Optional[str] = None


class UpdateReviewTaskRequest(BaseModel):
    status: Optional[str] = None
    priority: Optional[str] = None
    assignee_id: Optional[UUID] = None
    due_date: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None


# ── Discussions ───────────────────────────────────────────────────────────────

class CreateDiscussionRequest(BaseModel):
    title: str
    project_id: Optional[UUID] = None
    phase_id: Optional[UUID] = None


class CreateDiscussionMessageRequest(BaseModel):
    content: str
    parent_id: Optional[UUID] = None


# ── AI ────────────────────────────────────────────────────────────────────────

class GeneratePlanRequest(BaseModel):
    project_type: str
    requirement: str = ""
    objective: str = ""
    timebox_days: int = 14
    tech_stack: Optional[List[str]] = None


class SuggestStackRequest(BaseModel):
    project_type: str
    requirement: str = ""


class AIReviewRequest(BaseModel):
    content: str
    context: Optional[str] = None
    review_type: str = "general"
