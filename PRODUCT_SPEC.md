# ProjectHub -- Product Specification

**Version:** 1.0
**Date:** 2026-04-06
**Author:** Rahul (CEO)
**Status:** Frontend prototype complete; backend to be built

---

## 1. Product Vision

ProjectHub is a CEO-centric project management tool that gives the CEO real-time visibility into all projects, team performance, commitments, and deadlines across engineering and data science departments. It is designed to replace spreadsheets and scattered tools with a single command center.

The tool is built around one core principle: the CEO should never have to ask "what's the status?" -- every answer should already be on the screen.

---

## 2. Target User

- **Primary:** CEO acting as hands-on project manager across engineering and data science teams
- **Secondary:** Team leads and department heads who need to submit updates, request extensions, and manage their deliverables

---

## 3. Core Modules

### 3.1 Command Center (Dashboard)

The landing page of the application. Provides a single-screen overview of everything the CEO needs to know.

**Summary Cards (top row):**

| Card | Data Source | Description |
|------|-------------|-------------|
| Total Projects | `PROJECTS` array | Count of all projects, broken down by status (active, completed, killed, paused) |
| Pending Reviews | `getPendingReviews()` | Count of deliverables/milestones awaiting CEO review |
| Overdue Items | Computed from tasks | Tasks or milestones past their deadline that are not yet completed |
| Team Members | `USERS` array | Total headcount with department breakdown |

**"Needs Your Attention" Card:**

This is the most important element on the dashboard. It aggregates all items requiring CEO action into a single prioritized list:

- Overdue projects (tasks past deadline with delay count in days)
- Pending reviews (deliverables, milestones, or tasks awaiting CEO approval)
- Pending leave requests (awaiting CEO approval with impact assessment)
- Blocked tasks (tasks with status "blocked" across all projects)
- Pending captures (unprocessed items from the AI capture inbox)
- Upcoming deadlines (milestones/tasks due within the next 7 days)

Each item is clickable and navigates to the relevant detail view.

**AI Insights Section:**

Displays AI-generated insights categorized by type:

| Type | Icon Color | Purpose |
|------|-----------|---------|
| risk | Red | Projects or tasks at risk of failure or delay |
| blocker | Red | Active blockers that need CEO intervention |
| opportunity | Green | Positive trends or optimization possibilities |
| suggestion | Amber | Actionable recommendations for process improvement |
| performance | Blue | Team or individual performance observations |

Each insight includes: title, description, severity (low/medium/high), optional action items, and links to related projects or users.

**Recent Captures:**

Shows the latest items from the AI Capture inbox (pending items only) with quick-action buttons to review or dismiss.

**Quick Actions:**

Shortcut buttons for common CEO tasks: create project, review queue, team overview, AI capture.

**Filtering:**

- Filter by assignee (person pills with threshold of 6 before collapsing to dropdown)
- Filter by project category/type
- Filter by status
- Search across all projects

---

### 3.2 CEO Calendar

A monthly calendar that aggregates all time-sensitive events across the organization onto a single grid view.

**Calendar Grid:**

- Monthly view with Monday-through-Sunday columns
- Each day cell shows colored dots representing event types present on that day
- Today is highlighted
- Navigation: previous/next month buttons

**Event Types and Color Coding:**

| Event Type | Dot Color | Source |
|------------|-----------|--------|
| deliverable | Blue (`bg-blue-500`) | Task milestones and deliverable due dates |
| leave | Red (`bg-red-500`) | Approved and pending leave requests |
| follow_up | Amber (`bg-amber-500`) | Follow-up items from captures or updates |
| meeting | Green (`bg-green-500`) | Meetings extracted from captures |
| commitment | Purple (`bg-purple-500`) | Commitments made by CEO or team |
| review | Orange (`bg-orange-500`) | Scheduled review dates |
| deadline | Slate (`bg-slate-500`) | Project or phase end dates |
| overdue | Red (striped) | Tasks past their deadline, shown with delay count |

**Filter Chips:**

Horizontal row of toggleable chips, one per event type. Active by default; click to hide/show specific event types.

**Day Detail Panel:**

Clicking any date opens a detail panel showing all events for that day, grouped by type. Each event card displays type-specific information:

- **Deliverable:** project title, assignee name, milestone title, status
- **Leave:** employee name, leave type, duration in days, reason, approval status
- **Follow-up:** title, assigned to, source (capture session or update)
- **Meeting:** title, attendees, time if available
- **Commitment:** what was committed, by whom, to whom, original due date
- **Review:** item title, submitter, project
- **Deadline:** project or phase title, days remaining or days overdue
- **Overdue:** task title, assignee, original deadline, days delayed

**Overdue Tracking:**

Tasks past their deadline appear as "overdue" events on the current date with a delay count badge (e.g., "3 days overdue"). They persist on the calendar until completed.

