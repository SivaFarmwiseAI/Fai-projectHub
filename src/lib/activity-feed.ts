import { formatDistanceToNow } from "date-fns";

export type ActivityEvent = {
  id: string;
  type: "phase_complete" | "task_complete" | "checkpoint" | "update" | "extension" | "standup";
  icon: string;
  title: string;
  subtitle: string;
  projectId?: string;
  projectTitle?: string;
  userId?: string;
  userName?: string;
  userColor?: string;
  createdAt: string;
  relativeTime: string;
};

// Returns empty feed; callers should fetch activity from the API instead.
export function getActivityFeed(limit = 20): ActivityEvent[] {
  return [];
}
