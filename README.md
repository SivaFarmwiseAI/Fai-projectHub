# ProjectHub -- CEO Command Center

## Overview

ProjectHub is a CEO-centric project management tool designed for a CEO who acts as project manager across engineering and data science departments. It provides a unified command center for tracking projects, reviewing deliverables, managing team availability, and capturing unstructured notes into actionable items.

This is currently a **frontend prototype** built with mock data. There is no backend or database connected yet, though a Prisma schema and API route stubs are in place for future integration.

## Tech Stack

| Layer         | Technology                          |
|---------------|-------------------------------------|
| Framework     | Next.js 16.2 (App Router)          |
| UI Library    | React 19.2                          |
| Language      | TypeScript 5                        |
| Styling       | Tailwind CSS 4                      |
| Components    | shadcn/ui + Base UI                 |
| Icons         | lucide-react                        |
| Date Handling | date-fns 4                          |
| ORM           | Prisma 7.6 (schema defined, not yet connected) |
| AI SDK        | @anthropic-ai/sdk (installed, not yet wired) |

## Features

### 1. Command Center Dashboard
Overview page with project statistics, pending reviews requiring attention, AI-generated insights, and recent capture items. Serves as the CEO's daily starting point.

### 2. CEO Calendar
Interactive monthly calendar that aggregates deliverables, team leaves, follow-ups, meetings, commitments, deadlines, and overdue items across all projects. Supports filtering by event type and click-to-view details.

### 3. Projects Management
Full project lifecycle tracking. Create projects across 13 categories (engineering, data science, design, sales, marketing, operations, HR, legal, strategy, research, product, finance, mixed). Track phases, tasks with granular sub-steps, milestones, deliverables, and deadline extensions.

### 4. New Project Wizard
Guided project creation with category selection, outcome type definition, owner/co-owner assignment, and AI-generated project plans with phases, milestones, and task breakdowns.

### 5. Review Queue
Centralized queue of pending review tasks with filtering by project, type, and submitter. Supports approve/reject workflow with feedback.

### 6. Team Directory
Team member listing with roles, departments, and quick-access performance metrics.

### 7. Team Member Profiles
Deep individual view showing assigned tasks, deliverable history, leave records, and a performance profile including deadline adherence rates, monthly scorecards, commitment tracking, and organizational contributions.

### 8. Leave & Availability
Leave request management with an approval workflow, impact assessment on active projects, and coverage assignment.

### 9. Leave Analytics
Per-person leave analysis with fiscal year breakdowns by leave type, unplanned/last-minute leave tracking, monthly pattern visualization, and AI-generated insights.

### 10. AI Capture
Smart inbox where unstructured text (meeting notes, quick thoughts, voice-to-text dumps) is parsed into structured items: todos, follow-ups, commitments, meetings, and reminders. Parsed items can be converted into review tasks or assigned directly.

## Project Structure

```
src/
├── app/                              # Next.js App Router pages
│   ├── layout.tsx                    # Root layout with sidebar
│   ├── page.tsx                      # Command Center dashboard
│   ├── globals.css                   # Global styles and Tailwind config
│   ├── calendar/
│   │   └── page.tsx                  # CEO Calendar page
│   ├── capture/
│   │   └── page.tsx                  # AI Capture smart inbox
│   ├── projects/
│   │   ├── page.tsx                  # Projects list with sorting/filtering
│   │   ├── new/
│   │   │   └── page.tsx              # New project creation wizard
│   │   └── [id]/
│   │       └── page.tsx              # Individual project detail view
│   ├── reviews/
│   │   └── page.tsx                  # Review queue
│   ├── team/
│   │   ├── page.tsx                  # Team directory
│   │   ├── manage/
│   │   │   └── page.tsx              # Team management
│   │   ├── availability/
│   │   │   └── page.tsx              # Leave and availability management
│   │   └── [id]/
│   │       └── page.tsx              # Individual team member profile
│   └── api/                          # API route stubs (for future backend)
│       ├── ai/
│       │   ├── generate-plan/route.ts
│       │   ├── review/route.ts
│       │   └── suggest-stack/route.ts
│       ├── checkpoints/route.ts
│       ├── feedback/route.ts
│       ├── phases/route.ts
│       ├── projects/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── submissions/route.ts
│       └── users/route.ts
├── components/                       # React components
│   ├── sidebar.tsx                   # Main navigation sidebar
│   ├── dashboard-client.tsx          # Command Center client component
│   ├── leave-analytics.tsx           # Leave analytics charts and insights
│   ├── new-project-client.tsx        # Project creation wizard logic
│   ├── project-detail-client.tsx     # Project detail view logic
│   ├── projects-list-client.tsx      # Projects list with sorting
│   ├── reviews-client.tsx            # Review queue client component
│   ├── team-client.tsx               # Team directory client component
│   ├── team-member-client.tsx        # Individual member profile logic
│   └── ui/                           # shadcn/ui primitives
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── checkbox.tsx
│       ├── dialog.tsx
│       ├── dropdown-menu.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── progress.tsx
│       ├── scroll-area.tsx
│       ├── select.tsx
│       ├── separator.tsx
│       ├── sheet.tsx
│       ├── tabs.tsx
│       ├── textarea.tsx
│       └── tooltip.tsx
├── lib/                              # Shared utilities and data
│   ├── mock-data.ts                  # Mock data store (all types + seed data)
│   ├── ai-capture-parser.ts          # Keyword-based parser for AI Capture
│   ├── phases.ts                     # Phase/milestone generation logic
│   ├── prisma.ts                     # Prisma client setup
│   └── utils.ts                      # Utility functions (cn, etc.)
└── generated/
    └── prisma/                       # Prisma-generated client types
```

