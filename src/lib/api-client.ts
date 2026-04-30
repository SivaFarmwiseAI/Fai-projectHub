/**
 * ProjectHub API Client
 * Routes all requests through the Next.js catch-all proxy (/api/*) which
 * forwards to the Lambda backend. Using relative URLs avoids CORS issues.
 */

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  headers?: Record<string, string>
): Promise<T> {
  const url = `/api${path}`;
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new ApiError(res.status, err.detail || res.statusText);
  }

  if (res.status === 204) return undefined as T;
  return res.json();
}

const get  = <T>(path: string)              => request<T>("GET",    path);
const post = <T>(path: string, body: unknown) => request<T>("POST",   path, body);
const patch = <T>(path: string, body: unknown) => request<T>("PATCH", path, body);
const del  = <T>(path: string)              => request<T>("DELETE", path);

// ── Auth ──────────────────────────────────────────────────────────────────────
export const auth = {
  login:          (email: string, password: string) =>
    post<{ user: User }>("/auth/login", { email, password }),
  logout:         () => post<void>("/auth/logout", {}),
  me:             () => get<{ user: User }>("/auth/me"),
  register:       (data: CreateUserPayload) => post<{ user: User }>("/auth/register", data),
  changePassword: (old_password: string, new_password: string) =>
    post<void>("/auth/change-password", { old_password, new_password }),
};

// ── Users ─────────────────────────────────────────────────────────────────────
export const users = {
  list:   (params?: { department?: string; role_type?: string }) =>
    get<{ users: User[] }>(`/users${_qs(params)}`),
  create: (data: CreateUserPayload) => post<{ user: User }>("/users", data),
  get:    (id: string) => get<{ user: User }>(`/users/${id}`),
  update: (id: string, data: Partial<User>) => patch<{ user: User }>(`/users/${id}`, data),
  delete: (id: string) => del<void>(`/users/${id}`),
  tasks:  (id: string, status?: string) =>
    get<{ tasks: Task[] }>(`/users/${id}/tasks${status ? `?status=${status}` : ""}`),
  leave:  (id: string) => get<{ leave: LeaveRequest[] }>(`/users/${id}/leave`),
};

// ── Departments & Roles ───────────────────────────────────────────────────────
export interface Department {
  id: string;
  name: string;
  description?: string;
  color: string;
  head_id?: string;
  head_name?: string;
  member_count: number;
  is_active: boolean;
  created_at?: string;
}

export interface Role {
  id: string;
  name: string;
  description?: string;
  department_id?: string;
  department_name?: string;
  member_count: number;
  is_active: boolean;
  created_at?: string;
}

export const departments = {
  list:   () => get<{ departments: Department[] }>("/departments"),
  create: (data: { name: string; description?: string; color?: string; head_id?: string }) =>
    post<{ department: Department }>("/departments", data),
};

export const roles = {
  list:   () => get<{ roles: Role[] }>("/roles"),
  create: (data: { name: string; description?: string; department_id?: string }) =>
    post<{ role: Role }>("/roles", data),
};

// ── Projects ──────────────────────────────────────────────────────────────────
export const projects = {
  list: (params?: {
    status?: string; type?: string; priority?: string;
    owner_id?: string; assignee_id?: string; search?: string;
    limit?: number; offset?: number;
  }) => get<{ projects: Project[]; total: number }>(`/projects${_qs(params)}`),

  create: (data: CreateProjectPayload) =>
    post<{ project: Project }>("/projects", data),

  get: (id: string) =>
    get<{ project: Project }>(`/projects/${id}`),

  update: (id: string, data: Partial<Project>) =>
    patch<{ project: Project }>(`/projects/${id}`, data),

  delete: (id: string) => del<void>(`/projects/${id}`),

  tasks:    (id: string) => get<{ tasks: Task[] }>(`/projects/${id}/tasks`),
  updates:  (id: string) => get<{ updates: ProjectUpdate[] }>(`/projects/${id}/updates`),
  addUpdate:(id: string, data: CreateUpdatePayload) =>
    post<{ update: ProjectUpdate }>(`/projects/${id}/updates`, data),
  documents:(id: string) => get<{ documents: ProjectDocument[] }>(`/projects/${id}/documents`),
  insights: (id: string) => get<{ insights: AiInsight[] }>(`/projects/${id}/insights`),
  checkpoints:(id: string) => get<{ checkpoints: Checkpoint[] }>(`/projects/${id}/checkpoints`),
  timeline: () => get<{ projects: Project[] }>("/projects/timeline/all"),
};

