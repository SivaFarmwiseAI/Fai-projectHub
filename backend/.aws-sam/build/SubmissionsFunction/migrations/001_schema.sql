-- ============================================================
-- ProjectHub PostgreSQL Schema
-- Version: 1.0.0  |  Production
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role_type AS ENUM ('CEO', 'Team Lead', 'Member', 'Admin');
CREATE TYPE project_status   AS ENUM ('active', 'completed', 'killed', 'paused');
CREATE TYPE project_priority AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE project_type     AS ENUM (
  'engineering','data_science','design','sales','marketing',
  'operations','hr','legal','strategy','research','product','finance','mixed'
);
CREATE TYPE phase_status     AS ENUM ('pending','active','in_discussion','completed');
CREATE TYPE task_status      AS ENUM ('planning','in_progress','completed','blocked','killed','redefined');
CREATE TYPE task_priority    AS ENUM ('low','medium','high');
CREATE TYPE step_category    AS ENUM (
  'design','development','review','testing','deployment',
  'documentation','research','integration'
);
CREATE TYPE step_status      AS ENUM ('pending','in_progress','completed','blocked','skipped');
CREATE TYPE milestone_status AS ENUM ('pending','in_progress','completed','blocked');
CREATE TYPE deliverable_type AS ENUM ('code','document','ppt','text','meeting_notes','data');
CREATE TYPE deliverable_status AS ENUM ('pending','submitted','verified','rejected');
CREATE TYPE outcome_type     AS ENUM ('information','decision','document','code','design','data');
CREATE TYPE delay_reason     AS ENUM (
  'personal','other_commitments','task_complexity',
  'dependency_blocked','scope_change','technical_challenge'
);
CREATE TYPE extension_status AS ENUM ('pending','approved','rejected','auto_escalated');
CREATE TYPE submission_type  AS ENUM ('document','code','architecture','notebook','demo','data','design');
CREATE TYPE submission_status AS ENUM ('submitted','reviewed','approved','needs_revision');
CREATE TYPE checkpoint_decision AS ENUM ('continue','kill','pause','pivot','at_risk');
CREATE TYPE leave_type       AS ENUM ('planned','sick','personal','wfh','half_day');
CREATE TYPE leave_status     AS ENUM ('pending','approved','rejected');
CREATE TYPE capture_item_type AS ENUM (
  'todo','follow_up','commitment','meeting','review_reminder','timeline'
);
CREATE TYPE capture_status   AS ENUM ('pending','converted','dismissed');
CREATE TYPE review_task_status AS ENUM ('pending','in_progress','completed','rejected');
CREATE TYPE ai_insight_type  AS ENUM ('risk','opportunity','blocker','performance','suggestion');
CREATE TYPE ai_severity      AS ENUM ('low','medium','high','critical');
CREATE TYPE ai_insight_status AS ENUM ('active','resolved','dismissed');
CREATE TYPE doc_type         AS ENUM (
  'requirement','design','technical_roadmap','architecture',
  'api_spec','meeting_notes','research','test_plan',
  'deployment','user_guide','custom'
);
CREATE TYPE doc_status       AS ENUM ('draft','in_review','approved','active','archived');
CREATE TYPE standup_mood     AS ENUM ('1','2','3','4','5');
CREATE TYPE plan_status      AS ENUM ('ai_generated','being_refined','finalized');
CREATE TYPE outcome_delivery_status AS ENUM (
  'not_started','in_progress','draft_submitted','review','finalized','delivered'
);

-- ============================================================
-- USERS
-- ============================================================

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255)      NOT NULL,
  email         VARCHAR(255)      UNIQUE NOT NULL,
  password_hash TEXT              NOT NULL,
  role          VARCHAR(100)      NOT NULL,           -- free-text job title
  role_type     user_role_type    NOT NULL DEFAULT 'Member',
  department    VARCHAR(100)      NOT NULL DEFAULT 'General',
  avatar_color  VARCHAR(20)       NOT NULL DEFAULT '#3b82f6',
  avatar_url    TEXT,
  is_active     BOOLEAN           NOT NULL DEFAULT TRUE,
  metadata      JSONB             NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SESSIONS (JWT blacklist / refresh tokens)
