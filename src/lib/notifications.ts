export type NotifPriority = "critical" | "high" | "medium" | "low";
export type NotifType =
  | "review_requested" | "deadline_approaching" | "blocker_flagged"
  | "standup_missing" | "leave_approved" | "extension_requested"
  | "discussion_mention" | "milestone_reached" | "project_at_risk";

export type Notification = {
  id: string;
  type: NotifType;
  priority: NotifPriority;
  title: string;
  description: string;
  link?: string;
  time: string;
  read: boolean;
};