// ── Phases ────────────────────────────────────────────────────────────────────
export const phases = {
  get:     (id: string) => get<{ phase: Phase }>(`/phases/${id}`),
  update:  (id: string, data: Partial<Phase>) => patch<{ phase: Phase }>(`/phases/${id}`, data),
  create:  (data: CreatePhasePayload) => post<{ phase: Phase }>("/phases", data),
  signOff: (id: string) => post<{ phase: Phase }>(`/phases/${id}/sign-off`, {}),
  attachments: (id: string) => get<{ attachments: PhaseAttachment[] }>(`/phases/${id}/attachments`),
  addAttachment: (id: string, data: { title: string; type?: string; url?: string }) =>
    post<{ attachment: PhaseAttachment }>(`/phases/${id}/attachments`, data),
};

// ── Tasks ─────────────────────────────────────────────────────────────────────
export const tasks = {
  list: (params?: { project_id?: string; assignee_id?: string; status?: string; priority?: string }) =>
    get<{ tasks: Task[] }>(`/tasks${_qs(params)}`),
  create:  (data: CreateTaskPayload) => post<{ task: Task }>("/tasks", data),
  get:     (id: string) => get<{ task: Task }>(`/tasks/${id}`),
  update:  (id: string, data: Partial<Task>) => patch<{ task: Task }>(`/tasks/${id}`, data),
  delete:  (id: string) => del<void>(`/tasks/${id}`),

  addStep:    (id: string, data: CreateStepPayload) =>
    post<{ step: TaskStep }>(`/tasks/${id}/steps`, data),
  updateStep: (taskId: string, stepId: string, data: Partial<TaskStep>) =>
    patch<{ step: TaskStep }>(`/tasks/${taskId}/steps/${stepId}`, data),

  addUpdate:    (id: string, data: { message: string; revised_estimate?: number }) =>
    post<{ update: TaskUpdateEntry }>(`/tasks/${id}/updates`, data),

  addMilestone:    (id: string, data: CreateMilestonePayload) =>
    post<{ milestone: TaskMilestone }>(`/tasks/${id}/milestones`, data),
  updateMilestone: (taskId: string, msId: string, data: Partial<TaskMilestone>) =>
    patch<{ milestone: TaskMilestone }>(`/tasks/${taskId}/milestones/${msId}`, data),

  requestExtension: (data: CreateExtensionPayload) =>
    post<{ extension: DeadlineExtension }>("/tasks/deadline-extensions", data),
  updateExtension: (id: string, data: { status: string; ceo_comment?: string; action_taken?: string }) =>
    patch<{ extension: DeadlineExtension }>(`/tasks/deadline-extensions/${id}`, data),
};

// ── Submissions ───────────────────────────────────────────────────────────────
export const submissions = {
  list:   (params?: { project_id?: string; phase_id?: string; status?: string; pending?: boolean }) =>
    get<{ submissions: Submission[] }>(`/submissions${_qs(params)}`),
  create: (data: CreateSubmissionPayload) =>
    post<{ submission: Submission }>("/submissions", data),
  get:    (id: string) => get<{ submission: Submission }>(`/submissions/${id}`),
  update: (id: string, data: { status?: string; reviewed_by?: string }) =>
    patch<{ submission: Submission }>(`/submissions/${id}`, data),
};

// ── Feedback ──────────────────────────────────────────────────────────────────
export const feedback = {
  create: (data: { submission_id: string; text: string; is_ai?: boolean; action_items?: string[] }) =>
    post<{ feedback: Feedback }>("/feedback", data),
};

// ── Checkpoints ───────────────────────────────────────────────────────────────
export const checkpoints = {
  create: (data: { project_id: string; decision: string; notes?: string; action_items?: string[] }) =>
    post<{ checkpoint: Checkpoint }>("/checkpoints", data),
};

