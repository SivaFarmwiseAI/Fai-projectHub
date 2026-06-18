-- Meetings & schedule requests
--
-- meetings:           first-class scheduled events (project or general).
-- schedule_requests:  approval queue. Every meeting/review/commitment/discussion/
--                     leave/follow_up creation inserts a pending row here so the
--                     CEO can accept (optionally with a new datetime) or reject.

-- ── Meetings ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meetings (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title            VARCHAR(500) NOT NULL,
  agenda           TEXT,
  scheduled_at     TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30 CHECK (duration_minutes > 0),
  location         TEXT,
  project_id       UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_by       UUID NOT NULL REFERENCES users(id),
  status           VARCHAR(40) NOT NULL DEFAULT 'scheduled',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meetings_scheduled_at ON meetings (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_meetings_project_id   ON meetings (project_id);
CREATE INDEX IF NOT EXISTS idx_meetings_created_by   ON meetings (created_by);

CREATE TABLE IF NOT EXISTS meeting_attendees (
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
  PRIMARY KEY (meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_meeting_attendees_user_id ON meeting_attendees (user_id);

-- ── Schedule requests ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS schedule_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type     VARCHAR(40) NOT NULL
    CHECK (entity_type IN ('meeting','review','commitment','discussion','leave','follow_up')),
  entity_id       UUID NOT NULL,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','accepted','rejected')),
  title           VARCHAR(500),
  description     TEXT,
  proposed_at     TIMESTAMPTZ,
  rescheduled_to  TIMESTAMPTZ,
  ceo_note        TEXT,
  project_id      UUID REFERENCES projects(id) ON DELETE SET NULL,
  requested_by    UUID NOT NULL REFERENCES users(id),
  decided_by      UUID REFERENCES users(id) ON DELETE SET NULL,
  decided_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_schedule_requests_status   ON schedule_requests (status);
CREATE INDEX IF NOT EXISTS idx_schedule_requests_entity   ON schedule_requests (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_schedule_requests_proposed ON schedule_requests (proposed_at);

-- Keep updated_at fresh.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_meetings_touch          ON meetings;
DROP TRIGGER IF EXISTS trg_schedule_requests_touch ON schedule_requests;

CREATE TRIGGER trg_meetings_touch
  BEFORE UPDATE ON meetings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

CREATE TRIGGER trg_schedule_requests_touch
  BEFORE UPDATE ON schedule_requests
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