**Month Summary Statistics:**

Displayed below or beside the calendar grid:

- Total events this month
- Deliverables due
- Leave days
- Overdue items
- Reviews pending

---

### 3.3 Project Management

The core module for tracking all organizational projects from inception to completion.

**Project Categories (13 total):**

`engineering`, `data_science`, `design`, `sales`, `marketing`, `operations`, `hr`, `legal`, `strategy`, `research`, `product`, `finance`, `mixed`

Each category has a distinct color scheme for badges and borders (see `typeColors` mapping in the dashboard).

**Project Outcome Types:**

Projects are classified by their expected output:

- Engineering: `product`, `web_app`, `mobile_app`, `api_service`
- Data Science: `ml_model`, `data_pipeline`, `analytics_report`
- Research/Strategy: `report`, `exploration`, `market_analysis`
- Documents: `presentation`, `strategy_document`, `process_document`
- Marketing: `campaign`, `brand_asset`, `content`
- Design: `ui_design`, `ux_research`, `design_system`
- Operations/Tools: `tool`, `automation`, `integration`
- Legal/HR: `policy`, `compliance_report`
- Other: `other`

**Project Lifecycle:**

```
Creation -> Phases -> Tasks within Phases -> Milestones within Tasks -> Deliverables -> Review -> Completion/Kill
```

**Project Entity Fields:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| title | string | Project name |
| type | enum | One of the 13 category types |
| category | ProjectCategory | Same as type (legacy compat) |
| requirement | string | Original requirement text |
| objective | string | Optional high-level objective |
| outcomeType | ProjectOutcomeType | Expected deliverable type |
| outcomeDescription | string | Description of expected outcome |
| finalOutcome | FinalOutcome | Actual delivered result with status tracking |
| intermediateSubmissions | IntermediateSubmission[] | Mid-project deliverables for review |
| status | enum | `active`, `completed`, `killed`, `paused` |
| priority | enum | `low`, `medium`, `high`, `critical` |
| currentPhase | string | ID of the currently active phase |
| timeboxDays | number | Total allocated days for the project |
| startDate | string (ISO) | Project start date |
| techStack | string[] | Technologies used |
| assigneeIds | string[] | All team members on the project |
| ownerId | string | Primary project owner |
| coOwnerIds | string[] | Co-owners or joint owners |
| tasks | Task[] | All tasks within the project |
| phases | Phase[] | Project phases (ordered) |
| updates | Update[] | Status updates, documents, meeting notes |
| checkpoints | Checkpoint[] | Go/no-go decision points |
| requirementDoc | RequirementDocument | Versioned requirement with change tracking |
| documents | ProjectDocument[] | All project documents with versioning |
| aiPlan | object | AI-generated plan with risks and kill criteria |
| editHistory | EditChange[] | Audit trail of structural changes |

**Phase Structure:**

Each project has ordered phases. A phase contains:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | Phase name (e.g., "Design", "Development") |
| description | string | What this phase covers |
| status | enum | `pending`, `active`, `in_discussion`, `completed` |
| checklist | array | Items with done/not-done status |
| discussions | Discussion[] | Threaded discussions within the phase |
| attachments | PhaseAttachment[] | Documents, MOMs, feedback, proofs, architecture docs, prototypes |
| signedOffBy | string[] | User IDs who signed off |
| signOffRequired | boolean | Whether CEO sign-off is needed to proceed |
| estimatedDuration | string | Human-readable duration estimate |
| order | number | Sequence in the project |
| startDate | string (ISO) | Phase start date |
| endDate | string (ISO) | Phase end date |

**Task Structure:**

Tasks are the atomic work units. Each task contains:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| title | string | Task name |
| description | string | Detailed description |
| assigneeId | string | Assigned team member |
| approach | string | How the assignee plans to solve this |
| aiGeneratedPlan | object | AI-suggested approach with steps (mock) |
| planStatus | enum | `ai_generated`, `being_refined`, `finalized` |
| steps | TaskStep[] | Granular sub-steps with time estimates |
| successCriteria | string[] | What counts as "done" |
| killCriteria | string[] | When to abandon or redefine the task |
| estimatedHours | number | Initial time estimate |
| revisedEstimateHours | number | Updated estimate after initial work |
| status | enum | `planning`, `in_progress`, `completed`, `blocked`, `killed`, `redefined` |
| updates | TaskUpdate[] | Progress checkpoint updates |
| priority | enum | `low`, `medium`, `high` |
| milestones | TaskMilestone[] | Key milestones with deliverables |
| deadlineExtensions | DeadlineExtension[] | Tracked deadline changes with reasons |
| outcome | TaskOutcome | Final output (code, document, data, etc.) |
| reviewStatus | enum | `pending_review`, `approved`, `changes_requested`, `rejected` |
| reviewedBy | string | Who reviewed |
| reviewFeedback | string | Review comments |
| phaseId | string | Which phase this task belongs to |

