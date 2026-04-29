export type DiscussionCategory = "decision" | "question" | "blocker" | "idea" | "announcement";
export type DiscussionPriority = "high" | "medium" | "low";
export type ReplyType = {
  id: string;
  userId: string;
  text: string;
  createdAt: string;
  reactions?: Record<string, string[]>; // emoji -> userIds
};

export type DiscussionThread = {
  id: string;
  projectId: string | null; // null = general
  title: string;
  body: string;
  userId: string;
  category: DiscussionCategory;
  priority: DiscussionPriority;
  pinned: boolean;
  resolved: boolean;
  tags: string[];
  replies: ReplyType[];
  mentions: string[]; // userIds
  createdAt: string;
  updatedAt: string;
};

export const DISCUSSION_THREADS: DiscussionThread[] = [
  // ── General ───────────────────────────────────────────────────
  {
    id: "d1",
    projectId: null,
    title: "Q2 Engineering Priorities — Input Needed",
    body: "Team, we need to finalize Q2 priorities before Friday. Currently scoping: (1) API Gateway completion, (2) ML Pipeline scalability, (3) Design system v2. What are your thoughts on sequencing? Any dependencies or concerns I should be aware of before the board meeting?",
    userId: "u1",
    category: "decision",
    priority: "high",
    pinned: true,
    resolved: false,
    tags: ["q2", "planning", "priorities"],
    mentions: ["u2", "u3", "u4", "u6"],
    replies: [
      {
        id: "r1",
        userId: "u3",
        text: "API Gateway should be first — the ML pipeline work is blocked on the authentication layer it provides. If we delay it, Priya's team can't scale without workarounds.",
        createdAt: "2026-04-16T10:15:00Z",
      },
      {
        id: "r2",
        userId: "u2",
        text: "Agreed with Arjun. The churn prediction model needs stable API endpoints to ship the inference service. Happy to deprioritize the pipeline scalability work until June if needed.",
        createdAt: "2026-04-16T10:28:00Z",
      },
      {
        id: "r3",
        userId: "u6",
        text: "Design system v2 can run in parallel since it's a separate track. I only need Arjun's input on the component API — maybe a 1-hr sync is enough? We don't need to delay engineering for it.",
        createdAt: "2026-04-16T11:02:00Z",
      },
    ],
    createdAt: "2026-04-16T09:00:00Z",
    updatedAt: "2026-04-16T11:02:00Z",
  },
  {
    id: "d2",
    projectId: null,
    title: "Team Offsite — June 12-13, Coorg",
    body: "Confirming the team offsite for June 12-13 in Coorg. Please mark your calendars. We'll do a half-day strategy session, team retrospective, and some downtime. Let me know if anyone has conflicts so we can adjust.",
    userId: "u1",
    category: "announcement",
    priority: "low",
    pinned: true,
    resolved: false,
    tags: ["offsite", "team"],
    mentions: [],
    replies: [
      {
        id: "r4",
        userId: "u4",
        text: "Sounds great! I'm in. Should we prepare anything for the retro, or will there be a template?",
        createdAt: "2026-04-15T14:30:00Z",
      },
      {
        id: "r5",
        userId: "u7",
        text: "I'll be there. For the strategy session — should we align it with the H2 roadmap discussion?",
        createdAt: "2026-04-15T15:00:00Z",
      },
      {
        id: "r6",
        userId: "u1",
        text: "@Meera I'll share a retro template by end of week. @Karthik yes, great idea — let's tie the strategy session to H2 roadmap.",
        createdAt: "2026-04-15T16:00:00Z",
      },
    ],
    createdAt: "2026-04-15T12:00:00Z",
    updatedAt: "2026-04-15T16:00:00Z",
  },

  // ── API Gateway project ────────────────────────────────────────
  {
    id: "d3",
    projectId: "p1",
    title: "Redis cluster for staging — still waiting on DevOps",
    body: "The Redis provisioning for the staging environment has been stuck for 3 days. Integration tests are blocked. I've pinged the DevOps team twice but no ETA yet. Do we escalate? This is now affecting the Phase 2 timeline.",
    userId: "u3",
    category: "blocker",
    priority: "high",
    pinned: false,
    resolved: false,
    tags: ["devops", "redis", "blocker", "staging"],
    mentions: ["u1", "u5"],
    replies: [
      {
        id: "r7",
        userId: "u5",
        text: "I'll escalate directly to the infrastructure lead today. Also — as a workaround, can we use a local Redis container for the integration tests in the meantime? It's not ideal but unblocks Arjun.",
        createdAt: "2026-04-16T09:45:00Z",
      },
      {
        id: "r8",
        userId: "u3",
        text: "Local Redis is a good workaround for now — I'll set that up. But we still need the cluster for the load tests in Phase 3.",
        createdAt: "2026-04-16T10:00:00Z",
      },
      {
        id: "r9",
        userId: "u1",
        text: "I've messaged the DevOps director directly. Expecting a reply by EOD. Vikram, please set up the local Redis ASAP so Arjun isn't blocked.",
        createdAt: "2026-04-16T10:30:00Z",
      },
    ],
    createdAt: "2026-04-16T09:30:00Z",
    updatedAt: "2026-04-16T10:30:00Z",
  },
  {
    id: "d4",
    projectId: "p1",
    title: "Circuit breaker strategy — half-open vs. exponential backoff?",
    body: "We need to decide on the circuit breaker strategy before Arjun implements the state machine. Two options: (A) half-open with probe requests, (B) exponential backoff with jitter. The trade-off is latency vs. downstream service recovery time. What's the consensus?",
    userId: "u3",
    category: "question",
    priority: "medium",
    pinned: false,
    resolved: true,
    tags: ["architecture", "circuit-breaker", "design"],
    mentions: ["u1", "u5"],
    replies: [
      {
        id: "r10",
        userId: "u5",
        text: "Option A (half-open with probes) is better for our use case. Our downstream services have fast recovery times, so we don't need the extra jitter complexity. Keep it simple.",
        createdAt: "2026-04-14T14:00:00Z",
      },
      {
        id: "r11",
        userId: "u1",
        text: "Agree — go with A. Document the decision in the ADR before you implement. Resolved.",
        createdAt: "2026-04-14T14:30:00Z",
      },
    ],
    createdAt: "2026-04-14T13:30:00Z",
    updatedAt: "2026-04-14T14:30:00Z",
  },

  // ── Crop Disease Detection project ─────────────────────────────
  {
    id: "d5",
    projectId: "p4",
    title: "Inference latency target — 200ms feasible?",
    body: "The model is hitting ~340ms average inference time on GPU. The product spec says < 200ms. Options: (1) model distillation, (2) TensorRT quantization, (3) batch inference with async API. Which should we prioritize?",
    userId: "u4",
    category: "question",
    priority: "high",
    pinned: false,
    resolved: false,
    tags: ["ml", "performance", "inference"],
    mentions: ["u2", "u1"],
    replies: [
      {
        id: "r12",
        userId: "u2",
        text: "TensorRT quantization is the fastest path to 200ms — typically gives 2-3x speedup with minimal accuracy loss. I can help with the conversion pipeline. Distillation is good but takes 2-3 weeks more.",
        createdAt: "2026-04-15T11:00:00Z",
      },
      {
        id: "r13",
        userId: "u4",
        text: "Good call. I'll start with TensorRT INT8 quantization today and benchmark. Will share results tomorrow.",
        createdAt: "2026-04-15T11:30:00Z",
      },
    ],
    createdAt: "2026-04-15T10:30:00Z",
    updatedAt: "2026-04-15T11:30:00Z",
  },

  // ── General ideas ──────────────────────────────────────────────
  {
    id: "d6",
    projectId: null,
    title: "Idea: Weekly 15-min async video updates instead of sync standups",
    body: "I've been thinking — our 9 AM standups lose 30+ min to scheduling conflicts and timezone drift. What if we replaced them with async Loom-style video updates? Everyone posts by 10 AM, and anyone with blockers flags for immediate sync. Could save 2+ hours per week per person.",
    userId: "u6",
    category: "idea",
    priority: "low",
    pinned: false,
    resolved: false,
    tags: ["process", "async", "productivity"],
    mentions: ["u1"],
    replies: [
      {
        id: "r14",
        userId: "u3",
        text: "Love this idea. Loom videos are great for visual work (Sneha, Meera) but for code I'd prefer written updates. Can we do a hybrid?",
        createdAt: "2026-04-14T10:00:00Z",
      },
      {
        id: "r15",
        userId: "u1",
        text: "Good idea in principle. Let's trial it for 2 weeks in May and measure. Written updates via this tool works — no need for video if that's friction.",
        createdAt: "2026-04-14T11:00:00Z",
      },
    ],
    createdAt: "2026-04-14T09:30:00Z",
    updatedAt: "2026-04-14T11:00:00Z",
  },
];

export function getAllDiscussions(): DiscussionThread[] {
  return [...DISCUSSION_THREADS].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt.localeCompare(a.updatedAt);
  });
}

export function getDiscussionsByProject(projectId: string): DiscussionThread[] {
  return DISCUSSION_THREADS
    .filter(d => d.projectId === projectId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getGeneralDiscussions(): DiscussionThread[] {
  return DISCUSSION_THREADS
    .filter(d => d.projectId === null)
    .sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return b.updatedAt.localeCompare(a.updatedAt);
    });
}
