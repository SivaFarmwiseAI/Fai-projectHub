-- ============================================================
-- ProjectHub — File reference columns for project_documents
-- Lets uploaded CloudFront URLs be persisted and surfaced via
-- GET /api/projects/{id}/documents
-- ============================================================

ALTER TABLE project_documents
  ADD COLUMN IF NOT EXISTS file_url   TEXT,
  ADD COLUMN IF NOT EXISTS file_name  TEXT,
  ADD COLUMN IF NOT EXISTS mime_type  TEXT,
  ADD COLUMN IF NOT EXISTS file_size  BIGINT;

CREATE INDEX IF NOT EXISTS idx_project_documents_project_id
  ON project_documents(project_id);
