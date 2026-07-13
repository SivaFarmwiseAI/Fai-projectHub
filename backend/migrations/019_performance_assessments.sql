-- ============================================================
-- Migration 019: Performance Assessment (360°) module.
--
-- review_cycles           — HR-managed review windows (draft/open/closed).
-- performance_assessments — one row per assessment:
--   kind = 'self'    : the employee's own submission (scores + full form
--                      snapshot in `data`).
--   kind = 'peer'    : a nominated colleague's review. Created as a
--                      pending stub when the self-assessment nominates
--                      reviewers; filled in via PATCH. `data` holds
--                      {answers: {<question_key>: text}, overall: 1..5}
--                      (see PEER_QUESTIONS in src/lib/performance.ts).
--   kind = 'manager' : the reporting manager's authoritative review,
--                      same data shape as peer.
--
-- Idempotent — safe to re-run.
-- ============================================================

CREATE TABLE IF NOT EXISTS review_cycles (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'draft',   -- draft | open | closed
  start_date  DATE,
  end_date    DATE,
  created_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS performance_assessments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Who the assessment is ABOUT (name snapshot survives user deletion)
  employee_name     TEXT        NOT NULL,
  employee_user_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  subject_user_id   UUID        REFERENCES users(id) ON DELETE CASCADE,
  -- Who WRITES it (peer/manager reviews; NULL for self)
  author_user_id    UUID        REFERENCES users(id) ON DELETE CASCADE,
  nominated_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  designation       TEXT,
  review_period     TEXT,
  career_level      TEXT        NOT NULL DEFAULT 'mid',   -- junior | mid | senior
  filled_by         TEXT        NOT NULL DEFAULT 'self',  -- self | rev
  kind              TEXT        NOT NULL DEFAULT 'self',  -- self | peer | manager
  status            TEXT        NOT NULL DEFAULT 'submitted', -- pending | submitted
  cycle_id          UUID        REFERENCES review_cycles(id) ON DELETE SET NULL,
  reviewer_name     TEXT,
  reviewer_user_id  UUID,
  role_areas        TEXT[]      NOT NULL DEFAULT '{}',
  individual_score  NUMERIC(5,2),
  team_score        NUMERIC(5,2),
  org_score         NUMERIC(5,2),
  culture_score     NUMERIC(5,2),
  total_score       NUMERIC(5,2),
  rating_band       TEXT,
  severity          TEXT        NOT NULL DEFAULT 'none',  -- none | concern | serious
  capped            BOOLEAN     NOT NULL DEFAULT FALSE,
  data              JSONB       NOT NULL DEFAULT '{}',
  submitted_by      UUID        REFERENCES users(id) ON DELETE SET NULL,
  submitted_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pa_subject  ON performance_assessments(subject_user_id, kind, cycle_id);
CREATE INDEX IF NOT EXISTS idx_pa_author   ON performance_assessments(author_user_id, kind, status);
CREATE INDEX IF NOT EXISTS idx_pa_cycle    ON performance_assessments(cycle_id);
CREATE INDEX IF NOT EXISTS idx_pa_created  ON performance_assessments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_cycles_status ON review_cycles(status);