// ── Leave ─────────────────────────────────────────────────────────────────────
export const leave = {
  list:   (params?: { user_id?: string; status?: string; start_date?: string; end_date?: string }) =>
    get<{ leave: LeaveRequest[] }>(`/leave${_qs(params)}`),
  create: (data: CreateLeavePayload) =>
    post<{ leave: LeaveRequest }>("/leave", data),
  get:    (id: string) => get<{ leave: LeaveRequest }>(`/leave/${id}`),
  update: (id: string, data: { status: string; cover_person_id?: string; coverage_plan?: string }) =>
    patch<{ leave: LeaveRequest }>(`/leave/${id}`, data),
  availability: (start_date: string, end_date: string) =>
    get<{ availability: TeamAvailability[] }>(`/leave/availability/team?start_date=${start_date}&end_date=${end_date}`),
  analytics: () => get<{ analytics: LeaveAnalytics[] }>("/leave/analytics/summary"),
};

// ── Capture ───────────────────────────────────────────────────────────────────
export const capture = {
  list:          (params?: { status?: string; type?: string }) =>
    get<{ items: CaptureItem[] }>(`/capture${_qs(params)}`),
  createSession: (raw_text: string) =>
    post<{ session: CaptureSession; items: CaptureItem[] }>("/capture/sessions", { raw_text }),
  updateItem:    (id: string, data: { status: string; converted_to_task_id?: string }) =>
    patch<{ item: CaptureItem }>(`/capture/items/${id}`, data),
  stats:         () => get<{ stats: CaptureStats }>("/capture/stats"),
};

// ── Reviews ───────────────────────────────────────────────────────────────────
export const reviews = {
  list:   (params?: { assignee_id?: string; status?: string; priority?: string; project_id?: string }) =>
    get<{ reviews: ReviewTask[] }>(`/reviews${_qs(params)}`),
  create: (data: CreateReviewPayload) =>
    post<{ review: ReviewTask }>("/reviews", data),
  get:    (id: string) => get<{ review: ReviewTask }>(`/reviews/${id}`),
  update: (id: string, data: { status?: string; feedback_text?: string }) =>
    patch<{ review: ReviewTask }>(`/reviews/${id}`, data),
  stats:  () => get<{ stats: ReviewStats }>("/reviews/stats/summary"),
};

// ── Discussions ───────────────────────────────────────────────────────────────
export const discussions = {
  list:    (params?: { project_id?: string; phase_id?: string; is_resolved?: boolean }) =>
    get<{ discussions: Discussion[] }>(`/discussions${_qs(params)}`),
  create:  (data: { project_id?: string; phase_id?: string; title: string }) =>
    post<{ discussion: Discussion }>("/discussions", data),
  get:     (id: string) => get<{ discussion: Discussion }>(`/discussions/${id}`),
  addMsg:  (id: string, content: string, parent_id?: string) =>
    post<{ message: DiscussionMessage }>(`/discussions/${id}/messages`, { discussion_id: id, content, parent_id }),
  resolve: (id: string) =>
    patch<{ discussion: Discussion }>(`/discussions/${id}/resolve`, {}),
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analytics = {
  dashboard:   () => get<{ stats: DashboardStats }>("/analytics/dashboard"),
  teamHealth:  () => get<{ team_health: TeamHealthRow[] }>("/analytics/team-health"),
  velocity:    (days?: number) =>
    get<{ velocity: VelocityRow[] }>(`/analytics/velocity${days ? `?days=${days}` : ""}`),
  workload:    () => get<{ workload: WorkloadRow[] }>("/analytics/workload"),
  briefing:    () => get<{ stats: DashboardStats; critical_projects: Project[]; insights: AiInsight[] }>("/analytics/briefing"),
  notifications:(unread?: boolean) =>
    get<{ notifications: Notification[] }>(`/analytics/notifications${unread ? "?unread_only=true" : ""}`),
};

// ── Standup ───────────────────────────────────────────────────────────────────
export const standup = {
  today:   (date?: string) =>
    get<{ date: string; entries: StandupEntry[] }>(`/standup${date ? `?date=${date}` : ""}`),
  submit:  (data: { yesterday?: string; today?: string; blockers?: string; mood?: number }) =>
    post<{ entry: StandupEntry }>("/standup", data),
  history: (userId: string, days?: number) =>
    get<{ entries: StandupEntry[] }>(`/standup/history/${userId}${days ? `?days=${days}` : ""}`),
};

// ── AI ────────────────────────────────────────────────────────────────────────
export const ai = {
  generatePlan: (data: { requirement: string; project_type: string; timebox_days: number; tech_stack?: string[] }) =>
    post<{ plan: AiPlan }>("/ai/generate-plan", data),
  review:       (data: { content: string; content_type?: string; context?: string }) =>
    post<{ review: AiReview }>("/ai/review", data),
  suggestStack: (data: { requirement: string; project_type: string }) =>
    post<{ stack: string[]; rationale: string }>("/ai/suggest-stack", data),
  generateInsights: (project_id: string) =>
    post<{ insights: AiInsight[] }>(`/ai/insights/generate?project_id=${project_id}`, {}),
};


// ── Query string helper ───────────────────────────────────────────────────────
function _qs(params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return "";
  const q = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
  return q ? `?${q}` : "";
}


// ── Types ─────────────────────────────────────────────────────────────────────
// Mirror the Python Pydantic models returned by the Lambda backend.

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  role_type: string;
  department: string;
  avatar_color: string;
  is_active?: boolean;
  created_at?: string;
  projects?: Project[];
  active_tasks?: number;
  completed_tasks?: number;
  blocked_tasks?: number;
  avg_mood?: number;
  health_score?: number;
  project_count?: number;
  active_project_count?: number;
}

