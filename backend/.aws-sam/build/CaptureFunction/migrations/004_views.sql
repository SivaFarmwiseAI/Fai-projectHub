-- ============================================================
-- ProjectHub — Materialized Views & Partial Indexes
-- Run after 003_functions.sql
-- Refresh: SELECT refresh_analytics_views();
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- MATERIALIZED VIEW: project summary cards
-- Refreshed: every 5 minutes via Lambda cron or pg_cron
-- ──────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_project_summary AS
SELECT
  p.id,
  p.title,
  p.type,
  p.status,
  p.priority,
  p.current_phase,
  p.timebox_days,
  p.start_date,
  p.end_date,
  p.tech_stack,
  p.owner_id,
  p.created_at,
  p.updated_at,
  -- owner
  owner.name          AS owner_name,
  owner.avatar_color  AS owner_color,
  -- assignees (JSON array)
  COALESCE(
    (SELECT json_agg(json_build_object(
      'id',           u.id,
      'name',         u.name,
      'avatar_color', u.avatar_color
    ) ORDER BY u.name)
    FROM project_assignees pa
    JOIN users u ON u.id = pa.user_id
    WHERE pa.project_id = p.id),
    '[]'::JSON
  ) AS assignees,
  -- counts
  (SELECT COUNT(*) FROM phases ph WHERE ph.project_id = p.id)                              AS phase_count,
  (SELECT COUNT(*) FROM phases ph WHERE ph.project_id = p.id AND ph.status = 'active')     AS active_phases,
  (SELECT COUNT(*) FROM tasks t  WHERE t.project_id  = p.id)                              AS task_count,
  (SELECT COUNT(*) FROM tasks t  WHERE t.project_id  = p.id AND t.status = 'completed')   AS completed_tasks,
  (SELECT COUNT(*) FROM tasks t  WHERE t.project_id  = p.id AND t.status = 'blocked')     AS blocked_tasks,
  (SELECT COUNT(*) FROM tasks t  WHERE t.project_id  = p.id AND t.status = 'in_progress') AS active_tasks,
  (SELECT COUNT(*) FROM submissions s WHERE s.project_id = p.id AND s.status = 'submitted') AS pending_submissions,
  -- completion %
  CASE
    WHEN (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) = 0 THEN 0
    ELSE ROUND(
      (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'completed') * 100.0
      / (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id),
      0
    )
  END AS completion_pct
FROM projects p
JOIN users owner ON owner.id = p.owner_id
WITH DATA;

-- Unique index required for REFRESH CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_project_summary_id ON mv_project_summary(id);
CREATE INDEX IF NOT EXISTS idx_mv_project_summary_status   ON mv_project_summary(status);
CREATE INDEX IF NOT EXISTS idx_mv_project_summary_priority ON mv_project_summary(priority);
CREATE INDEX IF NOT EXISTS idx_mv_project_summary_owner    ON mv_project_summary(owner_id);


-- ──────────────────────────────────────────────────────────
-- MATERIALIZED VIEW: team statistics
-- Refreshed: hourly
-- ──────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_team_stats AS
SELECT
  u.id,
  u.name,
  u.department,
  u.avatar_color,
  u.role,
  u.role_type,
  u.is_active,
  -- task counts
  COUNT(t.id) FILTER (WHERE t.status = 'in_progress')  AS active_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'completed')    AS completed_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'blocked')      AS blocked_tasks,
  COUNT(t.id) FILTER (WHERE t.status = 'planning')     AS planning_tasks,
  -- hours
  COALESCE(SUM(t.actual_hours) FILTER (WHERE t.status = 'completed'), 0) AS total_hours_logged,
  COALESCE(AVG(
    CASE WHEN t.estimated_hours > 0
      THEN t.actual_hours / t.estimated_hours
      ELSE NULL
    END
  ) FILTER (WHERE t.status = 'completed'), 1.0)::NUMERIC(5,2) AS avg_hours_ratio,
  -- projects
  COUNT(DISTINCT pa.project_id) AS project_count,
  COUNT(DISTINCT pa.project_id) FILTER (
    WHERE EXISTS (SELECT 1 FROM projects proj WHERE proj.id = pa.project_id AND proj.status = 'active')
  ) AS active_project_count,
  -- mood (14-day avg)
  COALESCE((
    SELECT AVG(se.mood)
    FROM standup_entries se
    WHERE se.user_id = u.id AND se.date >= CURRENT_DATE - 14
  ), 3.0)::NUMERIC(3,1) AS avg_mood,
  -- health score
  GREATEST(0, LEAST(100, ROUND(
    100.0
    - (COUNT(t.id) FILTER (WHERE t.status = 'blocked') * 15.0)
    - (COUNT(de.id) FILTER (WHERE de.escalation_level >= 2) * 10.0)
    + (COALESCE((SELECT AVG(se.mood) FROM standup_entries se WHERE se.user_id = u.id AND se.date >= CURRENT_DATE - 14), 3.0) - 3.0) * 5.0
  )::NUMERIC, 0))::INTEGER AS health_score