**Task Steps (sub-steps):**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| description | string | Step description |
| expectedOutcome | string | What should be produced |
| category | enum | `design`, `development`, `review`, `testing`, `deployment`, `documentation`, `research`, `integration` |
| estimatedHours | number | Time estimate |
| actualHours | number | Actual time spent |
| status | enum | `pending`, `in_progress`, `completed`, `blocked`, `skipped` |
| assigneeId | string | Can differ from task assignee |
| dependencies | string[] | IDs of steps this depends on |
| reviewStatus | enum | `not_needed`, `pending_review`, `approved`, `changes_requested` |

**Task Milestones:**

Each milestone within a task represents a significant checkpoint:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| title | string | Milestone name |
| description | string | What this milestone represents |
| deliverableType | DeliverableType | `code`, `document`, `ppt`, `text`, `meeting_notes`, `data` |
| successCriteria | string[] | Criteria for completion |
| status | enum | `pending`, `in_progress`, `completed`, `blocked` |
| outcome | enum | `met`, `partially_met`, `not_met`, `deferred` |
| deliverables | Deliverable[] | Attached deliverables |
| updates | TaskUpdate[] | Progress updates |

**Deadline Extensions:**

When a deadline needs to move, it is formally tracked:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| projectId | string | Related project |
| milestoneId | string | Related milestone (optional) |
| taskId | string | Related task (optional) |
| requestedBy | string | Who is requesting the extension |
| originalDeadline | string (ISO) | The original due date |
| requestedDeadline | string (ISO) | The new requested date |
| reason | DelayReason | `personal`, `other_commitments`, `task_complexity`, `dependency_blocked`, `scope_change`, `technical_challenge` |
| reasonDetail | string | Detailed explanation |
| impact | string | What this delay means for the project |
| status | enum | `pending`, `approved`, `rejected`, `auto_escalated` |
| ceoComment | string | CEO response |
| escalationLevel | number | 0 = first request, 1 = second, 2+ = escalated |
| actionTaken | enum | `extended`, `reassigned`, `split_task`, `added_help`, `descoped` |

**Intermediate Submissions:**

Mid-project deliverables submitted for CEO review:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| title | string | Submission title |
| type | DeliverableType | Type of deliverable |
| description | string | What is being submitted |
| submittedBy | string | User ID |
| submittedAt | string (ISO) | Submission timestamp |
| url | string | Link to the deliverable |
| status | enum | `submitted`, `reviewed`, `approved`, `needs_revision` |
| feedback | string | Reviewer comments |
| isKeyMilestone | boolean | Whether this is a critical milestone |

**Final Outcome Tracking:**

| Field | Type | Description |
|-------|------|-------------|
| expectedType | ProjectOutcomeType | What was expected |
| expectedDescription | string | Description of expected output |
| status | enum | `not_started`, `in_progress`, `draft_submitted`, `review`, `finalized`, `delivered` |
| actualDeliverable | object | Title, type, description, URL, submission/verification metadata |
| completionNotes | string | Final notes |

**AI-Generated Project Plans (mock):**

Each project can have an AI plan containing:
- Summary of the recommended approach
- Risk assessment with mitigation strategies and severity levels
- Kill criteria (conditions under which the project should be abandoned)

**Requirement Documents:**

Projects can have versioned requirement documents with:
- Full text of current requirements broken into sections
- Change history with version tracking (initial, refinement, major/minor changes)
- Impact assessment per change (none, design_only, plan_and_design, development_only)
- Threaded discussions linked to specific changes
- Approval tracking per change

**Project Documents:**

General-purpose versioned documents attached to projects:
- Types: `requirement`, `design`, `technical_roadmap`, `architecture`, `api_spec`, `meeting_notes`, `research`, `test_plan`, `deployment`, `user_guide`, `custom`
- Each document has ordered sections, change history, and discussions
- Status workflow: `draft` -> `in_review` -> `approved` -> `active` -> `archived`
- Cross-linking between documents via `linkedDocumentIds`

**Edit History (Audit Trail):**

All structural changes to a project are logged:
- Section affected (phase, task, document, requirement, outcome, checkpoint)
- Description of what changed
- Impact areas with severity
- Approval workflow: `pending_approval` -> `approved` / `rejected`

---

### 3.4 Review Queue

A centralized inbox for all items awaiting CEO review.