export interface Project {
  id: string;
  title: string;
  type: string;
  requirement: string;
  objective?: string;
  outcome_type?: string;
  outcome_description?: string;
  status: string;
  priority: string;
  owner_id: string;
  owner_name?: string;
  owner_avatar_color?: string;
  current_phase: string;
  current_phase_index: number;
  timebox_days: number;
  start_date?: string;
  end_date?: string;
  tech_stack: string[];
  ai_plan: AiPlan;
  assignees?: User[];
  co_owners?: User[];
  phases?: Phase[];
  task_count?: number;
  completed_tasks?: number;
  pending_submissions?: number;
  created_at: string;
  updated_at: string;
}

export interface Phase {
  id: string;
  project_id: string;
  phase_name: string;
  description?: string;
  status: string;
  checklist: { item: string; done: boolean }[];
  order_index: number;
  sign_off_required: boolean;
  signed_off_by: string[];
  estimated_duration?: string;
  start_date?: string;
  end_date?: string;
  started_at?: string;
  completed_at?: string;
  submissions?: Submission[];
  attachments?: PhaseAttachment[];
  discussions?: PhaseDiscussion[];
}

export interface Task {
  id: string;
  project_id: string;
  phase_id?: string;
  title: string;
  description?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_color?: string;
  approach?: string;
  plan_status: string;
  success_criteria: string[];
  kill_criteria: string[];
  status: string;
  priority: string;
  estimated_hours?: number;
  revised_estimate_hours?: number;
  actual_hours?: number;
  review_status?: string;
  review_feedback?: string;
  steps?: TaskStep[];
  updates?: TaskUpdateEntry[];
  milestones?: TaskMilestone[];
  deadline_extensions?: DeadlineExtension[];
  order_index: number;
  created_at: string;
  completed_at?: string;
}

export interface TaskStep {
  id: string;
  task_id: string;
  description: string;
  expected_outcome?: string;
  category?: string;
  status: string;
  order_index: number;
  estimated_hours?: number;
  actual_hours?: number;
  assignee_id?: string;
  notes?: string;
  review_status?: string;
}

export interface TaskUpdateEntry {
  id: string;
  task_id: string;
  user_id: string;
  message: string;
  revised_estimate?: number;
  created_at: string;
}

export interface TaskMilestone {
  id: string;
  task_id: string;
  title: string;
  description?: string;
  deliverable_type?: string;
  success_criteria: string[];
  status: string;
  assignee_id?: string;
  target_day?: number;
  outcome?: string;
  outcome_notes?: string;
  deliverables?: Deliverable[];
  completed_at?: string;
  order_index: number;
}

