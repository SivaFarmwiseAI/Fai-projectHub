# ProjectHub — Python Backend

Production backend: **FastAPI + PostgreSQL + AWS Lambda**.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Python 3.12 |
| Framework | FastAPI 0.115 |
| Lambda adapter | Mangum 0.19 |
| Database | PostgreSQL 16 (RDS / Aurora Serverless v2) |
| ORM | Raw psycopg2 (no ORM overhead) |
| Auth | JWT (python-jose) + bcrypt |
| AI | Anthropic Claude API |
| Deploy | AWS SAM (Lambda + API Gateway) |

---

## Local Development

### 1. Prerequisites

- Python 3.12+
- PostgreSQL 16 running locally
- (Optional) Anthropic API key for AI features

### 2. Install

```bash
cd backend
pip install -r requirements.txt
```

### 3. Configure

```bash
cp .env.example .env
# Edit .env — set DATABASE_URL, JWT_SECRET, ANTHROPIC_API_KEY
```

### 4. Create database & run migrations

```bash
make db-create        # creates projecthub DB
make migrate          # applies schema + indexes
make seed             # inserts seed data
```

Or step by step:
```bash
psql -U postgres -c "CREATE DATABASE projecthub;"
psql postgresql://postgres:postgres@localhost:5432/projecthub -f migrations/001_schema.sql
psql postgresql://postgres:postgres@localhost:5432/projecthub -f migrations/002_indexes.sql
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/projecthub python seed/seed.py
```

### 5. Run locally

```bash
make dev
# API available at http://localhost:8000
# Swagger docs at http://localhost:8000/docs
```

---

## Seed Data / Test Users

| Name | Email | Password | Role |
|------|-------|----------|------|
| Rahul | rahul@company.dev | farmwise2024 | CEO |
| Arjun | arjun@company.dev | lead2024 | Team Lead |
| Priya | priya@company.dev | member2024 | Member |
| Meera | meera@company.dev | member2024 | Member |
| Vikram | vikram@company.dev | member2024 | Member |
| Sneha | sneha@company.dev | member2024 | Member |
| Karthik | karthik@company.dev | lead2024 | Team Lead |
| Ananya | ananya@company.dev | member2024 | Member |
| Admin | admin@farmwise.ai | admin2024 | Admin |

---

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login → sets JWT cookie |
| GET | /api/auth/me | Get current user |
| POST | /api/auth/logout | Clear session |
| POST | /api/auth/register | Create user (admin) |

### Projects
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/projects | List all projects |
| POST | /api/projects | Create project (auto-generates phases) |
| GET | /api/projects/:id | Get project with phases/tasks |
| PATCH | /api/projects/:id | Update project |
| DELETE | /api/projects/:id | Delete project |
| GET | /api/projects/:id/tasks | Project tasks |
| GET | /api/projects/:id/updates | Project updates |
| GET | /api/projects/timeline/all | Gantt timeline data |

### Tasks
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/tasks | List tasks (filterable) |
| POST | /api/tasks | Create task |
| GET | /api/tasks/:id | Get task with steps/milestones |
| PATCH | /api/tasks/:id | Update task |
| POST | /api/tasks/:id/steps | Add task step |
| PATCH | /api/tasks/:id/steps/:step_id | Update step |
| POST | /api/tasks/:id/updates | Log progress update |
| POST | /api/tasks/:id/milestones | Add milestone |
| POST | /api/tasks/deadline-extensions | Request deadline extension |
| PATCH | /api/tasks/deadline-extensions/:id | Approve/reject extension |

### Full endpoint list: http://localhost:8000/docs

---

## Frontend Integration

The Next.js frontend uses:
1. **`src/lib/api-client.ts`** — typed API client calling the Python backend
2. **`src/app/api/[[...path]]/route.ts`** — catch-all proxy (forwards requests to Python backend)

### Connecting frontend to backend

```bash
# In projecthub/.env
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Removing old mock data

Once the backend is running, components should import from `@/lib/api-client` instead of `@/lib/mock-data`:

```typescript
// Before (mock data)
import { PROJECTS, USERS } from "@/lib/mock-data";

// After (real backend)
import { projects, users } from "@/lib/api-client";

// In component:
const { projects: projectList } = await projects.list({ status: "active" });
```

---

## Production Deployment (AWS Lambda)

### Prerequisites
- AWS CLI configured
- AWS SAM CLI installed
- RDS PostgreSQL / Aurora Serverless provisioned in VPC

### Deploy

```bash
# 1. Run migrations against RDS
psql $PRODUCTION_DB_URL -f migrations/001_schema.sql
psql $PRODUCTION_DB_URL -f migrations/002_indexes.sql
DATABASE_URL=$PRODUCTION_DB_URL python seed/seed.py

# 2. Deploy Lambda
sam deploy \
  --template-file template.yaml \
  --stack-name projecthub-production \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    Environment=production \
    DatabaseUrl="postgresql://..." \
    JwtSecret="$(python -c 'import secrets; print(secrets.token_hex(32))')" \
    AnthropicApiKey="sk-ant-..." \
    CorsOrigins="https://projecthub.farmwise.ai"
```

### Production architecture

```
CloudFront → API Gateway → Lambda (FastAPI + Mangum)
                                      ↓
                               RDS Proxy → Aurora PostgreSQL
```

**Recommended RDS config:**
- Aurora Serverless v2 (auto-scales 0.5–8 ACU)
- RDS Proxy for connection pooling (Lambda has ephemeral connections)
- Multi-AZ for high availability
- Automated backups: 7 days

---

## Database Schema

Complete schema in `migrations/001_schema.sql`. Key tables:

| Table | Description |
|-------|-------------|
| `users` | Team members with roles and departments |
| `sessions` | JWT session tracking (server-side revocation) |
| `projects` | Projects with AI plan and tech stack |
| `project_assignees` | N:N project-user assignment |
| `phases` | Ordered project phases with checklists |
| `tasks` | Work items with success/kill criteria |
| `task_steps` | Sub-steps within tasks |
| `task_milestones` | Milestones with deliverables |
| `deliverables` | Actual deliverable artifacts |
| `deadline_extensions` | Extension requests with approval flow |
| `submissions` | Phase deliverable submissions |
| `feedback` | CEO/AI feedback on submissions |
| `checkpoints` | Kill/continue/pause decisions |
| `leave_requests` | Team leave with impact assessment |
| `team_availability` | Daily availability calendar |
| `capture_sessions` | AI capture raw text sessions |
| `capture_items` | Parsed action items from captures |
| `review_tasks` | Review queue items |
| `discussions` | Threaded project discussions |
| `standup_entries` | Daily standup log |
| `ai_insights` | AI-generated risks/opportunities |
| `notifications` | In-app notification inbox |
| `audit_logs` | Full audit trail |