**Review Task Entity:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| description | string | What needs to be reviewed |
| assigneeIds | string[] | Who should do the review work |
| assignedBy | string | Always the CEO |
| priority | enum | `low`, `medium`, `high` |
| dueDate | string (ISO) | When review is needed by |
| status | enum | `pending`, `in_progress`, `completed` |
| sourceType | enum | `deliverable`, `milestone`, `task` |
| sourceTitle | string | Title of the source item |
| projectId | string | Related project |
| projectTitle | string | Project name for display |
| createdAt | string (ISO) | When the review was created |

**Features:**

- Filter by project, source type, submitter, or status
- Sort by newest first or oldest first
- Priority badges with color coding (critical=red, high=amber, medium=blue, low=slate)
- Quick actions: approve, request changes, reject
- Each review card shows: source item title, project context, submitter, submission date, priority badge
- Converting a capture item into a review task via the AI Capture module

---

### 3.5 Team Management

**Team Directory:**

- List of all team members grouped by department
- Each member shows: name, role, department, email, avatar (color-coded circle with initials)
- Click to navigate to individual member profile

**Individual Member Profile (`/team/[id]`):**

The member profile is a comprehensive view containing multiple sections:

**Active Tasks and Deliverables:**
- All tasks assigned to this person across all projects
- Each task shows: project context, status, priority, milestone progress, days remaining
- Expandable to see steps, deliverables, and updates

**Leave History:**
- All leave requests for this person (approved, pending, rejected)
- Inline leave analytics (toggled via eye icon) -- see Section 3.6 for details

**Performance Profile:**

This is a key differentiator. For each team member, the system computes:

| Metric | Description |
|--------|-------------|
| Deadline Adherence | Percentage of tasks completed on time vs. late vs. still overdue |
| Extension History | Number of deadline extensions requested, with reasons breakdown |
| Submission Record | Count and status of intermediate submissions and final outcomes |
| Monthly Scorecard | Last 3 months of performance data: tasks completed, on-time rate, hours estimated vs. actual |
| Commitment Summary | Commitments made (from captures) and their fulfillment status |
| Organizational Contributions | Cross-project contributions, coverage for teammates on leave, review participation |

**AI Performance Insights:**
- AI-generated observations about the team member's work patterns
- Includes: strengths, areas for improvement, risk flags (e.g., consistently late on certain task types)

---

### 3.6 Leave and Availability

**Leave Request Entity:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| userId | string | Who is requesting leave |
| type | LeaveType | `planned`, `sick`, `personal`, `wfh`, `half_day` |
| startDate | string (ISO) | Leave start date |
| endDate | string (ISO) | Leave end date |
| days | number | Total leave days |
| reason | string | Reason for leave |
| status | enum | `pending`, `approved`, `rejected` |
| approvedBy | string | Who approved (CEO) |
| approvedAt | string (ISO) | Approval timestamp |
| coveragePlan | string | Description of coverage arrangements |
| contingencyNote | string | What will be handled before leaving |
| coverPersonId | string | Who is covering |
| impacts | LeaveImpact[] | Auto-calculated impact on tasks and projects |
| createdAt | string (ISO) | Request timestamp |

**Leave Impact Assessment:**

When a leave request is created, the system automatically calculates the impact:

| Field | Type | Description |
|-------|------|-------------|
| taskId | string | Affected task |
| taskTitle | string | Task name |
| milestoneId | string | Affected milestone |
| projectId | string | Affected project |
| impactDays | number | How many days this leave delays the task |
| cascadeEffects | array | Downstream effects on other team members' tasks |

Each cascade effect includes: affected user, affected task, delay days, and reason (e.g., "Blocked -- waiting for design handoff").

**Approval Workflow:**

1. Team member submits leave request with dates, reason, and coverage plan
2. System auto-calculates impact on all active tasks/projects
3. CEO sees request in "Needs Your Attention" with impact summary
4. CEO approves (with optional comment) or rejects (with reason)
5. Approved leave appears on the CEO Calendar

**Leave Analytics (per-person):**

Toggled inline via an eye icon on the team member profile. Provides a Financial Year (FY) breakdown:

| Analytic | Description |
|----------|-------------|
| FY Breakdown by Type | Days and count for each leave type: planned, sick, personal, WFH, half-day |
| Unplanned/Last-Minute Tracking | Leaves where the request was made 1 day or less before the start date |
| Planning Pattern % | Ratio of planned vs. unplanned leaves |
| Monthly Trend | Leave days per month over the FY |
| Team Average Comparison | How this person's leave pattern compares to department average |
| AI Insights | Warnings about patterns (e.g., frequent Monday sick leaves, leave clustering around deadlines) |

FY period: April 1, 2025 to March 31, 2026.

Unplanned leave detection: `differenceInCalendarDays(startDate, createdAt) <= 1`.

---

### 3.7 AI Capture (Smart Inbox)

The AI Capture module is a key differentiator. It allows the CEO to dump unstructured notes, meeting takeaways, or verbal commitments into a text box, and the system classifies and structures them into actionable items.

