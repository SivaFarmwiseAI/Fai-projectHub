/**
 * ProjectHub API Client
 * Routes all requests through the Next.js catch-all proxy (/api/*) which
 * forwards to the Lambda backend. Using relative URLs avoids CORS issues.
 */

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

/** Endpoints whose 401 is informational (e.g. session-restore probe) and
 *  should NOT trigger a login redirect. */
const AUTH_PROBE_PATHS = new Set(["/auth/me", "/auth/login"]);

/** Best-effort: when a session-expired 401 lands on a protected endpoint,
 *  bounce the browser to /login. Runs only in the browser. */
function handleUnauthorized(path: string) {
  if (typeof window === "undefined") return;
  if (AUTH_PROBE_PATHS.has(path)) return;
  if (window.location.pathname === "/login") return;
  try {
    localStorage.removeItem("projecthub_session");
  } catch {
    // localStorage may be unavailable in some environments — ignore.
  }
  const next = encodeURIComponent(
    window.location.pathname + window.location.search,
  );
  window.location.replace(`/login?next=${next}`);
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
    if (res.status === 401) handleUnauthorized(path);
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

// ── Uploads ───────────────────────────────────────────────────────────────────

/** Files at or below this size go through the Lambda in a single base64 JSON
 *  request. Larger files MUST use the multipart presigned-URL flow: AWS Lambda
 *  rejects any synchronous invocation whose request payload exceeds 6 MB, and
 *  base64 inflates a file by ~33% — so ~4.4 MB of raw bytes is the real
 *  single-shot ceiling. Stay comfortably under it. */
const SINGLE_SHOT_MAX_BYTES = 4 * 1024 * 1024;

/** Base64-encode a File in the browser, chunked so a large input doesn't blow
 *  the call stack (String.fromCharCode(...hugeArray) overflows the arg limit). */
async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

export const uploads = {
  uploadFile: (filename: string, contentType: string, dataB64: string) =>
    post<{ url: string; key: string }>("/projects/upload/file", {
      filename,
      content_type: contentType,
      data: dataB64,
    }),
  multipartStart: (filename: string, contentType: string, fileSize: number) =>
    get<{ upload_id: string; key: string; part_urls: string[]; part_size: number; cloudfront_url: string }>(
      `/projects/upload/multipart/start?filename=${encodeURIComponent(filename)}&content_type=${encodeURIComponent(contentType)}&file_size=${fileSize}`
    ),
  multipartComplete: (key: string, uploadId: string, parts: { part_number: number; etag: string }[]) =>
    post<{ cloudfront_url: string }>("/projects/upload/multipart/complete", { key, upload_id: uploadId, parts }),

  /**
   * Upload a file and return its public CloudFront URL, transparently choosing
   * the transport that won't fail on size:
   *   • ≤ 4 MB → one base64 request through the Lambda (no S3 CORS needed).
   *   • > 4 MB → multipart: each part is PUT browser→S3 directly via a presigned
   *              URL, bypassing the Lambda 6 MB payload limit entirely.
   *
   * The multipart path requires the documents bucket to allow cross-origin PUT
   * and to expose the ETag response header (CORS ExposedHeaders: ETag).
   */
  uploadFileSmart: async (file: File): Promise<string> => {
    const contentType = file.type || "application/octet-stream";

    if (file.size <= SINGLE_SHOT_MAX_BYTES) {
      const { url } = await uploads.uploadFile(file.name, contentType, await fileToBase64(file));
      return url;
    }

    const { upload_id, key, part_urls, part_size, cloudfront_url } =
      await uploads.multipartStart(file.name, contentType, file.size);

    const parts: { part_number: number; etag: string }[] = [];
    for (let i = 0; i < part_urls.length; i++) {
      const start = i * part_size;
      const blob = file.slice(start, Math.min(start + part_size, file.size));
      const res = await fetch(part_urls[i], { method: "PUT", body: blob });
      if (!res.ok) {
        throw new ApiError(res.status, "Storage rejected an upload part — please try again.");
      }
      // S3 returns the part's entity tag (quoted MD5) in the ETag header; the
      // browser can only read it when the bucket CORS exposes ETag.
      const etag = res.headers.get("ETag") ?? res.headers.get("etag");
      if (!etag) {
        throw new ApiError(
          502,
          "Storage did not return an ETag — the documents bucket needs CORS 'ExposedHeaders: ETag'.",
        );
      }
      parts.push({ part_number: i + 1, etag });
    }

    const { cloudfront_url: completed } = await uploads.multipartComplete(key, upload_id, parts);
    return completed || cloudfront_url;
  },
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
  deleteDocument:(projectId: string, docId: string) =>
    del<void>(`/projects/${projectId}/documents/${docId}`),
  insights: (id: string) => get<{ insights: AiInsight[] }>(`/projects/${id}/insights`),
  checkpoints:(id: string) => get<{ checkpoints: Checkpoint[] }>(`/projects/${id}/checkpoints`),
  timeline: () => get<{ projects: Project[] }>("/projects/timeline/all"),

  // Team management
  addAssignee:    (id: string, user_id: string) =>
    post<{ project_id: string; user_id: string; role: string }>(`/projects/${id}/assignees`, { user_id }),
  removeAssignee: (id: string, user_id: string) =>
    del<void>(`/projects/${id}/assignees/${user_id}`),
  addCoOwner:     (id: string, user_id: string) =>
    post<{ project_id: string; user_id: string; role: string }>(`/projects/${id}/co-owners`, { user_id }),
  removeCoOwner:  (id: string, user_id: string) =>
    del<void>(`/projects/${id}/co-owners/${user_id}`),
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
  revisions:    (id: string) => get<{ revisions: PhaseRevision[] }>(`/phases/${id}/revisions`),
  addRevision:  (id: string, data: CreateRevisionPayload) =>
    post<{ revision: PhaseRevision }>(`/phases/${id}/revisions`, data),
  deleteRevision: (phaseId: string, revisionId: string) =>
    del<void>(`/phases/${phaseId}/revisions/${revisionId}`),
  delete: (id: string) => del<void>(`/phases/${id}`),
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
  deleteMilestone: (taskId: string, msId: string) =>
    del<void>(`/tasks/${taskId}/milestones/${msId}`),

  // Milestone revisions (history) — mirrors task revisions
  milestoneRevisions: (taskId: string, msId: string) =>
    get<{ revisions: MilestoneRevision[] }>(`/tasks/${taskId}/milestones/${msId}/revisions`),
  addMilestoneRevision: (taskId: string, msId: string, data: CreateRevisionPayload) =>
    post<{ revision: MilestoneRevision }>(`/tasks/${taskId}/milestones/${msId}/revisions`, data),
  deleteMilestoneRevision: (taskId: string, msId: string, revisionId: string) =>
    del<void>(`/tasks/${taskId}/milestones/${msId}/revisions/${revisionId}`),

  requestExtension: (data: CreateExtensionPayload) =>
    post<{ extension: DeadlineExtension }>("/tasks/deadline-extensions", data),
  updateExtension: (id: string, data: { status: string; ceo_comment?: string; action_taken?: string }) =>
    patch<{ extension: DeadlineExtension }>(`/tasks/deadline-extensions/${id}`, data),

  // Multi-assignee management
  addAssignee:    (taskId: string, userId: string) =>
    post<{ task_id: string; assignees: TaskAssignee[] }>(`/tasks/${taskId}/assignees`, { user_id: userId }),
  removeAssignee: (taskId: string, userId: string) =>
    del<void>(`/tasks/${taskId}/assignees/${userId}`),

  // Revisions (history) + standalone attachments
  revisions:     (id: string) => get<{ revisions: TaskRevision[] }>(`/tasks/${id}/revisions`),
  addRevision:   (id: string, data: CreateRevisionPayload) =>
    post<{ revision: TaskRevision }>(`/tasks/${id}/revisions`, data),
  deleteRevision: (taskId: string, revisionId: string) =>
    del<void>(`/tasks/${taskId}/revisions/${revisionId}`),
  attachments:   (id: string) => get<{ attachments: TaskAttachment[] }>(`/tasks/${id}/attachments`),
  addAttachment: (id: string, data: { title: string; type?: string; url?: string; content?: string }) =>
    post<{ attachment: TaskAttachment }>(`/tasks/${id}/attachments`, data),
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
  cancel: (id: string) =>
    patch<{ leave: LeaveRequest }>(`/leave/${id}`, { status: "cancelled" }),
  delete: (id: string) => del<void>(`/leave/${id}`),
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
  update: (id: string, data: { title?: string; description?: string; status?: string; priority?: string; assignee_id?: string; due_date?: string; feedback_text?: string }) =>
    patch<{ review: ReviewTask }>(`/reviews/${id}`, data),
  delete: (id: string) => del<void>(`/reviews/${id}`),
  stats:  () => get<{ stats: ReviewStats }>("/reviews/stats/summary"),
};

// ── Meetings ──────────────────────────────────────────────────────────────────
export const meetings = {
  list:   (params?: { project_id?: string; scope?: "general" | "project"; status?: string }) =>
    get<{ meetings: Meeting[] }>(`/meetings${_qs(params)}`),
  create: (data: CreateMeetingPayload) => post<{ meeting: Meeting }>("/meetings", data),
  get:    (id: string) => get<{ meeting: Meeting }>(`/meetings/${id}`),
  update: (id: string, data: Partial<CreateMeetingPayload> & { status?: string }) =>
    patch<{ meeting: Meeting }>(`/meetings/${id}`, data),
  delete: (id: string) => del<void>(`/meetings/${id}`),
};

// ── Schedule Requests (CEO approval inbox) ────────────────────────────────────
export const scheduleRequests = {
  list:   (params?: { status?: string; entity_type?: string }) =>
    get<{ requests: ScheduleRequestRow[] }>(`/schedule-requests${_qs(params)}`),
  get:    (id: string) => get<{ request: ScheduleRequestRow }>(`/schedule-requests/${id}`),
  accept: (id: string, data?: { rescheduled_to?: string; ceo_note?: string }) =>
    post<{ request: ScheduleRequestRow }>(`/schedule-requests/${id}/accept`, data ?? {}),
  reject: (id: string, data?: { ceo_note?: string }) =>
    post<{ request: ScheduleRequestRow }>(`/schedule-requests/${id}/reject`, data ?? {}),
};

// ── Commitments ───────────────────────────────────────────────────────────────
export const commitments = {
  list:   (params?: { status?: string; priority?: string; assignee_id?: string; project_id?: string; from_date?: string; to_date?: string }) =>
    get<{ commitments: Commitment[] }>(`/commitments${_qs(params)}`),
  create: (data: CreateCommitmentPayload) =>
    post<{ commitment: Commitment }>("/commitments", data),
  get:    (id: string) => get<{ commitment: Commitment }>(`/commitments/${id}`),
  update: (id: string, data: Partial<CreateCommitmentPayload>) =>
    patch<{ commitment: Commitment }>(`/commitments/${id}`, data),
  delete: (id: string) => del<void>(`/commitments/${id}`),
};

// ── Discussions ───────────────────────────────────────────────────────────────
export const discussions = {
  list:    (params?: { project_id?: string; phase_id?: string; is_resolved?: boolean }) =>
    get<{ discussions: Discussion[] }>(`/discussions${_qs(params)}`),
  create:  (data: { project_id?: string; phase_id?: string; title: string; scheduled_at?: string }) =>
    post<{ discussion: Discussion }>("/discussions", data),
  get:     (id: string) => get<{ discussion: Discussion }>(`/discussions/${id}`),
  addMsg:  (id: string, content: string, parent_id?: string) =>
    post<{ message: DiscussionMessage }>(`/discussions/${id}/messages`, { discussion_id: id, content, parent_id }),
  resolve: (id: string) =>
    patch<{ discussion: Discussion }>(`/discussions/${id}/resolve`, {}),
  update:  (id: string, data: { title?: string; project_id?: string | null; phase_id?: string | null; scheduled_at?: string | null; is_resolved?: boolean }) =>
    patch<{ discussion: Discussion }>(`/discussions/${id}`, data),
  delete:  (id: string) => del<void>(`/discussions/${id}`),
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

// ── Performance Assessments (Keka-style 360°) ───────────────────────────────
export const performanceAssessments = {
  list:     (params?: { kind?: string; status?: string; cycle_id?: string; career_level?: string; rating_band?: string }) =>
    get<{ assessments: PerformanceAssessmentRow[] }>(`/performance-assessments${_qs(params)}`),
  create:   (data: CreatePerformanceAssessmentPayload) =>
    post<{ assessment: PerformanceAssessment; nominated: number }>("/performance-assessments", data),
  get:      (id: string) => get<{ assessment: PerformanceAssessment }>(`/performance-assessments/${id}`),
  update:   (id: string, data: UpdatePerformanceAssessmentPayload) =>
    patch<{ assessment: PerformanceAssessment }>(`/performance-assessments/${id}`, data),
  delete:   (id: string) => del<void>(`/performance-assessments/${id}`),
  analysis: (cycleId?: string) =>
    get<{ analysis: PerformanceAnalysisData }>(`/performance-assessments/analysis/summary${cycleId ? `?cycle_id=${cycleId}` : ""}`),

  // 360 flow
  myReviews:     (status?: string) =>
    get<{ reviews: PeerReviewAssignment[] }>(`/performance-assessments/my/reviews${status ? `?status=${status}` : ""}`),
  myAssessments: () =>
    get<{ assessments: PerformanceAssessmentRow[]; reviews_received: ReviewReceived[] }>("/performance-assessments/my/assessments"),
  team:          (cycleId?: string) =>
    get<{ reports: TeamReportRow[] }>(`/performance-assessments/team${cycleId ? `?cycle_id=${cycleId}` : ""}`),
  report:        (subjectId: string, cycleId?: string) =>
    get<{ report: EmployeeReport }>(`/performance-assessments/report/${subjectId}${cycleId ? `?cycle_id=${cycleId}` : ""}`),

  // Cycles (HR)
  cycles:        () => get<{ cycles: ReviewCycle[] }>("/performance-assessments/cycles"),
  activeCycle:   () => get<{ cycle: ReviewCycle | null }>("/performance-assessments/cycles/active"),
  createCycle:   (data: { name: string; status?: string; start_date?: string; end_date?: string }) =>
    post<{ cycle: ReviewCycle }>("/performance-assessments/cycles", data),
  updateCycle:   (id: string, data: { name?: string; status?: string; start_date?: string; end_date?: string }) =>
    patch<{ cycle: ReviewCycle }>(`/performance-assessments/cycles/${id}`, data),

  // Org tree
  orgTree:       () => get<{ tree: OrgTreeNode[] }>("/performance-assessments/org/tree"),
  setManager:    (user_id: string, manager_id: string | null) =>
    patch<{ ok: boolean }>("/performance-assessments/org/manager", { user_id, manager_id }),
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
export interface ProductivityPerson { name: string; severity: string; assessment: string; action_items: string[] }
export interface ProductivityAssessment { summary: string; people: ProductivityPerson[] }
export interface LeaveFinding { name: string; kind: string; severity: string; assessment: string; action_items: string[] }
export interface LeaveAssessment { summary: string; findings: LeaveFinding[] }

export const ai = {
  generatePlan: (data: { requirement: string; objective?: string; project_type: string; timebox_days: number; tech_stack?: string[] }) =>
    post<{ plan: AiPlan }>("/ai/generate-plan", data),
  extractDocument: (document_url: string) =>
    post<{ extracted: ExtractedDocument }>("/ai/extract-document", { document_url }),
  review:       (data: { content: string; content_type?: string; context?: string }) =>
    post<{ review: AiReview }>("/ai/review", data),
  suggestStack: (data: { requirement: string; project_type: string }) =>
    post<{ stack: string[]; rationale: string }>("/ai/suggest-stack", data),

  // Context-grounded intelligence (Gemini). POST = (re)generate via the LLM and
  // cache into ai_insights; GET = read the cached insights instantly.
  generateInsights:  () => post<{ insights: AiInsight[] }>(`/ai/insights/generate?scope=org`, {}),
  generateProjectInsights: (project_id: string) =>
    post<{ insights: AiInsight[] }>(`/ai/insights/generate?scope=project&project_id=${project_id}`, {}),
  briefing:          () => post<{ briefing: string }>("/ai/briefing", {}),
  assessProductivity:(user_id?: string) =>
    post<ProductivityAssessment>("/ai/productivity", user_id ? { user_id } : {}),
  getProductivity:   (user_id?: string) =>
    get<{ insights: AiInsight[] }>(`/ai/productivity${user_id ? `?user_id=${user_id}` : ""}`),
  assessLeave:       () => post<LeaveAssessment>("/ai/leave-assessment", {}),
  getLeaveInsights:  () => get<{ insights: AiInsight[] }>("/ai/leave-assessment"),
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
  metadata?: { document_url?: string; [key: string]: unknown };
  document_url?: string; // write-only on PATCH/POST — attaches an uploaded file URL
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

export interface TaskAssignee {
  id: string;
  name: string;
  avatar_color: string;
  role?: string;
  department?: string;
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
  assignees?: TaskAssignee[];
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
  estimated_hours?: number;
  actual_hours?: number;
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

export interface MeetingAttendee {
  id: string;
  name: string;
  avatar_color: string;
}

export interface Meeting {
  id: string;
  title: string;
  agenda?: string;
  scheduled_at: string;
  duration_minutes: number;
  location?: string;
  project_id?: string;
  project_title?: string;
  status: string;
  created_by: string;
  created_by_name?: string;
  created_by_color?: string;
  attendees: MeetingAttendee[];
  approval_status?: "pending" | "accepted" | "rejected" | null;
  rescheduled_to?: string | null;
  ceo_note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScheduleRequestRow {
  id: string;
  entity_type: "meeting" | "review" | "commitment" | "discussion" | "leave" | "follow_up";
  entity_id: string;
  status: "pending" | "accepted" | "rejected";
  title?: string;
  description?: string;
  proposed_at?: string;
  rescheduled_to?: string;
  ceo_note?: string;
  project_id?: string;
  project_title?: string;
  requested_by: string;
  requested_by_name?: string;
  requested_by_color?: string;
  decided_by?: string;
  decided_by_name?: string;
  decided_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMeetingPayload {
  title: string;
  agenda?: string;
  scheduled_at: string;
  duration_minutes?: number;
  location?: string;
  project_id?: string;
  attendee_ids?: string[];
}

export interface Commitment {
  id: string;
  title: string;
  description?: string;
  from_date: string;
  to_date: string;
  status: string;
  priority: string;
  owner_id: string;
  owner_name?: string;
  owner_color?: string;
  assignee_id?: string;
  assignee_name?: string;
  assignee_color?: string;
  project_id?: string;
  project_title?: string;
  created_at: string;
  updated_at: string;
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
  scheduled_at?: string;
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

export type RevisionAttachmentType = "url" | "repo" | "figma" | "design" | "document" | "code";

export interface RevisionAttachment {
  id: string;
  title: string;
  type: RevisionAttachmentType | string;
  url?: string;
  content?: string;
  created_at: string;
}

export interface RevisionAttachmentInput {
  title: string;
  type: RevisionAttachmentType | string;
  url?: string;
  content?: string;
}

export type RevisionChangeType =
  | "revision"
  | "status_change"
  | "closure"
  | "description_edit"
  | "note";

export interface PhaseRevision {
  id: string;
  phase_id: string;
  author_id?: string;
  author_name?: string;
  author_color?: string;
  change_type: RevisionChangeType | string;
  summary: string;
  details?: string;
  previous_value?: string;
  new_value?: string;
  attachments: RevisionAttachment[];
  created_at: string;
}

export interface TaskRevision {
  id: string;
  task_id: string;
  author_id?: string;
  author_name?: string;
  author_color?: string;
  change_type: RevisionChangeType | string;
  summary: string;
  details?: string;
  previous_value?: string;
  new_value?: string;
  attachments: RevisionAttachment[];
  created_at: string;
}

export interface MilestoneRevision {
  id: string;
  milestone_id: string;
  author_id?: string;
  author_name?: string;
  author_color?: string;
  change_type: RevisionChangeType | string;
  summary: string;
  details?: string;
  previous_value?: string;
  new_value?: string;
  attachments: RevisionAttachment[];
  created_at: string;
}

export interface TaskAttachment {
  id: string;
  task_id: string;
  title: string;
  type: string;
  uploaded_by?: string;
  uploader?: string;
  url?: string;
  content?: string;
  created_at: string;
}

export interface CreateRevisionPayload {
  summary: string;
  details?: string;
  change_type?: RevisionChangeType | string;
  previous_value?: string;
  new_value?: string;
  attachments?: RevisionAttachmentInput[];
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
  user_name?: string;
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

// ── Performance Assessment types ────────────────────────────────────────────
export interface PerformanceAssessment {
  id: string;
  employee_name: string;
  employee_user_id?: string | null;
  subject_user_id?: string | null;
  subject_name?: string | null;
  employee_color?: string | null;
  designation?: string | null;
  review_period?: string | null;
  career_level: string;            // junior | mid | senior
  filled_by: string;               // self | rev
  kind: string;                    // self | peer
  status: string;                  // pending | submitted
  cycle_id?: string | null;
  cycle_name?: string | null;
  author_user_id?: string | null;
  nominated_by?: string | null;
  reviewer_name?: string | null;
  reviewer_user_id?: string | null;
  role_areas: string[];
  individual_score?: number | null;
  team_score?: number | null;
  org_score?: number | null;
  culture_score?: number | null;
  total_score?: number | null;
  rating_band?: string | null;     // Exceptional | Exceeds Expectation | …
  severity: string;                // none | concern | serious
  capped: boolean;
  data: Record<string, unknown>;   // full form snapshot (contributions, entries, culture, gate)
  submitted_by?: string | null;
  submitted_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

/** List/table row — omits the heavy `data` snapshot. */
export interface PerformanceAssessmentRow {
  id: string;
  employee_name: string;
  subject_user_id?: string | null;
  employee_color?: string | null;
  designation?: string | null;
  review_period?: string | null;
  career_level: string;
  filled_by: string;
  kind?: string;
  status?: string;
  cycle_id?: string | null;
  cycle_name?: string | null;
  role_areas: string[];
  total_score?: number | null;
  rating_band?: string | null;
  severity: string;
  capped: boolean;
  submitted_by_name?: string | null;
  peer_count?: number;
  created_at: string;
}

export interface PerformanceBandCount { band: string; count: number }
export interface PerformanceGroupStat { key: string; count: number; avg_total: number | null }

export interface PerformanceAnalysisData {
  totals: {
    submissions: number;
    employees: number;
    avg_total: number | null;
    flagged: number;             // severity != 'none'
    peer_reviews: number;
    peer_pending: number;
  };
  band_distribution: PerformanceBandCount[];
  by_role_area: PerformanceGroupStat[];
  by_level: PerformanceGroupStat[];
  recent: PerformanceAssessmentRow[];
}

export interface CreatePerformanceAssessmentPayload {
  employee_name: string;
  employee_user_id?: string | null;
  subject_user_id?: string | null;
  designation?: string | null;
  review_period?: string | null;
  career_level: string;
  filled_by: string;
  kind?: string;                   // self | peer
  cycle_id?: string | null;
  reviewer_ids?: string[];         // nominated peer reviewers (self-assessment)
  reviewer_name?: string | null;
  reviewer_user_id?: string | null;
  role_areas: string[];
  individual_score?: number | null;
  team_score?: number | null;
  org_score?: number | null;
  culture_score?: number | null;
  total_score?: number | null;
  rating_band?: string | null;
  severity?: string;
  capped?: boolean;
  data: Record<string, unknown>;
}

export interface UpdatePerformanceAssessmentPayload {
  role_areas?: string[];
  individual_score?: number | null;
  team_score?: number | null;
  org_score?: number | null;
  culture_score?: number | null;
  total_score?: number | null;
  rating_band?: string | null;
  severity?: string;
  capped?: boolean;
  data?: Record<string, unknown>;
  status?: string;                 // pending | submitted
}

export interface ReviewCycle {
  id: string;
  name: string;
  status: string;                  // draft | open | closed
  start_date?: string | null;
  end_date?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  self_count?: number;
  peer_count?: number;
  peer_pending?: number;
  created_at: string;
  updated_at?: string;
}

export interface OrgTreeNode {
  id: string;
  name: string;
  role: string;
  role_type: string;
  department?: string | null;
  avatar_color: string;
  manager_id?: string | null;
  manager_name?: string | null;
}

/** A peer review assigned to me (I'm a nominated reviewer). */
export interface PeerReviewAssignment {
  id: string;
  status: string;                  // pending | submitted
  cycle_id?: string | null;
  cycle_name?: string | null;
  review_period?: string | null;
  total_score?: number | null;
  rating_band?: string | null;
  subject_id?: string | null;
  subject_name?: string | null;
  subject_color?: string | null;
  subject_role?: string | null;
  subject_department?: string | null;
  nominated_by_name?: string | null;
  created_at: string;
  submitted_at?: string | null;
}

/** A peer review written about me. */
export interface ReviewReceived {
  id: string;
  status: string;
  total_score?: number | null;
  rating_band?: string | null;
  author_name?: string | null;
  author_color?: string | null;
  created_at: string;
  submitted_at?: string | null;
}

/** A direct/indirect report in the Team view. */
export interface TeamReportRow {
  id: string;
  name: string;
  avatar_color: string;
  role: string;
  department?: string | null;
  depth: number;
  self_id?: string | null;
  total_score?: number | null;
  rating_band?: string | null;
  severity?: string | null;
  self_status?: string | null;
  peer_done: number;
  peer_total: number;
}

export interface EmployeeReportPeer {
  id: string;
  status: string;
  author_name?: string | null;
  author_color?: string | null;
  total_score?: number | null;
  rating_band?: string | null;
  data: Record<string, unknown>;
  created_at: string;
  submitted_at?: string | null;
}

export interface EmployeeReport {
  subject: {
    id: string;
    name: string;
    role?: string;
    department?: string | null;
    avatar_color: string;
    manager_id?: string | null;
    manager_name?: string | null;
  } | null;
  self: {
    id: string;
    total_score?: number | null;
    individual_score?: number | null;
    team_score?: number | null;
    org_score?: number | null;
    culture_score?: number | null;
    rating_band?: string | null;
    severity?: string | null;
    capped?: boolean;
    career_level?: string;
    role_areas?: string[];
    review_period?: string | null;
    data?: Record<string, unknown>;
    status?: string;
    created_at?: string;
  } | null;
  peers: EmployeeReportPeer[];
}

// Payload types
export interface CreateUserPayload { name: string; email: string; password: string; role: string; role_type?: string; department?: string; avatar_color?: string }
export interface CreateProjectPayload { title: string; type: string; requirement: string; objective?: string; outcome_type?: string; outcome_description?: string; priority?: string; status?: string; owner_id: string; assignee_ids?: string[]; co_owner_ids?: string[]; timebox_days?: number; start_date?: string; end_date?: string; tech_stack?: string[]; ai_plan?: AiPlan; document_url?: string }
export interface CreateCommitmentPayload { title: string; description?: string; from_date: string; to_date: string; priority?: string; status?: string; assignee_id?: string; project_id?: string }

export interface ExtractedDocument {
  title?: string;
  objective?: string;
  scope?: string;
  outcome_type?: string;
  success_criteria?: string[];
  end_criteria?: string;
  risks?: string[];
  tech_stack?: string[];
  type?: string;
  priority?: string;
  timebox_days?: number;
}
export interface CreatePhasePayload { project_id: string; phase_name: string; description?: string; order_index?: number; sign_off_required?: boolean; checklist?: { item: string; done: boolean }[]; estimated_duration?: string; start_date?: string; end_date?: string }
export interface CreateTaskPayload { project_id: string; phase_id?: string; title: string; description?: string; assignee_id?: string; assignee_ids?: string[]; approach?: string; priority?: string; estimated_hours?: number; success_criteria?: string[]; kill_criteria?: string[] }
export interface CreateStepPayload { task_id: string; description: string; expected_outcome?: string; category?: string; estimated_hours?: number; assignee_id?: string; order_index?: number }
export interface CreateMilestonePayload { task_id: string; title: string; description?: string; deliverable_type?: string; success_criteria?: string[]; assignee_id?: string; target_day?: number; estimated_hours?: number; order_index?: number; }
export interface CreateExtensionPayload { project_id: string; task_id?: string; milestone_id?: string; original_deadline?: string; requested_deadline: string; reason: string; reason_detail: string; impact?: string }
export interface CreateSubmissionPayload { phase_id?: string; project_id: string; title: string; type: string; description?: string; link?: string; is_key_milestone?: boolean }
export interface CreateLeavePayload { type: string; start_date: string; end_date: string; reason?: string; cover_person_id?: string; coverage_plan?: string; is_planned?: boolean }
export interface CreateReviewPayload { title: string; description?: string; type: string; assignee_id?: string; project_id?: string; task_id?: string; submission_id?: string; priority?: string; due_date?: string }
export interface CreateUpdatePayload { type?: string; title: string; description?: string; what_was_done?: string; blockers?: string; next_steps?: string }
