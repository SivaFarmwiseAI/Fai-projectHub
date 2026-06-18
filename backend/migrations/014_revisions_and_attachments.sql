-- Revision history + attachments for phases and tasks
--
-- Captures every change (description edit, status change, manual revision note)
-- as a timeline entry with author + attachments. Staff can attach a URL, code
-- snippet, design doc, repo link, or Figma file at each revision or task closure.

-- ── Phase revisions ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS phase_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id        UUID         NOT NULL REFERENCES phases(id) ON DELETE CASCADE,
  author_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
  change_type     VARCHAR(40)  NOT NULL DEFAULT 'revision',
    -- 'revision' | 'status_change' | 'closure' | 'description_edit' | 'note'
  summary         VARCHAR(500) NOT NULL,
  details         TEXT,
  previous_value  TEXT,
  new_value       TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phase_revisions_phase_id   ON phase_revisions (phase_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_phase_revisions_author_id  ON phase_revisions (author_id);

CREATE TABLE IF NOT EXISTS phase_revision_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id  UUID         NOT NULL REFERENCES phase_revisions(id) ON DELETE CASCADE,
  title        VARCHAR(500) NOT NULL,
  type         VARCHAR(30)  NOT NULL DEFAULT 'url',
    -- 'url' | 'repo' | 'figma' | 'design' | 'document' | 'code'
  url          TEXT,
  content      TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phase_rev_atts_revision_id ON phase_revision_attachments (revision_id);

-- ── Task revisions ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS task_revisions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id       UUID         REFERENCES users(id) ON DELETE SET NULL,
  change_type     VARCHAR(40)  NOT NULL DEFAULT 'revision',
  summary         VARCHAR(500) NOT NULL,
  details         TEXT,
  previous_value  TEXT,
  new_value       TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_revisions_task_id    ON task_revisions (task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_revisions_author_id  ON task_revisions (author_id);

CREATE TABLE IF NOT EXISTS task_revision_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revision_id  UUID         NOT NULL REFERENCES task_revisions(id) ON DELETE CASCADE,
  title        VARCHAR(500) NOT NULL,
  type         VARCHAR(30)  NOT NULL DEFAULT 'url',
  url          TEXT,
  content      TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_rev_atts_revision_id ON task_revision_attachments (revision_id);

-- ── Task-level attachments (independent of a revision) ───────────────────────
-- Some closures attach a deliverable without a revision narrative; this gives
-- tasks the same lightweight attachment list that phases already have.
CREATE TABLE IF NOT EXISTS task_attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID         NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title        VARCHAR(500) NOT NULL,
  type         VARCHAR(30)  NOT NULL DEFAULT 'url',
  uploaded_by  UUID         REFERENCES users(id) ON DELETE SET NULL,
  url          TEXT,
  content      TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments (task_id, created_at DESC);