**Input:**

- Large text area for free-form input
- Example placeholder text showing the expected format
- "Process" button that triggers parsing
- Loading state during processing (simulated delay)

**AI Parser (current: keyword-based, target: LLM-based):**

The parser splits input into sentences and classifies each one:

| Capture Type | Keywords (current) | Description |
|-------------|-------------------|-------------|
| todo | assign, task, complete, implement, build, fix, etc. | Action items to be done |
| follow_up | report, send, deliver, provide, by Friday, due, etc. | Items requiring follow-up by a date |
| commitment | committed, promised, agreed, will deliver, etc. | Promises made by CEO or team |
| meeting | meeting, discuss, call with, sync, standup, etc. | Meetings to be scheduled or noted |
| review_reminder | review, check, verify, approve, sign off, etc. | Items needing CEO review |
| timeline | deadline, milestone, launch, release, target date, etc. | Date-sensitive milestones |

For each extracted item, the parser also:
- **Extracts assignees:** Matches names against the `USERS` list
- **Infers department:** Based on matched user's department
- **Extracts due date:** Parses relative dates ("by Friday", "next week", "end of month", "tomorrow", specific dates like "April 15th")
- **Assigns priority:** Based on urgency keywords and date proximity

**Capture Item Entity:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| type | CaptureItemType | One of the 6 types above |
| rawText | string | Original sentence from input |
| title | string | Cleaned-up title |
| description | string | Expanded description |
| assigneeIds | string[] | Matched team members |
| department | string | Inferred department |
| dueDate | string (ISO) | Extracted or inferred date |
| priority | enum | `low`, `medium`, `high`, `critical` |
| status | enum | `pending`, `converted`, `dismissed` |
| convertedTo | object | If converted: type and ID of the created entity |
| projectId | string | Linked project (if identified) |
| createdAt | string (ISO) | Timestamp |

**Capture Session Entity:**

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| rawInput | string | Full original text blob |
| items | CaptureItem[] | Parsed items from this session |
| createdAt | string (ISO) | Timestamp |

**Actions on Captured Items:**

| Action | Description |
|--------|-------------|
| Edit inline | Modify title, assignees, department, due date, priority |
| Convert to review task | Creates a ReviewTask and links it (status becomes "converted") |
| Convert to task | Creates a Task within a project |
| Dismiss | Marks as dismissed (soft delete) |

**Session History:**

- List of past capture sessions with timestamp and item count
- Expandable to review past items
- Pending items badge in the sidebar navigation shows count of unconverted items

---

## 4. Data Model Summary

### 4.1 Core Entities

```
User
  id: string
  name: string
  role: string
  department: string
  email: string
  avatarColor: string

Project
  id: string
  title: string
  type: ProjectCategory (13 options)
  category: ProjectCategory
  requirement: string
  objective: string
  outcomeType: ProjectOutcomeType (25+ options)
  outcomeDescription: string
  finalOutcome: FinalOutcome
  intermediateSubmissions: IntermediateSubmission[]
  status: "active" | "completed" | "killed" | "paused"
  priority: "low" | "medium" | "high" | "critical"
  currentPhase: string (phase ID)
  timeboxDays: number
  startDate: string (ISO)
  techStack: string[]
  assigneeIds: string[]
  ownerId: string
  coOwnerIds: string[]
  tasks: Task[]
  phases: Phase[]
  updates: Update[]
  checkpoints: Checkpoint[]
  requirementDoc: RequirementDocument
  documents: ProjectDocument[]
  aiPlan: { summary, risks[], killCriteria[] }
  editHistory: EditChange[]

Phase
  id: string
  name: string
  description: string
  status: "pending" | "active" | "in_discussion" | "completed"
  checklist: { item: string, done: boolean }[]
  discussions: Discussion[]
  attachments: PhaseAttachment[]
  signedOffBy: string[]
  signOffRequired: boolean
  estimatedDuration: string
  order: number
  startDate: string (ISO)
  endDate: string (ISO)

Task
  id: string
  title: string
  description: string
  assigneeId: string
  approach: string
  aiGeneratedPlan: { approach, steps[], generatedAt }
  planStatus: "ai_generated" | "being_refined" | "finalized"
  steps: TaskStep[]
  successCriteria: string[]
  killCriteria: string[]
  estimatedHours: number
  revisedEstimateHours: number
  status: "planning" | "in_progress" | "completed" | "blocked" | "killed" | "redefined"
  updates: TaskUpdate[]
  priority: "low" | "medium" | "high"
  milestones: TaskMilestone[]
  deadlineExtensions: DeadlineExtension[]
  outcome: TaskOutcome
  reviewStatus: "pending_review" | "approved" | "changes_requested" | "rejected"
  reviewedBy: string
  reviewFeedback: string
  phaseId: string
  createdAt: string (ISO)
  completedAt: string (ISO)

LeaveRequest
  id: string
  userId: string
  type: "planned" | "sick" | "personal" | "wfh" | "half_day"
  startDate: string (ISO)
  endDate: string (ISO)
  days: number
  reason: string
  status: "pending" | "approved" | "rejected"
  approvedBy: string
  approvedAt: string (ISO)
  coveragePlan: string
  contingencyNote: string
  coverPersonId: string
  impacts: LeaveImpact[]
  createdAt: string (ISO)

CaptureSession
  id: string
  rawInput: string
  items: CaptureItem[]
  createdAt: string (ISO)

CaptureItem
  id: string
  type: "todo" | "follow_up" | "commitment" | "meeting" | "review_reminder" | "timeline"
  rawText: string
  title: string
  description: string
  assigneeIds: string[]
  department: string
  dueDate: string (ISO)
  priority: "low" | "medium" | "high" | "critical"
  status: "pending" | "converted" | "dismissed"
  convertedTo: { type: string, id: string }
  projectId: string
  createdAt: string (ISO)

ReviewTask
  id: string
  description: string
  assigneeIds: string[]
  assignedBy: string
  priority: "low" | "medium" | "high"
  dueDate: string (ISO)
  status: "pending" | "in_progress" | "completed"
  sourceType: "deliverable" | "milestone" | "task"
  sourceTitle: string
  projectId: string
  projectTitle: string
  createdAt: string (ISO)
```