export interface Deliverable {
  id: string;
  milestone_id?: string;
  task_id?: string;
  type: string;
  title: string;
  description?: string;
  status: string;
  document_url?: string;
  code_repo_url?: string;
  code_pr_url?: string;
  submitted_by?: string;
  submitted_at?: string;
  verified_by?: string;
  feedback?: string;
  created_at: string;
}

export interface DeadlineExtension {
  id: string;
  project_id: string;
  task_id?: string;
  milestone_id?: string;
  requested_by: string;
  original_deadline?: string;
  requested_deadline: string;
  reason: string;
  reason_detail: string;
  impact?: string;
  status: string;
  ceo_comment?: string;
  escalation_level: number;
  action_taken?: string;
  created_at: string;
}

export interface Submission {
  id: string;
  phase_id?: string;
  project_id: string;
  user_id: string;
  submitted_by_name?: string;
  title: string;
  type: string;
  description?: string;
  link?: string;
  status: string;
  is_key_milestone: boolean;
  feedback?: Feedback[];
  created_at: string;
}

export interface Feedback {
  id: string;
  submission_id: string;
  from_user_id?: string;
  from_user_name?: string;
  text: string;
  is_ai: boolean;
  action_items: string[];
  created_at: string;
}

export interface Checkpoint {
  id: string;
  project_id: string;
  decision: string;
  notes?: string;
  ai_insights?: string;
  action_items: string[];
  decided_by?: string;
  created_at: string;
}

export interface LeaveRequest {
  id: string;
  user_id: string;
  user_name?: string;
  department?: string;
  type: string;
  start_date: string;
  end_date: string;
  days: number;
  reason?: string;
  status: string;
  approved_by?: string;
  approved_by_name?: string;
  approved_at?: string;
  cover_person_id?: string;
  cover_person_name?: string;
  coverage_plan?: string;
  is_planned: boolean;
  created_at: string;
}

export interface TeamAvailability {
  id: string;
  user_id: string;
  name?: string;
  date: string;
  status: string;
}

export interface LeaveAnalytics {
  id: string;
  name: string;
  department: string;
  total_leave_days: number;
  planned_days: number;
  sick_days: number;
  personal_days: number;
  wfh_days: number;
  half_days: number;
}

export interface CaptureItem {
  id: string;
  session_id?: string;
  user_id: string;
  type: string;
  title: string;
  description?: string;
  assignee_id?: string;
  assignee_name?: string;
  due_date?: string;
  priority: string;
  status: string;
  tags: string[];
  converted_to_task_id?: string;
  created_at: string;
}

export interface CaptureSession {
  id: string;
  user_id: string;
  raw_text: string;
  created_at: string;
}

export interface CaptureStats {
  pending: number;
  converted: number;
  dismissed: number;
  total: number;
}

export interface ReviewTask {
  id: string;
  title: string;
  description?: string;
  type: string;
  assignee_id?: string;
  assignee_name?: string;
  requester_id?: string;
  requester_name?: string;
  project_id?: string;
  project_title?: string;
  priority: string;
  status: string;
  due_date?: string;
  feedback_text?: string;
  created_at: string;
}

export interface ReviewStats {
  pending: number;
  in_progress: number;
  completed: number;
  high_priority_open: number;
}

export interface Discussion {
  id: string;
  project_id?: string;
  project_title?: string;
  phase_id?: string;
  title: string;
  author_id: string;
  author_name?: string;
  is_resolved: boolean;
  message_count?: number;
  messages?: DiscussionMessage[];
  created_at: string;
  updated_at: string;
}

export interface DiscussionMessage {
  id: string;
  discussion_id: string;
  author_id: string;
  author_name?: string;
  content: string;
  parent_id?: string;
  replies?: DiscussionMessage[];
  created_at: string;
}

export interface PhaseAttachment {
  id: string;
  phase_id: string;
  title: string;
  type: string;
  uploaded_by?: string;
  url?: string;
  created_at: string;
}

