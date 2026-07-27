// Centralized value → display label maps for the entire application.
// Use getLabel(map, value) to get a display string for any raw API/DB value.

export function getLabel(map: Record<string, string>, value: string): string {
  return map[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "Active",
  planning: "Planning",
  draft: "Draft",
  on_hold: "On Hold",
  completed: "Completed",
  cancelled: "Cancelled",
  killed: "Killed",
  paused: "Paused",
};

export const PROJECT_TYPE_LABELS: Record<string, string> = {
  engineering: "Engineering",
  data_science: "Data Science",
  design: "Design",
  sales: "Sales",
  marketing: "Marketing",
  operations: "Operations",
  hr: "HR",
  legal: "Legal",
  strategy: "Strategy",
  research: "Research",
  product: "Product",
  finance: "Finance",
  mixed: "Mixed / Cross-functional",
};

export const PROJECT_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
  completed: "Completed",
  blocked: "Blocked",
  planning: "Planning",
  killed: "Killed",
  redefined: "Redefined",
  review: "In Review",
};

export const TASK_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

export const COMMITMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

export const COMMITMENT_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const REVIEW_TYPE_LABELS: Record<string, string> = {
  code: "Code",
  architecture: "Architecture",
  notebook: "Notebook",
  document: "Document",
  demo: "Demo",
  design: "Design",
  status_update: "Status Update",
  meeting_notes: "Meeting Notes",
};

export const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  rejected: "Rejected",
};

export const REVIEW_PRIORITY_LABELS: Record<string, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export const SUBMISSION_TYPE_LABELS: Record<string, string> = {
  code: "Code",
  architecture: "Architecture",
  notebook: "Notebook",
  document: "Document",
  demo: "Demo",
  design: "Design",
  status_update: "Status Update",
  meeting_notes: "Meeting Notes",
};

export const DELIVERABLE_TYPE_LABELS: Record<string, string> = {
  document: "Document",
  code: "Code",
  design: "Design",
  prototype: "Prototype",
  report: "Report",
  presentation: "Presentation",
  demo: "Demo / Presentation",
  ppt: "PPT / Document",
  data: "Data / Report",
  text: "Sign-off / Review",
  meeting_notes: "Meeting Notes",
  other: "Other",
};

export const MEETING_SCOPE_LABELS: Record<string, string> = {
  general: "General",
  project: "Project",
};

export const LEAVE_TYPE_LABELS: Record<string, string> = {
  planned: "Planned",
  sick: "Sick",
  personal: "Personal",
  wfh: "WFH",
  half_day: "Half Day",
};

export const LEAVE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

export const EXTENSION_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  auto_escalated: "Auto Escalated",
};

export const DELIVERABLE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  verified: "Verified",
  rejected: "Rejected",
};

export const OUTCOME_TYPE_LABELS: Record<string, string> = {
  product: "Product",
  enhancement: "Enhancement",
  capability: "Capability Build",
  delivery: "Delivery Project",
  research: "Research / Exploration",
  migration: "Migration",
};

export const UPDATE_TYPE_LABELS: Record<string, string> = {
  code: "Code",
  architecture: "Architecture",
  notebook: "Notebook",
  document: "Document",
  demo: "Demo",
  status_update: "Status Update",
  meeting_notes: "Meeting Notes",
};

export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
  blocked: "Blocked",
};

/** Structured completion verdict for tasks/milestones. */
export const OUTCOME_VERDICT_LABELS: Record<string, string> = {
  met: "Met",
  partially_met: "Partially met",
  not_met: "Not met",
  deferred: "Deferred",
};