### 4.2 Supporting Entities

```
TaskStep
  id, description, expectedOutcome, category (8 types), estimatedHours,
  actualHours, status, assigneeId, dependencies[], reviewStatus, reviewerId, notes

TaskMilestone
  id, title, description, deliverableType, successCriteria[], status,
  assigneeId, targetDay, outcome, outcomeNotes, deliverables[], updates[], completedAt

Deliverable
  id, type (code/document/ppt/text/meeting_notes/data), title, description,
  status, codeRepoUrl, codePrUrl, codeBranch, documentUrl, fileType,
  textContent, attendees[], decisions[], actionItems[], links[],
  submittedBy, submittedAt, verifiedBy, verifiedAt, feedback

DeadlineExtension
  id, projectId, milestoneId, taskId, requestedBy, originalDeadline,
  requestedDeadline, reason (6 types), reasonDetail, impact, status,
  ceoComment, escalationLevel, actionTaken

TaskOutcome
  type (information/decision/document/code/design/data), expectedDeliverable,
  status, textContent, documentTitle, documentUrl, codeRepoUrl, codePrUrl,
  codeBranch, links[], submittedBy, submittedAt, verifiedBy, feedback

Update
  id, projectId, userId, type (status_update/document/code/architecture/notebook/demo/meeting_notes),
  title, description, link, attachments[], whatWasDone, blockers, nextSteps,
  attendees[], decisions[], actionItems[], reviewed, feedback[]

AIInsight
  id, type (risk/opportunity/blocker/performance/suggestion), severity,
  title, description, actionItems[], relatedProjectId, relatedUserId

Checkpoint
  id, projectId, decision (continue/kill/pivot), notes, aiInsights, actionItems[]

RequirementDocument
  currentVersion, lastUpdated, currentText, sections[], changes[], discussions[]

ProjectDocument
  id, type (11 types), title, description, currentVersion, status,
  sections[], changes[], discussions[], linkedDocumentIds[], tags[]

EditChange
  id, section, sectionId, sectionTitle, changeDescription, changedBy,
  changedAt, impactAreas[], status (pending_approval/approved/rejected)
```

---

## 5. UI/UX Principles

### Navigation

Sidebar navigation grouped by function:

| Group | Items |
|-------|-------|
| Overview | Dashboard (Command Center) |
| Projects | All Projects, Project Detail |
| Reviews | Review Queue |
| Team | Team Directory, Member Profiles |
| AI | Capture (Smart Inbox) |
| Calendar | CEO Calendar |

Sidebar shows pending item counts as badges (e.g., pending captures, pending reviews).

### Layout Principles

- **Card-based layout:** Every data group is wrapped in a Card component with consistent header, description, and content sections
- **Expandable panels:** Complex data (leave analytics, task details, milestone deliverables) uses inline expandable/collapsible panels rather than navigating away
- **Inline editing:** Where possible, data is editable inline rather than through separate forms

### Color System

| Element | Color Scheme |
|---------|-------------|
| Priority: critical | Red (`bg-red-600`) |
| Priority: high | Amber (`bg-amber-600`) |
| Priority: medium | Blue (`bg-blue-600`) |
| Priority: low | Slate (`bg-slate-600`) |
| Status: active | Emerald |
| Status: completed | Green |
| Status: killed | Red |
| Status: paused | Amber |
| Department colors | Each of 13 categories has a unique color (blue, violet, pink, orange, rose, slate, cyan, gray, indigo, emerald, amber, purple, teal) |