export interface PhaseDiscussion {
  id: string;
  phase_id: string;
  user_id: string;
  user_name?: string;
  message: string;
  type: string;
  created_at: string;
}

export interface AiInsight {
  id: string;
  project_id?: string;
  project_title?: string;
  user_id?: string;
  type: string;
  severity: string;
  title: string;
  description?: string;
  action_items: string[];
  status: string;
  created_at: string;
}

export interface AiPlan {
  summary?: string;
  techStack?: string[];
  risks?: { risk: string; mitigation: string; severity: string }[];
  killCriteria?: string[];
}

export interface AiReview {
  summary: string;
  issues: { description: string; severity: string }[];
  suggestions: string[];
  score?: number;
}

export interface ProjectUpdate {
  id: string;
  project_id: string;
  user_id: string;
  author_name?: string;
  type: string;
  title: string;
  description?: string;
  what_was_done?: string;
  blockers?: string;
  next_steps?: string;
  created_at: string;
}

export interface ProjectDocument {
  id: string;
  project_id: string;
  type: string;
  title: string;
  status: string;
  sections: unknown[];
  created_at: string;
}

export interface StandupEntry {
  id: string;
  user_id: string;
  name?: string;
  department?: string;
  date: string;
  yesterday?: string;
  today?: string;
  blockers?: string;
  mood?: number;
  created_at: string;
}

export interface DashboardStats {
  active_projects: number;
  completed_projects: number;
  killed_projects: number;
  active_tasks: number;
  blocked_tasks: number;
  pending_reviews: number;
  pending_leave: number;
  pending_captures: number;
  open_reviews: number;
  team_size: number;
}

export interface TeamHealthRow {
  id: string;
  name: string;
  department: string;
  active_tasks: number;
  completed_tasks: number;
  blocked_tasks: number;
  hours_ratio: number;
  health_score: number;
  avg_mood: number;
}

export interface VelocityRow {
  week: string;
  completed: number;
  hours_logged: number;
}

export interface WorkloadRow {
  id: string;
  name: string;
  department: string;
  in_progress: number;
  planning: number;
  blocked: number;
  estimated_hours_remaining: number;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message?: string;
  is_read: boolean;
  created_at: string;
}

// Payload types
export interface CreateUserPayload { name: string; email: string; password: string; role: string; role_type?: string; department?: string; avatar_color?: string }
export interface CreateProjectPayload { title: string; type: string; requirement: string; priority?: string; owner_id: string; assignee_ids?: string[]; co_owner_ids?: string[]; timebox_days?: number; start_date?: string; tech_stack?: string[]; ai_plan?: AiPlan }
export interface CreatePhasePayload { project_id: string; phase_name: string; description?: string; order_index?: number; sign_off_required?: boolean; checklist?: { item: string; done: boolean }[] }
export interface CreateTaskPayload { project_id: string; phase_id?: string; title: string; description?: string; assignee_id?: string; approach?: string; priority?: string; estimated_hours?: number; success_criteria?: string[]; kill_criteria?: string[] }
export interface CreateStepPayload { task_id: string; description: string; expected_outcome?: string; category?: string; estimated_hours?: number; assignee_id?: string; order_index?: number }
export interface CreateMilestonePayload { task_id: string; title: string; description?: string; deliverable_type?: string; success_criteria?: string[]; target_day?: number }
export interface CreateExtensionPayload { project_id: string; task_id?: string; milestone_id?: string; original_deadline?: string; requested_deadline: string; reason: string; reason_detail: string; impact?: string }
export interface CreateSubmissionPayload { phase_id?: string; project_id: string; title: string; type: string; description?: string; link?: string; is_key_milestone?: boolean }
export interface CreateLeavePayload { type: string; start_date: string; end_date: string; reason?: string; cover_person_id?: string; coverage_plan?: string; is_planned?: boolean }
export interface CreateReviewPayload { title: string; description?: string; type: string; assignee_id?: string; project_id?: string; task_id?: string; submission_id?: string; priority?: string; due_date?: string }
export interface CreateUpdatePayload { type?: string; title: string; description?: string; what_was_done?: string; blockers?: string; next_steps?: string }
