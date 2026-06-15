# ProjectHub -- Development Guide

## Prerequisites
- Node.js 18+
- npm 9+

## Setup
```bash
git clone <repo-url>
cd projecthub
npm install
npm run dev
```

## Project Structure
```
projecthub/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── page.tsx            # Dashboard (Command Center)
│   │   ├── layout.tsx          # Root layout with sidebar
│   │   ├── globals.css         # Global styles + Tailwind
│   │   ├── calendar/           # CEO Calendar
│   │   ├── capture/            # AI Capture inbox
│   │   ├── projects/           # Projects list, detail, new
│   │   ├── reviews/            # Review queue
│   │   ├── team/               # Team directory, profiles, availability
│   │   └── api/                # API routes
│   │       ├── ai/
│   │       │   ├── generate-plan/  # AI project plan generation
│   │       │   ├── review/         # AI code/submission review
│   │       │   └── suggest-stack/  # AI tech stack suggestions
│   │       ├── checkpoints/    # Project checkpoints (continue/kill)
│   │       ├── feedback/       # Submission feedback
│   │       ├── phases/         # Phase management
│   │       ├── projects/       # CRUD for projects
│   │       │   └── [id]/       # Single project operations
│   │       ├── submissions/    # Deliverable submissions
│   │       └── users/          # User management
│   ├── components/
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── sidebar.tsx         # Navigation sidebar
│   │   ├── dashboard-client.tsx
│   │   ├── leave-analytics.tsx # Leave analysis panel
│   │   ├── new-project-client.tsx
│   │   ├── project-detail-client.tsx
│   │   ├── projects-list-client.tsx
│   │   ├── reviews-client.tsx
│   │   ├── team-client.tsx
│   │   └── team-member-client.tsx
│   ├── lib/
│   │   ├── mock-data.ts        # ALL mock data + types + helpers
│   │   ├── ai-capture-parser.ts # Keyword-based AI parser
│   │   ├── phases.ts           # Phase definitions (engineering + research)
│   │   ├── prisma.ts           # Prisma client singleton
│   │   └── utils.ts            # cn() utility (clsx + tailwind-merge)
│   └── generated/              # Prisma generated client
│       └── prisma/
├── prisma/
│   ├── schema.prisma           # Database schema (SQLite)
│   ├── seed.mts                # Database seed script
│   ├── seed.ts                 # Alternate seed script
│   └── migrations/             # Prisma migrations
├── public/                     # Static assets
└── docs/                       # Design documents
```

## Architecture Notes

### Dual-Mode Data Layer
The app has two data paths that coexist:

1. **Mock data** (`/src/lib/mock-data.ts`) -- Mutable module-level arrays used by older client components. Data resets on page refresh. No persistence.
2. **Prisma + SQLite** (`/prisma/schema.prisma`) -- A real database layer with API routes in `/src/app/api/`. Uses Prisma 7 with a SQLite backend via `better-sqlite3`.

Some pages still read from mock data; others hit the API routes. The migration from mock to API is in progress.

### Database Models (Prisma)
The schema defines six core models:

| Model | Purpose |
|-------|---------|
| `User` | Team members (name, role, email, avatarColor) |
| `Project` | Projects with type (engineering/research), priority, timebox, current phase |
| `ProjectAssignee` | Many-to-many join between projects and users |
| `Phase` | Ordered project phases with checklist items (JSON string) |
| `Submission` | Deliverables submitted per phase (document, code, architecture, etc.) |
| `Feedback` | Review comments on submissions (supports AI-generated feedback) |
| `Checkpoint` | CEO decision points -- continue or kill a project |

### Phase System
Projects follow structured phase workflows defined in `/src/lib/phases.ts`:

- **Engineering projects**: Requirements > Design > Development > Review > Deploy > Done
- **Research projects**: Hypothesis > Exploration > Experiment > Evaluation > Report > Done

Each phase has a checklist. Phases are created automatically when a project is created via the POST `/api/projects` endpoint.

### Component Pattern
- Pages live in `/src/app/` using the Next.js App Router
- Most pages use `"use client"` directive (client-side rendering)
- Heavy use of `useMemo` for computed/filtered data
- UI primitives from shadcn/ui in `/src/components/ui/`
- Page-specific logic lives in `*-client.tsx` components in `/src/components/`

### Styling
- Tailwind CSS 4 with `@tailwindcss/postcss`
- shadcn/ui component library (class-variance-authority + tailwind-merge)
- Fonts: Geist Sans and Geist Mono (loaded via `next/font/google`)
- Color scheme: blue primary, violet for AI features, consistent badge colors per status

### Tech Stack
| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.2.2 |
| Language | TypeScript | 5.x |
| React | React | 19.2.4 |
| Database | SQLite via better-sqlite3 | -- |
| ORM | Prisma | 7.6.0 |
| Styling | Tailwind CSS | 4.x |
| UI Components | shadcn/ui | -- |
| Icons | Lucide React | 1.7.0 |
| Date Handling | date-fns | 4.x |
| AI SDK | @anthropic-ai/sdk | 0.81.0 |