-- ============================================================

CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  VARCHAR(64)  UNIQUE NOT NULL,   -- SHA-256 of the JWT jti
  expires_at  TIMESTAMPTZ  NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROJECTS
-- ============================================================

CREATE TABLE projects (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                VARCHAR(500)     NOT NULL,
  type                 project_type     NOT NULL,
  requirement          TEXT             NOT NULL,
  objective            TEXT,
  outcome_type         VARCHAR(50),
  outcome_description  TEXT,
  status               project_status   NOT NULL DEFAULT 'active',
  priority             project_priority NOT NULL DEFAULT 'medium',
  owner_id             UUID             NOT NULL REFERENCES users(id),
  current_phase        VARCHAR(255)     DEFAULT '',
  current_phase_index  INTEGER          DEFAULT 0,
  timebox_days         INTEGER          DEFAULT 14,
  start_date           DATE,
  end_date             DATE,
  tech_stack           JSONB            NOT NULL DEFAULT '[]',
  ai_plan              JSONB            NOT NULL DEFAULT '{}',
  metadata             JSONB            NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

CREATE TABLE project_co_owners (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE project_assignees (
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  PRIMARY KEY (project_id, user_id)
);

-- ============================================================
-- PHASES
-- ============================================================

CREATE TABLE phases (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_name        VARCHAR(255) NOT NULL,
  description       TEXT,
  status            phase_status NOT NULL DEFAULT 'pending',
  checklist         JSONB        NOT NULL DEFAULT '[]',
  order_index       INTEGER      NOT NULL DEFAULT 0,
  sign_off_required BOOLEAN      NOT NULL DEFAULT FALSE,
  signed_off_by     JSONB        NOT NULL DEFAULT '[]',
  estimated_duration VARCHAR(50),
  start_date        DATE,
  end_date          DATE,
  started_at        TIMESTAMPTZ,
  completed_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Phase discussions
CREATE TABLE phase_discussions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id     UUID        NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id),
  message      TEXT        NOT NULL,
  type         VARCHAR(30) NOT NULL DEFAULT 'question',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Phase attachments
CREATE TABLE phase_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id     UUID        NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  title        VARCHAR(500) NOT NULL,
  type         VARCHAR(30)  NOT NULL DEFAULT 'document',
  uploaded_by  UUID        REFERENCES users(id),
  url          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TASKS
-- ============================================================

CREATE TABLE tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  phase_id              UUID         REFERENCES phases(id) ON DELETE SET NULL,
  title                 VARCHAR(500) NOT NULL,
  description           TEXT,
  assignee_id           UUID         REFERENCES users(id),
  reviewer_id           UUID         REFERENCES users(id),
  approach              TEXT,
  plan_status           plan_status  NOT NULL DEFAULT 'ai_generated',
  plan_refined_by       UUID         REFERENCES users(id),
  plan_refined_at       TIMESTAMPTZ,
  ai_generated_plan     JSONB,
  success_criteria      JSONB        NOT NULL DEFAULT '[]',
  kill_criteria         JSONB        NOT NULL DEFAULT '[]',
  status                task_status  NOT NULL DEFAULT 'planning',
  priority              task_priority NOT NULL DEFAULT 'medium',
  estimated_hours       DECIMAL(8,2),
  revised_estimate_hours DECIMAL(8,2),
  actual_hours          DECIMAL(8,2),
  review_status         VARCHAR(30),
  reviewed_by           UUID         REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ,
  review_feedback       TEXT,
  order_index           INTEGER      NOT NULL DEFAULT 0,
  created_by            UUID         REFERENCES users(id),
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Task steps (sub-steps)
CREATE TABLE task_steps (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  description      TEXT         NOT NULL,
  expected_outcome TEXT,
  category         step_category,
  status           step_status  NOT NULL DEFAULT 'pending',
  order_index      INTEGER      NOT NULL DEFAULT 0,
  estimated_hours  DECIMAL(8,2),
  actual_hours     DECIMAL(8,2),
  assignee_id      UUID         REFERENCES users(id),
  reviewer_id      UUID         REFERENCES users(id),
  review_status    VARCHAR(30),
  dependencies     JSONB        NOT NULL DEFAULT '[]',
  notes            TEXT,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Task updates (progress logs)
CREATE TABLE task_updates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id          UUID         NOT NULL REFERENCES users(id),
  message          TEXT         NOT NULL,
  revised_estimate DECIMAL(8,2),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Task milestones
CREATE TABLE task_milestones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id          UUID             NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title            VARCHAR(500)     NOT NULL,
  description      TEXT,
  deliverable_type deliverable_type,
  success_criteria JSONB            NOT NULL DEFAULT '[]',
  status           milestone_status NOT NULL DEFAULT 'pending',
  assignee_id      UUID             REFERENCES users(id),
  target_day       INTEGER,
  outcome          VARCHAR(20),
  outcome_notes    TEXT,
  completed_at     TIMESTAMPTZ,
  order_index      INTEGER          NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- Milestone updates
CREATE TABLE milestone_updates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID        NOT NULL REFERENCES task_milestones(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES users(id),
  message      TEXT        NOT NULL,
  revised_estimate DECIMAL(8,2),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Deliverables
CREATE TABLE deliverables (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id    UUID               REFERENCES task_milestones(id) ON DELETE CASCADE,
  task_id         UUID               REFERENCES tasks(id) ON DELETE CASCADE,
  type            deliverable_type   NOT NULL DEFAULT 'document',
  title           VARCHAR(500)       NOT NULL,
  description     TEXT,
  status          deliverable_status NOT NULL DEFAULT 'pending',
  code_repo_url   TEXT,
  code_pr_url     TEXT,
  code_branch     TEXT,
  document_url    TEXT,
  file_type       VARCHAR(50),
  text_content    TEXT,
  attendees       JSONB              NOT NULL DEFAULT '[]',
  decisions       JSONB              NOT NULL DEFAULT '[]',
  action_items    JSONB              NOT NULL DEFAULT '[]',
  links           JSONB              NOT NULL DEFAULT '[]',
  submitted_by    UUID               REFERENCES users(id),
  submitted_at    TIMESTAMPTZ,
  verified_by     UUID               REFERENCES users(id),
  verified_at     TIMESTAMPTZ,
  feedback        TEXT,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- Task outcomes
CREATE TABLE task_outcomes (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id             UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  type                outcome_type,
  expected_deliverable TEXT,
  status              VARCHAR(30)  NOT NULL DEFAULT 'pending',
  text_content        TEXT,
  document_title      TEXT,
  document_url        TEXT,
  code_repo_url       TEXT,
  code_pr_url         TEXT,
  code_branch         TEXT,
  links               JSONB        NOT NULL DEFAULT '[]',
  submitted_by        UUID         REFERENCES users(id),
  submitted_at        TIMESTAMPTZ,
  verified_by         UUID         REFERENCES users(id),
  verified_at         TIMESTAMPTZ,
  feedback            TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Deadline extensions
CREATE TABLE deadline_extensions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID             NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  task_id           UUID             REFERENCES tasks(id) ON DELETE CASCADE,
  milestone_id      UUID             REFERENCES task_milestones(id) ON DELETE CASCADE,
  requested_by      UUID             NOT NULL REFERENCES users(id),
  approved_by       UUID             REFERENCES users(id),
  original_deadline TIMESTAMPTZ,
  requested_deadline TIMESTAMPTZ     NOT NULL,
  reason            delay_reason     NOT NULL,
  reason_detail     TEXT             NOT NULL,
  impact            TEXT,
  status            extension_status NOT NULL DEFAULT 'pending',
  ceo_comment       TEXT,
  escalation_level  INTEGER          NOT NULL DEFAULT 0,
  action_taken      VARCHAR(30),
  approved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUBMISSIONS & FEEDBACK
-- ============================================================

CREATE TABLE submissions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id     UUID              REFERENCES phases(id)   ON DELETE CASCADE,
  project_id   UUID              NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      UUID              NOT NULL REFERENCES users(id),
  title        VARCHAR(500)      NOT NULL,
  type         submission_type,
  description  TEXT,
  link         TEXT,
  status       submission_status NOT NULL DEFAULT 'submitted',
  reviewed_by  UUID              REFERENCES users(id),
  reviewed_at  TIMESTAMPTZ,
  is_key_milestone BOOLEAN       NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE TABLE feedback (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID        NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  from_user_id  UUID        REFERENCES users(id),
  text          TEXT        NOT NULL,
  is_ai         BOOLEAN     NOT NULL DEFAULT FALSE,
  action_items  JSONB       NOT NULL DEFAULT '[]',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CHECKPOINTS
-- ============================================================

CREATE TABLE checkpoints (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID                NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  decision    checkpoint_decision NOT NULL,
  notes       TEXT,
  ai_insights TEXT,
  action_items JSONB              NOT NULL DEFAULT '[]',
  decided_by  UUID                REFERENCES users(id),
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROJECT UPDATES
-- ============================================================

CREATE TABLE project_updates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID         NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id      UUID         NOT NULL REFERENCES users(id),
  type         VARCHAR(50)  NOT NULL DEFAULT 'status_update',
  title        VARCHAR(500) NOT NULL,
  description  TEXT,
  link         TEXT,
  attachments  JSONB        NOT NULL DEFAULT '[]',
  what_was_done TEXT,
  blockers     TEXT,
  next_steps   TEXT,
  attendees    JSONB        NOT NULL DEFAULT '[]',
  decisions    JSONB        NOT NULL DEFAULT '[]',
  action_items JSONB        NOT NULL DEFAULT '[]',
  reviewed     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- LEAVE MANAGEMENT
-- ============================================================

CREATE TABLE leave_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID         NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type              leave_type   NOT NULL,
  start_date        DATE         NOT NULL,
  end_date          DATE         NOT NULL,
  days              DECIMAL(4,1) NOT NULL DEFAULT 1,
  reason            TEXT,
  status            leave_status NOT NULL DEFAULT 'pending',
  approved_by       UUID         REFERENCES users(id),
  approved_at       TIMESTAMPTZ,
  cover_person_id   UUID         REFERENCES users(id),
  coverage_plan     TEXT,
  contingency_note  TEXT,
  is_planned        BOOLEAN      NOT NULL DEFAULT TRUE,
  impact_assessment JSONB        NOT NULL DEFAULT '[]',
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE team_availability (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date             DATE        NOT NULL,
  status           VARCHAR(20) NOT NULL DEFAULT 'available',
  leave_request_id UUID        REFERENCES leave_requests(id) ON DELETE SET NULL,
  UNIQUE (user_id, date)
);

-- ============================================================
-- AI CAPTURE
-- ============================================================

CREATE TABLE capture_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  raw_text   TEXT        NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE capture_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id            UUID             REFERENCES capture_sessions(id) ON DELETE CASCADE,
  user_id               UUID             NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                  capture_item_type NOT NULL,
  title                 VARCHAR(500)     NOT NULL,
  description           TEXT,
  assignee_id           UUID             REFERENCES users(id),
  due_date              DATE,
  priority              task_priority    NOT NULL DEFAULT 'medium',
  status                capture_status   NOT NULL DEFAULT 'pending',
  tags                  JSONB            NOT NULL DEFAULT '[]',
  converted_to_task_id  UUID             REFERENCES tasks(id),
  converted_to_review_id UUID,
  created_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- ============================================================
-- REVIEW TASKS
-- ============================================================

CREATE TABLE review_tasks (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(500)       NOT NULL,
  description   TEXT,
  type          VARCHAR(50)        NOT NULL,
  assignee_id   UUID               REFERENCES users(id),
  requester_id  UUID               REFERENCES users(id),
  project_id    UUID               REFERENCES projects(id) ON DELETE CASCADE,
  task_id       UUID               REFERENCES tasks(id)    ON DELETE CASCADE,
  submission_id UUID               REFERENCES submissions(id) ON DELETE CASCADE,
  priority      task_priority      NOT NULL DEFAULT 'medium',
  status        review_task_status NOT NULL DEFAULT 'pending',
  due_date      DATE,
  feedback_text TEXT,
  created_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DISCUSSIONS
-- ============================================================

CREATE TABLE discussions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        REFERENCES projects(id) ON DELETE CASCADE,
  phase_id    UUID        REFERENCES phases(id)   ON DELETE SET NULL,
  title       VARCHAR(500) NOT NULL,
  author_id   UUID        NOT NULL REFERENCES users(id),
  is_resolved BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE discussion_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discussion_id  UUID        NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  author_id      UUID        NOT NULL REFERENCES users(id),
  content        TEXT        NOT NULL,
  parent_id      UUID        REFERENCES discussion_messages(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PROJECT DOCUMENTS
-- ============================================================

CREATE TABLE project_documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID        NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  type            doc_type    NOT NULL DEFAULT 'custom',
  title           VARCHAR(500) NOT NULL,
  description     TEXT,
  current_version INTEGER     NOT NULL DEFAULT 1,
  status          doc_status  NOT NULL DEFAULT 'draft',
  sections        JSONB       NOT NULL DEFAULT '[]',
  changes         JSONB       NOT NULL DEFAULT '[]',
  discussions     JSONB       NOT NULL DEFAULT '[]',
  tags            JSONB       NOT NULL DEFAULT '[]',
  linked_doc_ids  JSONB       NOT NULL DEFAULT '[]',
  created_by      UUID        REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AI INSIGHTS
-- ============================================================

CREATE TABLE ai_insights (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID            REFERENCES projects(id) ON DELETE CASCADE,
  user_id           UUID            REFERENCES users(id),
  type              ai_insight_type NOT NULL DEFAULT 'risk',
  severity          ai_severity     NOT NULL DEFAULT 'medium',
  title             VARCHAR(500)    NOT NULL,
  description       TEXT,
  action_items      JSONB           NOT NULL DEFAULT '[]',
  status            ai_insight_status NOT NULL DEFAULT 'active',
  created_at        TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- ============================================================
-- STANDUP ENTRIES
-- ============================================================

CREATE TABLE standup_entries (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       DATE        NOT NULL DEFAULT CURRENT_DATE,
  yesterday  TEXT,
  today      TEXT,
  blockers   TEXT,
  mood       INTEGER     CHECK (mood BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, date)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type                VARCHAR(50) NOT NULL,
  title               VARCHAR(500) NOT NULL,
  message             TEXT,
  is_read             BOOLEAN     NOT NULL DEFAULT FALSE,
  related_entity_type VARCHAR(50),
  related_entity_id   UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG
-- ============================================================

CREATE TABLE audit_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   UUID,
  old_values  JSONB,
  new_values  JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_phases_updated_at
  BEFORE UPDATE ON phases
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_submissions_updated_at
  BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_leave_updated_at
  BEFORE UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_capture_updated_at
  BEFORE UPDATE ON capture_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_review_tasks_updated_at
  BEFORE UPDATE ON review_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_discussions_updated_at
  BEFORE UPDATE ON discussions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_project_documents_updated_at
  BEFORE UPDATE ON project_documents
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