FROM users u
LEFT JOIN tasks t ON t.assignee_id = u.id
LEFT JOIN project_assignees pa ON pa.user_id = u.id
LEFT JOIN deadline_extensions de ON de.requested_by = u.id
WHERE u.is_active
GROUP BY u.id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_team_stats_id         ON mv_team_stats(id);
CREATE INDEX        IF NOT EXISTS idx_mv_team_stats_health      ON mv_team_stats(health_score);
CREATE INDEX        IF NOT EXISTS idx_mv_team_stats_department  ON mv_team_stats(department);


-- ──────────────────────────────────────────────────────────
-- MATERIALIZED VIEW: leave summary (FY)
-- ──────────────────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_leave_fy AS
WITH fy_start AS (
  SELECT
    CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
      THEN DATE_TRUNC('year', CURRENT_DATE)::DATE + INTERVAL '3 months'
      ELSE DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')::DATE + INTERVAL '3 months'
    END AS d
)
SELECT
  u.id AS user_id,
  COALESCE(SUM(lr.days), 0)                                               AS total_days,
  COALESCE(SUM(lr.days) FILTER (WHERE lr.type = 'planned'), 0)            AS planned_days,
  COALESCE(SUM(lr.days) FILTER (WHERE lr.type = 'sick'), 0)               AS sick_days,
  COALESCE(SUM(lr.days) FILTER (WHERE lr.type = 'personal'), 0)           AS personal_days,
  COALESCE(SUM(lr.days) FILTER (WHERE lr.type = 'wfh'), 0)                AS wfh_days,
  COALESCE(SUM(lr.days) FILTER (WHERE lr.type = 'half_day'), 0)           AS half_days,
  COALESCE(SUM(lr.days) FILTER (WHERE NOT lr.is_planned), 0)              AS unplanned_days
FROM users u
LEFT JOIN leave_requests lr ON lr.user_id = u.id
  AND lr.status = 'approved'
  AND lr.start_date >= (SELECT d FROM fy_start)
WHERE u.is_active
GROUP BY u.id
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_leave_fy_user ON mv_leave_fy(user_id);


-- ──────────────────────────────────────────────────────────
-- PARTIAL INDEXES — faster common WHERE clauses
-- ──────────────────────────────────────────────────────────

-- Active projects (most list queries filter by status = active)
CREATE INDEX IF NOT EXISTS idx_projects_active
  ON projects(priority, updated_at DESC)
  WHERE status = 'active';

-- Pending submissions (review queue)
CREATE INDEX IF NOT EXISTS idx_submissions_pending
  ON submissions(project_id, created_at)
  WHERE status = 'submitted';

-- Pending leave requests
CREATE INDEX IF NOT EXISTS idx_leave_pending
  ON leave_requests(start_date, user_id)
  WHERE status = 'pending';

-- Open review tasks
CREATE INDEX IF NOT EXISTS idx_reviews_open
  ON review_tasks(priority, due_date)
  WHERE status IN ('pending', 'in_progress');

-- Pending capture items
CREATE INDEX IF NOT EXISTS idx_capture_pending
  ON capture_items(user_id, created_at)
  WHERE status = 'pending';

-- Active AI insights
CREATE INDEX IF NOT EXISTS idx_insights_active_severity
  ON ai_insights(severity, created_at)
  WHERE status = 'active';

-- Pending deadline extensions
CREATE INDEX IF NOT EXISTS idx_extensions_pending
  ON deadline_extensions(escalation_level DESC, created_at)
  WHERE status = 'pending';

-- Standup entries by date (CURRENT_DATE is not IMMUTABLE, cannot be used in partial index predicates)
CREATE INDEX IF NOT EXISTS idx_standup_date_user
  ON standup_entries(date, user_id);


-- ──────────────────────────────────────────────────────────
-- REFRESH FUNCTION — call from a cron job or Lambda
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  t_start TIMESTAMPTZ := clock_timestamp();
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_project_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leave_fy;
  RETURN 'Refreshed in ' || EXTRACT(MILLISECONDS FROM clock_timestamp() - t_start)::TEXT || 'ms';
END;
$$;


-- ──────────────────────────────────────────────────────────
-- TABLE STATISTICS — help query planner
-- ──────────────────────────────────────────────────────────
ALTER TABLE projects        SET (autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE tasks           SET (autovacuum_analyze_scale_factor = 0.02);
ALTER TABLE submissions     SET (autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE leave_requests  SET (autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE capture_items   SET (autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE notifications   SET (autovacuum_vacuum_scale_factor  = 0.05);

-- Initial stats collection
ANALYZE projects, tasks, phases, users, submissions, leave_requests, capture_items, review_tasks;
