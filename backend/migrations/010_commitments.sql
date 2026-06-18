-- Commitments: standalone work commitments with from/to date windows.
-- Surfaces on the CEO calendar across the window.
CREATE TABLE IF NOT EXISTS commitments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(500) NOT NULL,
  description TEXT,
  from_date   DATE NOT NULL,
  to_date     DATE NOT NULL,
  status      VARCHAR(40) NOT NULL DEFAULT 'pending',
  priority    VARCHAR(20) NOT NULL DEFAULT 'medium',
  owner_id    UUID NOT NULL REFERENCES users(id),
  assignee_id UUID REFERENCES users(id)    ON DELETE SET NULL,
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commitments_date_order CHECK (to_date >= from_date)
);

CREATE INDEX IF NOT EXISTS idx_commitments_owner_id    ON commitments (owner_id);
CREATE INDEX IF NOT EXISTS idx_commitments_assignee_id ON commitments (assignee_id);
CREATE INDEX IF NOT EXISTS idx_commitments_dates       ON commitments (from_date, to_date);
CREATE INDEX IF NOT EXISTS idx_commitments_status      ON commitments (status);