## Key Files to Understand

### `/src/lib/mock-data.ts`
The original data layer. Contains:
- All TypeScript type definitions (User, Project, Task, Phase, Milestone, TaskStep, LeaveRequest, CaptureSession, ReviewTask, OutcomeType, etc.)
- Sample data arrays (PROJECTS, USERS, LEAVE_REQUESTS, CAPTURE_SESSIONS, etc.)
- Helper functions (getUser, getPendingReviews, getLeavesByUser, etc.)
- These types informed the Prisma schema but are not identical to it -- the mock types are richer and include fields not yet in the database

### `/src/lib/phases.ts`
- Defines ENGINEERING_PHASES and RESEARCH_PHASES as arrays of `{ name, checklist }` objects
- Used by the POST `/api/projects` route to auto-create phase records when a project is created

### `/src/lib/ai-capture-parser.ts`
- Mock AI parser that classifies unstructured text into structured items
- Uses keyword matching to determine type (todo, follow_up, commitment, meeting, etc.)
- Replace with real Anthropic Claude API calls in production

### `/src/lib/prisma.ts`
- Prisma client singleton for use in API routes
- Import as `import { prisma } from "@/lib/prisma"`

### `/src/app/api/projects/route.ts`
- Reference implementation for how API routes work
- GET returns all projects with nested relations (assignees, phases, submissions, checkpoints)
- POST creates a project with auto-generated phases based on project type

## API Routes Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/projects` | List all projects with relations |
| POST | `/api/projects` | Create project with auto-generated phases |
| GET/PATCH/DELETE | `/api/projects/[id]` | Single project operations |
| POST | `/api/submissions` | Submit a deliverable for a phase |
| POST | `/api/feedback` | Add feedback to a submission |
| PATCH | `/api/phases` | Update phase status/checklist |
| POST | `/api/checkpoints` | Record a continue/kill decision |
| GET | `/api/users` | List all users |
| POST | `/api/ai/generate-plan` | AI-generated project plan |
| POST | `/api/ai/review` | AI review of a submission |
| POST | `/api/ai/suggest-stack` | AI tech stack recommendation |

## How to Add Backend Support for Remaining Features

### Step 1: Database Setup
The Prisma schema and migrations already exist. To initialize:
```bash
npx prisma migrate dev
npx prisma generate
npm run seed        # Seeds database with sample data
```

### Step 2: Replace Mock Data Imports
For each page still using mock data, replace:
```typescript
// Before (mock)
import { PROJECTS } from "@/lib/mock-data";
const projects = PROJECTS;

// After (API)
const res = await fetch("/api/projects");
const projects = await res.json();
```

### Step 3: Extend the Prisma Schema
Features in mock-data.ts that are not yet in the database:
- LeaveRequest / leave management
- CaptureSession / AI capture inbox items
- Calendar events
- Review queue / ReviewTask
- Task-level tracking (TaskStep, TaskUpdate)

Add these as new models in `prisma/schema.prisma`, then:
```bash
npx prisma migrate dev --name add_leave_requests
npx prisma generate
```

### Step 4: Real AI Integration
Replace the keyword parser in `ai-capture-parser.ts` with:
```typescript
import Anthropic from "@anthropic-ai/sdk";
const client = new Anthropic();
// Use Claude to parse unstructured text into structured items
```

The AI API routes (`/api/ai/*`) already import the Anthropic SDK. Check their implementations and ensure the ANTHROPIC_API_KEY environment variable is set.

## Common Tasks

### Adding a new page
1. Create `/src/app/your-route/page.tsx`
2. Add `"use client"` directive if it needs interactivity
3. Import types from mock-data or fetch from API
4. Add nav item in `/src/components/sidebar.tsx`

### Adding a new data type
1. Add the Prisma model in `prisma/schema.prisma`
2. Run `npx prisma migrate dev --name add_your_model`
3. Run `npx prisma generate`
4. Create an API route at `/src/app/api/your-model/route.ts`
5. Wire up the frontend component

### Adding a shadcn/ui component
```bash
npx shadcn@latest add <component-name>
```
Components are installed into `/src/components/ui/`.

### Running the seed script
```bash
npm run seed
# or directly:
npx tsx prisma/seed.mts
```

## Environment Variables
Create a `.env` file in the project root:
```env
DATABASE_URL="file:./dev.db"   # SQLite database path (used by Prisma)
ANTHROPIC_API_KEY=             # For AI features (plan generation, reviews, stack suggestions)
NEXT_PUBLIC_APP_URL=           # App URL (optional, for production)
```

## Scripts
| Command | Description |
|---------|-------------|
| `npm run dev` | Start dev server (http://localhost:3000) |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run seed` | Seed the database with sample data |
