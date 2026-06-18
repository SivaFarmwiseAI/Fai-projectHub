-- Allow discussions to be scheduled for a future date/time so they surface on the CEO calendar.
ALTER TABLE discussions
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_discussions_scheduled_at
  ON discussions (scheduled_at)
  WHERE scheduled_at IS NOT NULL;