### Data Presentation Philosophy

- **Text-heavy analytics, no charts.** The CEO prefers reading data directly rather than interpreting graphs. All metrics are presented as numbers, percentages, and descriptive text.
- Tables and lists are the primary data visualization tools.
- Color coding provides at-a-glance status without requiring chart interpretation.

### Interaction Patterns

- Filter chips for multi-select filtering (calendar event types, project categories)
- Person filter pills with a threshold (6 pills shown, then collapse to searchable dropdown)
- Badge counts for pending/attention items
- Click-to-expand for detail panels
- Eye icon toggle for analytics overlays (leave analytics)

---

## 6. Technical Architecture

### Current Stack (Frontend Prototype)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js with App Router |
| Rendering | Client components (`"use client"` throughout) |
| UI Library | shadcn/ui (Card, Badge, Button, Progress, Separator, Input, Textarea) |
| Icons | Lucide React |
| Date Handling | date-fns (format, parseISO, differenceInCalendarDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addMonths, subMonths, etc.) |
| Styling | Tailwind CSS |
| State Management | React useState + useMemo (local component state, no global store) |
| Data Store | Mutable JavaScript arrays in `mock-data.ts` (no persistence) |
| AI Parser | Keyword-based classification in `ai-capture-parser.ts` (no LLM) |
| Routing | Next.js App Router: `/`, `/calendar`, `/capture`, `/team/[id]`, `/projects/[id]`, `/reviews` |

### Key Architectural Decisions

1. **All client-side rendering:** Every page uses `"use client"` -- no SSR or server components currently
2. **Mutable mock data:** The `mock-data.ts` file exports mutable arrays and helper functions (`addCaptureSession`, `updateCaptureItem`, `dismissCaptureItem`, `convertCaptureItem`, `addReviewTask`, `addTask`). Changes persist only within a session (page refresh resets).
3. **No authentication:** Single-user mode, no login
4. **No real AI:** The capture parser uses keyword matching, not an LLM
5. **No database:** All data lives in TypeScript files

---

## 7. Backend Requirements (To Be Built)

### 7.1 Database

- **Technology:** PostgreSQL (recommended for production) or SQLite (for rapid prototyping) via Prisma ORM
- **Schema:** Must support all entities defined in Section 4 with proper foreign key relationships
- **Key relationships:**
  - Project 1:N Phases, Tasks, Updates, Checkpoints, Documents
  - Task 1:N TaskSteps, TaskMilestones, DeadlineExtensions, TaskUpdates
  - TaskMilestone 1:N Deliverables
  - User 1:N Tasks (assignee), LeaveRequests, Updates
  - CaptureSession 1:N CaptureItems
  - Project N:N Users (via assigneeIds)
- **Migrations:** Prisma Migrate for schema versioning

### 7.2 Authentication

- **Method:** Session-based authentication (recommended) or JWT
- **Roles:** CEO (admin, full access), Team Lead (department-scoped), Member (own tasks only)
- **Session management:** Secure HTTP-only cookies
- **No public registration:** Users created by admin (CEO)

### 7.3 API Layer

REST endpoints matching the existing page structure:

| Endpoint Group | Key Operations |
|---------------|----------------|
| `GET/POST /api/projects` | List all projects, create project |
| `GET/PUT /api/projects/[id]` | Get/update project detail |
| `GET/POST /api/projects/[id]/tasks` | List/create tasks within a project |
| `PUT /api/projects/[id]/tasks/[taskId]` | Update task status, add updates |
| `POST /api/projects/[id]/tasks/[taskId]/extensions` | Request deadline extension |
| `PUT /api/projects/[id]/tasks/[taskId]/extensions/[extId]` | Approve/reject extension |
| `GET/POST /api/projects/[id]/submissions` | List/submit intermediate deliverables |
| `GET/POST /api/reviews` | List/create review tasks |
| `PUT /api/reviews/[id]` | Update review status (approve/reject/request changes) |
| `GET /api/users` | List all users |
| `GET /api/users/[id]` | User profile with computed metrics |
| `GET /api/users/[id]/performance` | Performance profile computation |
| `GET/POST /api/leaves` | List/request leave |
| `PUT /api/leaves/[id]` | Approve/reject leave request |
| `GET /api/leaves/[id]/impact` | Compute leave impact |
| `GET /api/users/[id]/leave-analytics` | FY leave analytics |
| `POST /api/capture` | Submit raw text for AI parsing |
| `GET /api/capture/sessions` | List capture sessions |
| `PUT /api/capture/items/[id]` | Edit, convert, or dismiss capture item |
| `GET /api/calendar/events` | Aggregated calendar events for a date range |
| `GET /api/dashboard/summary` | Dashboard summary statistics |
| `GET /api/dashboard/attention` | "Needs Your Attention" items |
| `GET /api/insights` | AI-generated insights |