## Getting Started

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Open in browser
open http://localhost:3000
```

No database setup is required -- the app runs entirely on in-memory mock data.

## Pages / Routes

| Route               | Page                | Description                                              |
|----------------------|---------------------|----------------------------------------------------------|
| `/`                  | Command Center      | Dashboard with project stats, pending reviews, AI insights |
| `/calendar`          | CEO Calendar        | Interactive monthly calendar with event aggregation       |
| `/projects`          | Projects            | Project list with sorting and filtering                   |
| `/projects/new`      | New Project          | Multi-step project creation wizard                       |
| `/projects/[id]`     | Project Detail       | Full project view with phases, tasks, deliverables       |
| `/reviews`           | Review Queue         | Pending reviews with approve/reject workflow             |
| `/team`              | Team Directory       | Team member listing with roles and departments           |
| `/team/[id]`         | Member Profile       | Individual profile, tasks, performance metrics           |
| `/team/manage`       | Manage Team          | Add/edit team members                                    |
| `/team/availability` | Leave & Availability | Leave requests, approval workflow, coverage              |
| `/capture`           | AI Capture           | Smart inbox for parsing unstructured notes               |

## Data Architecture

- **Data store**: Mutable module-level arrays in `/src/lib/mock-data.ts` serve as the in-memory data store
- **Persistence**: None -- all data resets on page refresh
- **Prisma schema**: Defined at `/prisma/schema.prisma` with migrations, ready for future database connection
- **API routes**: Stub routes exist at `/src/app/api/` but the frontend currently imports data directly from `mock-data.ts`
- **AI features**: The capture parser (`ai-capture-parser.ts`) and plan generator use keyword matching, not actual LLM API calls

## Key Data Models

| Type                   | Purpose                                                       |
|------------------------|---------------------------------------------------------------|
| `Project`              | Core entity with category, phases, tasks, milestones, outcome |
| `Task`                 | Work item with sub-steps, time estimates, outcomes, reviews    |
| `Phase`                | Project phase grouping tasks with timeline                     |
| `TaskMilestone`        | Checkpoint within a task with deliverables and success criteria |
| `User`                 | Team member with role, department, email                       |
| `LeaveRequest`         | Leave record with type, dates, approval status, impact         |
| `CaptureSession`       | AI Capture session with raw text and parsed structured items   |
| `ReviewTask`           | Pending review item linked to a project/task                   |
| `Deliverable`          | Submitted work artifact (code, document, PPT, data, etc.)      |
| `DeadlineExtension`    | Deadline change request with justification                     |
| `FinalOutcome`         | Expected project output with delivery status                   |

## Development Notes

- This is a frontend prototype. All data is mock and non-persistent.
- AI features (capture parsing, plan generation, stack suggestions) use keyword matching heuristics, not actual LLM calls. The `@anthropic-ai/sdk` dependency is installed but not yet wired up.
- The sidebar shows a "Prototype Mode" badge to make this clear.
- To add a real backend: replace `mock-data.ts` imports with `fetch` calls to the API routes, then connect the API routes to Prisma with a real database.
- shadcn/ui components live in `/src/components/ui/` and follow the standard shadcn patterns.
- The app uses the Next.js App Router with a mix of server and client components. Pages are server components that render client components (suffixed with `-client.tsx`).

## Backend Roadmap

The following work is needed to move from prototype to production:

1. **Database setup** -- Connect Prisma to SQLite (local dev) or PostgreSQL (production). Run existing migrations.
2. **Authentication and authorization** -- Add user login. Currently hardcoded to a single CEO user.
3. **Real API endpoints** -- Wire the existing API route stubs to Prisma queries. Update frontend to fetch from API instead of importing mock data.
4. **AI integration** -- Connect the Anthropic Claude API for capture parsing (replace keyword matcher), project plan generation, and review suggestions.
5. **File uploads** -- Add storage for deliverable attachments (documents, code artifacts, presentations).
6. **Notifications** -- Email or in-app notifications for review requests, deadline changes, leave approvals.
7. **Real-time updates** -- WebSocket or polling for live dashboard updates when team members submit work.
8. **Multi-user support** -- Role-based views so team members can log in and submit their own updates.