### 7.4 AI Integration

- **Provider:** Anthropic Claude API
- **Use cases:**
  1. **Capture parsing:** Replace keyword-based parser with LLM classification. Send raw text, receive structured CaptureItem objects.
  2. **Project plan generation:** Given a project requirement, generate phases, tasks, milestones, time estimates, risks, and kill criteria.
  3. **Performance insights:** Analyze a team member's task history to generate strengths, areas for improvement, and risk flags.
  4. **Dashboard insights:** Analyze cross-project data to identify risks, blockers, opportunities, and suggestions.
  5. **Leave impact analysis:** Assess the ripple effects of a leave request on project timelines.
- **Implementation:** Dedicated service layer that wraps Claude API calls with structured prompts and response parsing.

### 7.5 File Storage

- **Technology:** AWS S3 (production) or local filesystem (development)
- **Use cases:** Deliverable uploads (documents, code archives, presentations), project document attachments, phase attachments (MOMs, prototypes, proofs)
- **Access control:** Files are scoped to projects; only project members and CEO can access

### 7.6 Notifications

- **Email:** Transactional emails for: deadline approaching (3-day warning), deadline missed, leave request status change, review assigned, extension request/response
- **In-app:** Real-time notification bell with unread count for: new review assignments, leave approvals, capture items needing attention, project status changes
- **Implementation:** Background job queue (e.g., BullMQ or similar) for email; WebSocket or polling for in-app

### 7.7 Audit Trail

Track all state transitions across the system:

- Project status changes (active -> paused -> killed)
- Task status changes with timestamps
- Review decisions (approve/reject/request changes) with reviewer and comments
- Leave request approvals/rejections
- Deadline extension requests and responses
- Capture item conversions
- Edit history on project structure (phases, tasks, documents)
- Who changed what, when, and why

Store as append-only log table: `{ id, entityType, entityId, action, previousValue, newValue, userId, timestamp }`.

---

## 8. Priority for Backend Development

| Priority | Module | Reason |
|----------|--------|--------|
| P0 | Auth + User Management | Foundation for all other modules. CEO, team leads, and members need distinct access levels. |
| P0 | Project CRUD + Phases/Tasks | Core functionality. Every other module depends on project and task data. |
| P1 | Review Workflow | CEO uses this daily to approve/reject deliverables and submissions. Directly impacts team velocity. |
| P1 | Leave Management | Needed for team operations. Impact assessment is critical for CEO decision-making. |
| P1 | AI Capture with Real LLM | Key differentiator. Replaces keyword parser with Claude API. Transforms unstructured CEO notes into structured tasks. |
| P2 | Calendar Aggregation | Read-only aggregation view. Can initially be computed on the frontend from existing API data. Backend optimization needed only for performance at scale. |
| P2 | Performance Profiles | Computation-heavy but only viewed monthly. Can be computed on-demand or cached. |
| P3 | Notifications (Email + In-App) | Nice-to-have. System is usable without notifications since CEO checks dashboard directly. |
| P3 | Audit Trail | Important for compliance and accountability but not blocking core workflows. Can be added incrementally. |

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| Command Center | The main dashboard page showing all summary information |
| Capture | The process of converting unstructured text into structured action items |
| Kill Criteria | Conditions under which a project or task should be abandoned |
| Timebox | The maximum number of days allocated for a project |
| Escalation Level | How many times a deadline has been extended (0 = first request, 2+ = escalated) |
| FY | Financial Year, April 1 to March 31 |
| Coverage Person | Team member assigned to handle responsibilities during another's leave |
| Intermediate Submission | A mid-project deliverable submitted for review before the final outcome |
| Phase Sign-off | CEO approval required to move from one project phase to the next |

---

## 10. Open Questions for Backend Team

1. **Real-time updates:** Should the dashboard use WebSockets for live updates, or is polling every 30-60 seconds acceptable?
2. **AI cost management:** How to rate-limit or cache Claude API calls for capture parsing and insights generation?
3. **Multi-tenancy:** Is this a single-org tool forever, or should the schema support multiple organizations?
4. **Mobile access:** Is a mobile-responsive web app sufficient, or is a native mobile app needed?
5. **Data retention:** How long should audit trail and capture session history be retained?
6. **Backup and recovery:** What is the RPO/RTO for the database?
7. **Concurrent editing:** Should multiple users be able to edit the same project/task simultaneously? If so, optimistic locking or CRDT?
