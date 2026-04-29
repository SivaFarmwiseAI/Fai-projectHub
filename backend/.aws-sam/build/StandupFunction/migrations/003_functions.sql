-- ============================================================
-- ProjectHub — PostgreSQL Functions & Stored Procedures
-- Version: 1.0.0  |  Production
--
-- Strategy: each page/feature gets ONE function call that
-- returns a complete JSON document.  Python never assembles
-- data from multiple queries — all joining / aggregation
-- happens inside Postgres where it's fastest.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- UTILITY: safe JSON cast
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION safe_jsonb(v TEXT)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN v::JSONB;
EXCEPTION WHEN others THEN
  RETURN '[]'::JSONB;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- 1. fn_project_full — single project detail page
--    Replaces: ~8 separate queries in projects_router.py
--    Returns:  complete JSON for one project
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_project_full(p_project_id UUID)
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
SELECT json_build_object(
  'id',                  p.id,
  'title',               p.title,
  'type',                p.type,
  'requirement',         p.requirement,
  'objective',           p.objective,
  'outcome_type',        p.outcome_type,
  'outcome_description', p.outcome_description,
  'status',              p.status,
  'priority',            p.priority,
  'current_phase',       p.current_phase,
  'current_phase_index', p.current_phase_index,
  'timebox_days',        p.timebox_days,
  'start_date',          p.start_date,
  'end_date',            p.end_date,
  'tech_stack',          p.tech_stack,
  'ai_plan',             p.ai_plan,
  'created_at',          p.created_at,
  'updated_at',          p.updated_at,

  -- owner
  'owner', json_build_object(
    'id',           owner.id,
    'name',         owner.name,
    'email',        owner.email,
    'avatar_color', owner.avatar_color,
    'role',         owner.role,
    'department',   owner.department
  ),

  -- assignees
  'assignees', COALESCE((
    SELECT json_agg(json_build_object(
      'id',           u.id,
      'name',         u.name,
      'email',        u.email,
      'avatar_color', u.avatar_color,
      'role',         u.role,
      'department',   u.department
    ) ORDER BY u.name)
    FROM project_assignees pa
    JOIN users u ON u.id = pa.user_id
    WHERE pa.project_id = p.id
  ), '[]'::JSON),

  -- co-owners
  'co_owners', COALESCE((
    SELECT json_agg(json_build_object(
      'id',           u.id,
      'name',         u.name,
      'avatar_color', u.avatar_color
    ) ORDER BY u.name)
    FROM project_co_owners pco
    JOIN users u ON u.id = pco.user_id
    WHERE pco.project_id = p.id
  ), '[]'::JSON),

  -- phases (with submission count)
  'phases', COALESCE((
    SELECT json_agg(json_build_object(
      'id',                ph.id,
      'phase_name',        ph.phase_name,
      'description',       ph.description,
      'status',            ph.status,
      'checklist',         ph.checklist,
      'order_index',       ph.order_index,
      'sign_off_required', ph.sign_off_required,
      'signed_off_by',     ph.signed_off_by,
      'estimated_duration',ph.estimated_duration,
      'start_date',        ph.start_date,
      'end_date',          ph.end_date,
      'started_at',        ph.started_at,
      'completed_at',      ph.completed_at,
      'submission_count',  (SELECT COUNT(*) FROM submissions s WHERE s.phase_id = ph.id)
    ) ORDER BY ph.order_index)
    FROM phases ph WHERE ph.project_id = p.id
  ), '[]'::JSON),

  -- tasks (summary only — full task loads separately via fn_task_full)
  'tasks', COALESCE((
    SELECT json_agg(json_build_object(
      'id',            t.id,
      'title',         t.title,
      'status',        t.status,
      'priority',      t.priority,
      'assignee_id',   t.assignee_id,
      'assignee_name', u.name,
      'assignee_color',u.avatar_color,
      'phase_id',      t.phase_id,
      'estimated_hours',t.estimated_hours,
      'actual_hours',  t.actual_hours,
      'plan_status',   t.plan_status,
      'review_status', t.review_status,
      'order_index',   t.order_index,
      'step_count',    (SELECT COUNT(*) FROM task_steps ts WHERE ts.task_id = t.id),
      'milestone_count',(SELECT COUNT(*) FROM task_milestones tm WHERE tm.task_id = t.id),
      'completed_at',  t.completed_at
    ) ORDER BY t.order_index, t.created_at)
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = p.id
  ), '[]'::JSON),

  -- latest checkpoint
  'latest_checkpoint', (
    SELECT json_build_object(
      'id',         c.id,
      'decision',   c.decision,
      'notes',      c.notes,
      'created_at', c.created_at
    )
    FROM checkpoints c
    WHERE c.project_id = p.id
    ORDER BY c.created_at DESC
    LIMIT 1
  ),

  -- pending submissions count
  'pending_submissions', (
    SELECT COUNT(*) FROM submissions s
    WHERE s.project_id = p.id AND s.status = 'submitted'
  ),

  -- active AI insights
  'insights', COALESCE((
    SELECT json_agg(json_build_object(
      'id',          ai.id,
      'type',        ai.type,
      'severity',    ai.severity,
      'title',       ai.title,
      'description', ai.description,
      'action_items',ai.action_items
    ) ORDER BY
      CASE ai.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END)
    FROM ai_insights ai
    WHERE ai.project_id = p.id AND ai.status = 'active'
  ), '[]'::JSON)
)
FROM projects p
JOIN users owner ON owner.id = p.owner_id
WHERE p.id = p_project_id;
$$;


-- ──────────────────────────────────────────────────────────
-- 2. fn_projects_list — projects list page
--    Returns: paginated project cards with inline relations
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_projects_list(
  p_status      TEXT     DEFAULT NULL,
  p_type        TEXT     DEFAULT NULL,
  p_priority    TEXT     DEFAULT NULL,
  p_owner_id    UUID     DEFAULT NULL,
  p_assignee_id UUID     DEFAULT NULL,
  p_search      TEXT     DEFAULT NULL,
  p_limit       INTEGER  DEFAULT 50,
  p_offset      INTEGER  DEFAULT 0
)
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
WITH filtered AS (
  SELECT p.*
  FROM projects p
  WHERE
    (p_status      IS NULL OR p.status   = p_status::project_status)
    AND (p_type    IS NULL OR p.type     = p_type::project_type)
    AND (p_priority IS NULL OR p.priority = p_priority::project_priority)
    AND (p_owner_id IS NULL OR p.owner_id = p_owner_id)
    AND (p_search   IS NULL OR p.title ILIKE '%' || p_search || '%')
    AND (p_assignee_id IS NULL OR EXISTS (
          SELECT 1 FROM project_assignees pa
          WHERE pa.project_id = p.id AND pa.user_id = p_assignee_id
        ))
),
total_count AS (
  SELECT COUNT(*) AS total FROM filtered
),
paged AS (
  SELECT * FROM filtered
  ORDER BY
    CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
    CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
    updated_at DESC
  LIMIT p_limit OFFSET p_offset
)
SELECT json_build_object(
  'total',    (SELECT total FROM total_count),
  'projects', COALESCE(
    (SELECT json_agg(json_build_object(
      'id',                  p.id,
      'title',               p.title,
      'type',                p.type,
      'status',              p.status,
      'priority',            p.priority,
      'current_phase',       p.current_phase,
      'timebox_days',        p.timebox_days,
      'start_date',          p.start_date,
      'tech_stack',          p.tech_stack,
      'updated_at',          p.updated_at,
      'created_at',          p.created_at,
      'owner_id',            p.owner_id,
      'owner_name',          owner.name,
      'owner_avatar_color',  owner.avatar_color,

      'assignees', COALESCE((
        SELECT json_agg(json_build_object(
          'id',           u.id,
          'name',         u.name,
          'avatar_color', u.avatar_color
        ) ORDER BY u.name)
        FROM project_assignees pa
        JOIN users u ON u.id = pa.user_id
        WHERE pa.project_id = p.id
      ), '[]'::JSON),

      'phase_count',        (SELECT COUNT(*) FROM phases ph WHERE ph.project_id = p.id),
      'active_phase_count', (SELECT COUNT(*) FROM phases ph WHERE ph.project_id = p.id AND ph.status = 'active'),
      'task_count',         (SELECT COUNT(*) FROM tasks t  WHERE t.project_id = p.id),
      'completed_tasks',    (SELECT COUNT(*) FROM tasks t  WHERE t.project_id = p.id AND t.status = 'completed'),
      'blocked_tasks',      (SELECT COUNT(*) FROM tasks t  WHERE t.project_id = p.id AND t.status = 'blocked'),
      'pending_submissions',(SELECT COUNT(*) FROM submissions s WHERE s.project_id = p.id AND s.status = 'submitted')
    ))
    FROM paged p
    JOIN users owner ON owner.id = p.owner_id),
    '[]'::JSON
  )
);
$$;


-- ──────────────────────────────────────────────────────────
-- 3. fn_task_full — single task detail
--    Replaces: 5 sub-queries in tasks_router.py
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_task_full(p_task_id UUID)
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
SELECT json_build_object(
  'id',                    t.id,
  'project_id',            t.project_id,
  'project_title',         proj.title,
  'phase_id',              t.phase_id,
  'phase_name',            ph.phase_name,
  'title',                 t.title,
  'description',           t.description,
  'assignee_id',           t.assignee_id,
  'assignee_name',         assignee.name,
  'assignee_color',        assignee.avatar_color,
  'reviewer_id',           t.reviewer_id,
  'reviewer_name',         reviewer.name,
  'approach',              t.approach,
  'plan_status',           t.plan_status,
  'ai_generated_plan',     t.ai_generated_plan,
  'success_criteria',      t.success_criteria,
  'kill_criteria',         t.kill_criteria,
  'status',                t.status,
  'priority',              t.priority,
  'estimated_hours',       t.estimated_hours,
  'revised_estimate_hours',t.revised_estimate_hours,
  'actual_hours',          t.actual_hours,
  'review_status',         t.review_status,
  'review_feedback',       t.review_feedback,
  'order_index',           t.order_index,
  'created_at',            t.created_at,
  'completed_at',          t.completed_at,
  'updated_at',            t.updated_at,

  -- steps
  'steps', COALESCE((
    SELECT json_agg(json_build_object(
      'id',              ts.id,
      'description',     ts.description,
      'expected_outcome',ts.expected_outcome,
      'category',        ts.category,
      'status',          ts.status,
      'order_index',     ts.order_index,
      'estimated_hours', ts.estimated_hours,
      'actual_hours',    ts.actual_hours,
      'assignee_id',     ts.assignee_id,
      'assignee_name',   su.name,
      'review_status',   ts.review_status,
      'notes',           ts.notes,
      'completed_at',    ts.completed_at
    ) ORDER BY ts.order_index)
    FROM task_steps ts
    LEFT JOIN users su ON su.id = ts.assignee_id
    WHERE ts.task_id = t.id
  ), '[]'::JSON),

  -- updates
  'updates', COALESCE((
    SELECT json_agg(json_build_object(
      'id',               tu.id,
      'user_id',          tu.user_id,
      'user_name',        uu.name,
      'message',          tu.message,
      'revised_estimate', tu.revised_estimate,
      'created_at',       tu.created_at
    ) ORDER BY tu.created_at)
    FROM task_updates tu
    JOIN users uu ON uu.id = tu.user_id
    WHERE tu.task_id = t.id
  ), '[]'::JSON),

  -- milestones (with deliverables)
  'milestones', COALESCE((
    SELECT json_agg(json_build_object(
      'id',              tm.id,
      'title',           tm.title,
      'description',     tm.description,
      'deliverable_type',tm.deliverable_type,
      'success_criteria',tm.success_criteria,
      'status',          tm.status,
      'assignee_id',     tm.assignee_id,
      'target_day',      tm.target_day,
      'outcome',         tm.outcome,
      'outcome_notes',   tm.outcome_notes,
      'completed_at',    tm.completed_at,
      'deliverables', COALESCE((
        SELECT json_agg(json_build_object(
          'id',           d.id,
          'type',         d.type,
          'title',        d.title,
          'status',       d.status,
          'document_url', d.document_url,
          'code_pr_url',  d.code_pr_url,
          'submitted_by', d.submitted_by,
          'submitted_at', d.submitted_at,
          'feedback',     d.feedback
        ) ORDER BY d.created_at)
        FROM deliverables d WHERE d.milestone_id = tm.id
      ), '[]'::JSON),
      'updates', COALESCE((
        SELECT json_agg(json_build_object(
          'id','message', mu.message, 'created_at', mu.created_at
        ) ORDER BY mu.created_at)
        FROM milestone_updates mu WHERE mu.milestone_id = tm.id
      ), '[]'::JSON)
    ) ORDER BY tm.order_index)
    FROM task_milestones tm WHERE tm.task_id = t.id
  ), '[]'::JSON),

  -- deadline extensions
  'deadline_extensions', COALESCE((
    SELECT json_agg(json_build_object(
      'id',                 de.id,
      'original_deadline',  de.original_deadline,
      'requested_deadline', de.requested_deadline,
      'reason',             de.reason,
      'reason_detail',      de.reason_detail,
      'status',             de.status,
      'ceo_comment',        de.ceo_comment,
      'escalation_level',   de.escalation_level,
      'created_at',         de.created_at
    ) ORDER BY de.created_at)
    FROM deadline_extensions de WHERE de.task_id = t.id
  ), '[]'::JSON)
)
FROM tasks t
JOIN    projects proj ON proj.id = t.project_id
LEFT JOIN phases   ph  ON ph.id  = t.phase_id
LEFT JOIN users assignee ON assignee.id = t.assignee_id
LEFT JOIN users reviewer ON reviewer.id = t.reviewer_id
WHERE t.id = p_task_id;
$$;


-- ──────────────────────────────────────────────────────────
-- 4. fn_dashboard_stats — Command Center page
--    Single call replaces 10+ COUNT queries
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_dashboard_stats()
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
SELECT json_build_object(
  'active_projects',    (SELECT COUNT(*) FROM projects WHERE status = 'active'),
  'completed_projects', (SELECT COUNT(*) FROM projects WHERE status = 'completed'),
  'killed_projects',    (SELECT COUNT(*) FROM projects WHERE status = 'killed'),
  'paused_projects',    (SELECT COUNT(*) FROM projects WHERE status = 'paused'),
  'active_tasks',       (SELECT COUNT(*) FROM tasks WHERE status = 'in_progress'),
  'blocked_tasks',      (SELECT COUNT(*) FROM tasks WHERE status = 'blocked'),
  'pending_reviews',    (SELECT COUNT(*) FROM submissions WHERE status = 'submitted'),
  'pending_leave',      (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'),
  'pending_captures',   (SELECT COUNT(*) FROM capture_items WHERE status = 'pending'),
  'open_reviews',       (SELECT COUNT(*) FROM review_tasks WHERE status IN ('pending','in_progress')),
  'team_size',          (SELECT COUNT(*) FROM users WHERE is_active),
  'pending_extensions', (SELECT COUNT(*) FROM deadline_extensions WHERE status = 'pending'),
  'critical_insights',  (SELECT COUNT(*) FROM ai_insights WHERE status = 'active' AND severity IN ('high','critical')),

  -- recent activity (last 7 days)
  'recent_tasks_completed', (
    SELECT COUNT(*) FROM tasks
    WHERE status = 'completed' AND completed_at >= NOW() - INTERVAL '7 days'
  ),
  'recent_projects_created', (
    SELECT COUNT(*) FROM projects
    WHERE created_at >= NOW() - INTERVAL '7 days'
  )
);
$$;


-- ──────────────────────────────────────────────────────────
-- 5. fn_team_health — Analytics / team health page
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_team_health()
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
WITH member_stats AS (
  SELECT
    u.id,
    u.name,
    u.department,
    u.avatar_color,
    u.role,

    COUNT(t.id) FILTER (WHERE t.status = 'in_progress')  AS active_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'completed')    AS completed_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'blocked')      AS blocked_tasks,
    COUNT(t.id) FILTER (WHERE t.status = 'killed')       AS killed_tasks,

    COALESCE(SUM(t.actual_hours)     FILTER (WHERE t.status = 'completed'), 0)  AS total_hours,
    COALESCE(AVG(
      CASE WHEN t.estimated_hours > 0
        THEN t.actual_hours / t.estimated_hours
        ELSE NULL
      END
    ) FILTER (WHERE t.status = 'completed'), 1.0)   AS hours_ratio,

    COUNT(de.id) FILTER (WHERE de.status = 'approved')                          AS extensions_approved,
    COUNT(de.id) FILTER (WHERE de.escalation_level >= 2)                        AS high_escalations,

    COALESCE((
      SELECT AVG(se.mood::text::integer)
      FROM standup_entries se
      WHERE se.user_id = u.id AND se.date >= CURRENT_DATE - 14
    ), 3.0)  AS avg_mood,

    -- on-time delivery rate (tasks completed before deadline)
    CASE
      WHEN COUNT(t.id) FILTER (WHERE t.status = 'completed') = 0 THEN 1.0
      ELSE COUNT(t.id) FILTER (WHERE t.status = 'completed' AND t.completed_at IS NOT NULL)::FLOAT
           / NULLIF(COUNT(t.id) FILTER (WHERE t.status = 'completed'), 0)
    END AS on_time_rate,

    -- current project assignments
    (SELECT COUNT(DISTINCT pa.project_id)
     FROM project_assignees pa
     JOIN projects proj ON proj.id = pa.project_id
     WHERE pa.user_id = u.id AND proj.status = 'active') AS active_projects

  FROM users u
  LEFT JOIN tasks t  ON t.assignee_id  = u.id
  LEFT JOIN deadline_extensions de ON de.requested_by = u.id
  WHERE u.is_active
  GROUP BY u.id
),
scored AS (
  SELECT *,
    GREATEST(0, LEAST(100, ROUND(
      100.0
      - (blocked_tasks * 15.0)
      - (high_escalations * 10.0)
      - GREATEST(0, (hours_ratio - 1.5) * 20.0)
      + (avg_mood - 3.0) * 5.0
      + (on_time_rate - 0.8) * 20.0
    )::NUMERIC, 0))::INTEGER AS health_score
  FROM member_stats
)
SELECT json_build_object(
  'team_health', COALESCE(
    (SELECT json_agg(json_build_object(
      'id',               s.id,
      'name',             s.name,
      'department',       s.department,
      'avatar_color',     s.avatar_color,
      'role',             s.role,
      'active_tasks',     s.active_tasks,
      'completed_tasks',  s.completed_tasks,
      'blocked_tasks',    s.blocked_tasks,
      'total_hours',      s.total_hours,
      'hours_ratio',      ROUND(s.hours_ratio::NUMERIC, 2),
      'avg_mood',         ROUND(s.avg_mood::NUMERIC, 1),
      'on_time_rate',     ROUND(s.on_time_rate::NUMERIC * 100, 1),
      'active_projects',  s.active_projects,
      'health_score',     s.health_score,
      'high_escalations', s.high_escalations
    ) ORDER BY s.health_score ASC)
    FROM scored s),
    '[]'::JSON
  ),
  'avg_team_health', (SELECT ROUND(AVG(health_score)::NUMERIC, 0) FROM scored),
  'critical_members', (SELECT COUNT(*) FROM scored WHERE health_score < 50)
);
$$;


-- ──────────────────────────────────────────────────────────
-- 6. fn_ceo_briefing — CEO daily briefing page
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_ceo_briefing()
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
SELECT json_build_object(
  'stats', json_build_object(
    'active_projects',    (SELECT COUNT(*) FROM projects WHERE status = 'active'),
    'blocked_tasks',      (SELECT COUNT(*) FROM tasks WHERE status = 'blocked'),
    'awaiting_review',    (SELECT COUNT(*) FROM submissions WHERE status = 'submitted'),
    'pending_leave',      (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending'),
    'pending_extensions', (SELECT COUNT(*) FROM deadline_extensions WHERE status = 'pending'),
    'critical_risks',     (SELECT COUNT(*) FROM ai_insights WHERE status = 'active' AND severity IN ('high','critical'))
  ),

  'critical_projects', COALESCE((
    SELECT json_agg(json_build_object(
      'id',           p.id,
      'title',        p.title,
      'status',       p.status,
      'priority',     p.priority,
      'current_phase',p.current_phase,
      'timebox_days', p.timebox_days,
      'start_date',   p.start_date,
      'owner_name',   p.owner_name,
      'blocked_tasks',(SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'blocked'),
      'pending_review',(SELECT COUNT(*) FROM submissions s WHERE s.project_id = p.id AND s.status = 'submitted'),
      'days_elapsed', (CURRENT_DATE - p.start_date::DATE)
    ))
    FROM (
      SELECT p.*, u.name AS owner_name
      FROM projects p
      JOIN users u ON u.id = p.owner_id
      WHERE p.status = 'active'
      ORDER BY
        CASE p.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
        p.updated_at DESC
      LIMIT 8
    ) p
  ), '[]'::JSON),

  'pending_approvals', COALESCE((
    SELECT json_agg(json_build_object(
      'id',           s.id,
      'title',        s.title,
      'type',         s.type,
      'project_title',s.project_title,
      'submitted_by', s.submitted_by,
      'created_at',   s.created_at,
      'days_waiting', (CURRENT_DATE - s.created_at::DATE)
    ))
    FROM (
      SELECT s.id, s.title, s.type, proj.title AS project_title, u.name AS submitted_by, s.created_at
      FROM submissions s
      JOIN projects proj ON proj.id = s.project_id
      JOIN users u ON u.id = s.user_id
      WHERE s.status = 'submitted'
      ORDER BY s.created_at ASC
      LIMIT 10
    ) s
  ), '[]'::JSON),

  'insights', COALESCE((
    SELECT json_agg(json_build_object(
      'id',            ai.id,
      'type',          ai.type,
      'severity',      ai.severity,
      'title',         ai.title,
      'description',   ai.description,
      'action_items',  ai.action_items,
      'project_title', ai.project_title,
      'user_name',     ai.user_name
    ))
    FROM (
      SELECT ai.id, ai.type, ai.severity, ai.title, ai.description, ai.action_items,
             proj.title AS project_title, u.name AS user_name, ai.created_at
      FROM ai_insights ai
      LEFT JOIN projects proj ON proj.id = ai.project_id
      LEFT JOIN users u ON u.id = ai.user_id
      WHERE ai.status = 'active'
      ORDER BY
        CASE ai.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        ai.created_at DESC
      LIMIT 10
    ) ai
  ), '[]'::JSON),

  'deadline_extensions', COALESCE((
    SELECT json_agg(json_build_object(
      'id',                 de.id,
      'task_title',         de.task_title,
      'project_title',      de.project_title,
      'requested_deadline', de.requested_deadline,
      'reason',             de.reason,
      'escalation_level',   de.escalation_level,
      'requested_by_name',  de.requested_by_name
    ))
    FROM (
      SELECT de.id, t.title AS task_title, proj.title AS project_title,
             de.requested_deadline, de.reason, de.escalation_level,
             u.name AS requested_by_name, de.created_at
      FROM deadline_extensions de
      JOIN projects proj ON proj.id = de.project_id
      LEFT JOIN tasks t ON t.id = de.task_id
      JOIN users u ON u.id = de.requested_by
      WHERE de.status = 'pending'
      ORDER BY de.escalation_level DESC, de.created_at ASC
      LIMIT 10
    ) de
  ), '[]'::JSON),

  'leave_pending', COALESCE((
    SELECT json_agg(json_build_object(
      'id',         lr.id,
      'user_name',  lr.user_name,
      'type',       lr.type,
      'start_date', lr.start_date,
      'end_date',   lr.end_date,
      'days',       lr.days,
      'reason',     lr.reason
    ))
    FROM (
      SELECT lr.id, u.name AS user_name, lr.type, lr.start_date, lr.end_date, lr.days, lr.reason
      FROM leave_requests lr
      JOIN users u ON u.id = lr.user_id
      WHERE lr.status = 'pending'
      ORDER BY lr.start_date ASC
      LIMIT 10
    ) lr
  ), '[]'::JSON)
);
$$;


-- ──────────────────────────────────────────────────────────
-- 7. fn_workload_distribution — analytics workload page
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_workload_distribution()
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
WITH workload_data AS (
  SELECT
    u.id,
    u.name,
    u.department,
    u.avatar_color,
    COUNT(t.id) FILTER (WHERE t.status = 'in_progress')              AS in_progress,
    COUNT(t.id) FILTER (WHERE t.status = 'planning')                 AS planning,
    COUNT(t.id) FILTER (WHERE t.status = 'blocked')                  AS blocked,
    COUNT(t.id) FILTER (WHERE t.status IN ('in_progress','planning')) AS total_active,
    COALESCE(SUM(
      CASE WHEN t.status IN ('in_progress','planning')
        THEN COALESCE(t.revised_estimate_hours, t.estimated_hours, 0)
        ELSE 0
      END
    ), 0) AS estimated_hours_remaining,
    EXISTS(
      SELECT 1 FROM leave_requests lr
      WHERE lr.user_id = u.id AND lr.status = 'approved'
        AND CURRENT_DATE BETWEEN lr.start_date AND lr.end_date
    ) AS on_leave_today
  FROM users u
  LEFT JOIN tasks t ON t.assignee_id = u.id
  WHERE u.is_active
  GROUP BY u.id
)
SELECT json_build_object(
  'workload', COALESCE(
    (SELECT json_agg(json_build_object(
      'id',                        wd.id,
      'name',                      wd.name,
      'department',                wd.department,
      'avatar_color',              wd.avatar_color,
      'in_progress',               wd.in_progress,
      'planning',                  wd.planning,
      'blocked',                   wd.blocked,
      'total_active',              wd.total_active,
      'estimated_hours_remaining', wd.estimated_hours_remaining,
      'on_leave_today',            wd.on_leave_today
    ) ORDER BY wd.total_active DESC)
    FROM workload_data wd),
    '[]'::JSON
  )
);
$$;


-- ──────────────────────────────────────────────────────────
-- 8. fn_velocity — velocity chart data (N days)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_velocity(p_days INTEGER DEFAULT 30)
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
SELECT json_build_object(
  'velocity', COALESCE(
    (SELECT json_agg(json_build_object(
      'week',          w.week,
      'completed',     COALESCE(t_count.completed, 0),
      'hours_logged',  COALESCE(t_count.hours_logged, 0)
    ) ORDER BY w.week)
    FROM (
      SELECT generate_series(
        date_trunc('week', NOW() - (p_days || ' days')::INTERVAL)::DATE,
        date_trunc('week', NOW())::DATE,
        '7 days'
      )::DATE AS week
    ) w
    LEFT JOIN (
      SELECT
        date_trunc('week', completed_at)::DATE AS week,
        COUNT(*)                               AS completed,
        COALESCE(SUM(actual_hours), 0)         AS hours_logged
      FROM tasks
      WHERE completed_at >= NOW() - (p_days || ' days')::INTERVAL
        AND status = 'completed'
      GROUP BY date_trunc('week', completed_at)
    ) t_count ON t_count.week = w.week),
    '[]'::JSON
  )
);
$$;


-- ──────────────────────────────────────────────────────────
-- 9. fn_leave_analytics — leave analytics page (FY)
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_leave_analytics()
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
-- FY runs April 1 – March 31
WITH fy_start AS (
  SELECT
    CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
      THEN DATE_TRUNC('year', CURRENT_DATE)::DATE + INTERVAL '3 months'
      ELSE DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')::DATE + INTERVAL '3 months'
    END AS start_date
),
fy_leave AS (
  SELECT
    lr.user_id,
    lr.type,
    SUM(lr.days) AS total_days
  FROM leave_requests lr, fy_start
  WHERE lr.status = 'approved'
    AND lr.start_date >= fy_start.start_date
  GROUP BY lr.user_id, lr.type
),
upcoming AS (
  SELECT
    lr.user_id,
    COUNT(*) AS upcoming_count,
    SUM(lr.days) AS upcoming_days
  FROM leave_requests lr
  WHERE lr.status IN ('approved','pending')
    AND lr.start_date > CURRENT_DATE
  GROUP BY lr.user_id
),
user_leave_totals AS (
  SELECT
    u.id,
    u.name,
    u.department,
    u.avatar_color,
    COALESCE(SUM(fl.total_days), 0)                                          AS total_days,
    COALESCE(SUM(fl.total_days) FILTER (WHERE fl.type = 'planned'), 0)       AS planned_days,
    COALESCE(SUM(fl.total_days) FILTER (WHERE fl.type = 'sick'), 0)          AS sick_days,
    COALESCE(SUM(fl.total_days) FILTER (WHERE fl.type = 'personal'), 0)      AS personal_days,
    COALESCE(SUM(fl.total_days) FILTER (WHERE fl.type = 'wfh'), 0)           AS wfh_days,
    COALESCE(SUM(fl.total_days) FILTER (WHERE fl.type = 'half_day'), 0)      AS half_days,
    COALESCE(up.upcoming_days, 0)                                             AS upcoming_days,
    COALESCE(up.upcoming_count, 0)                                            AS upcoming_count
  FROM users u
  LEFT JOIN fy_leave fl ON fl.user_id = u.id
  LEFT JOIN upcoming up ON up.user_id = u.id
  WHERE u.is_active
  GROUP BY u.id, u.name, u.department, u.avatar_color, up.upcoming_days, up.upcoming_count
)
SELECT json_build_object(
  'analytics', COALESCE(
    (SELECT json_agg(json_build_object(
      'id',             ult.id,
      'name',           ult.name,
      'department',     ult.department,
      'avatar_color',   ult.avatar_color,
      'total_days',     ult.total_days,
      'planned_days',   ult.planned_days,
      'sick_days',      ult.sick_days,
      'personal_days',  ult.personal_days,
      'wfh_days',       ult.wfh_days,
      'half_days',      ult.half_days,
      'upcoming_days',  ult.upcoming_days,
      'upcoming_count', ult.upcoming_count
    ) ORDER BY ult.total_days DESC)
    FROM user_leave_totals ult),
    '[]'::JSON
  ),
  'fy_start', (SELECT start_date FROM fy_start)
);
$$;


-- ──────────────────────────────────────────────────────────
-- 10. fn_user_full — team member profile page
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_user_full(p_user_id UUID)
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
SELECT json_build_object(
  'id',            u.id,
  'name',          u.name,
  'email',         u.email,
  'role',          u.role,
  'role_type',     u.role_type,
  'department',    u.department,
  'avatar_color',  u.avatar_color,
  'is_active',     u.is_active,
  'created_at',    u.created_at,

  -- current task summary
  'task_stats', json_build_object(
    'in_progress',     (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'in_progress'),
    'planning',        (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'planning'),
    'completed',       (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'completed'),
    'blocked',         (SELECT COUNT(*) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'blocked'),
    'total_hours_logged',(SELECT COALESCE(SUM(actual_hours),0) FROM tasks t WHERE t.assignee_id = u.id AND t.status = 'completed'),
    'avg_hours_ratio', (
      SELECT ROUND(AVG(actual_hours / NULLIF(estimated_hours,0))::NUMERIC, 2)
      FROM tasks t
      WHERE t.assignee_id = u.id AND t.status = 'completed'
        AND estimated_hours > 0 AND actual_hours IS NOT NULL
    )
  ),

  -- active projects
  'projects', COALESCE((
    SELECT json_agg(json_build_object(
      'id',            p.id,
      'title',         p.title,
      'status',        p.status,
      'type',          p.type,
      'priority',      p.priority,
      'current_phase', p.current_phase
    ) ORDER BY p.updated_at DESC)
    FROM project_assignees pa
    JOIN projects p ON p.id = pa.project_id
    WHERE pa.user_id = u.id
  ), '[]'::JSON),

  -- recent tasks
  'recent_tasks', COALESCE((
    SELECT json_agg(json_build_object(
      'id',             t.id,
      'title',          t.title,
      'status',         t.status,
      'priority',       t.priority,
      'project_title',  t.project_title,
      'estimated_hours',t.estimated_hours,
      'actual_hours',   t.actual_hours
    ))
    FROM (
      SELECT t.id, t.title, t.status, t.priority, proj.title AS project_title,
             t.estimated_hours, t.actual_hours
      FROM tasks t
      JOIN projects proj ON proj.id = t.project_id
      WHERE t.assignee_id = u.id
      ORDER BY t.updated_at DESC
      LIMIT 10
    ) t
  ), '[]'::JSON),

  -- standup history (last 14 days)
  'standup_history', COALESCE((
    SELECT json_agg(json_build_object(
      'date',      se.date,
      'yesterday', se.yesterday,
      'today',     se.today,
      'blockers',  se.blockers,
      'mood',      se.mood
    ) ORDER BY se.date DESC)
    FROM standup_entries se
    WHERE se.user_id = u.id AND se.date >= CURRENT_DATE - 14
  ), '[]'::JSON),

  -- leave this FY
  'leave_this_fy', (
    SELECT COALESCE(SUM(lr.days), 0)
    FROM leave_requests lr
    WHERE lr.user_id = u.id AND lr.status = 'approved'
      AND lr.start_date >= CASE
        WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
          THEN DATE_TRUNC('year', CURRENT_DATE)::DATE + INTERVAL '3 months'
          ELSE DATE_TRUNC('year', CURRENT_DATE - INTERVAL '1 year')::DATE + INTERVAL '3 months'
        END
  )
)
FROM users u
WHERE u.id = p_user_id;
$$;


-- ──────────────────────────────────────────────────────────
-- 11. fn_phase_full — phase detail with all sub-resources
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_phase_full(p_phase_id UUID)
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
SELECT json_build_object(
  'id',                ph.id,
  'project_id',        ph.project_id,
  'phase_name',        ph.phase_name,
  'description',       ph.description,
  'status',            ph.status,
  'checklist',         ph.checklist,
  'order_index',       ph.order_index,
  'sign_off_required', ph.sign_off_required,
  'signed_off_by',     ph.signed_off_by,
  'estimated_duration',ph.estimated_duration,
  'start_date',        ph.start_date,
  'end_date',          ph.end_date,
  'started_at',        ph.started_at,
  'completed_at',      ph.completed_at,

  -- submissions with feedback
  'submissions', COALESCE((
    SELECT json_agg(json_build_object(
      'id',           s.id,
      'title',        s.title,
      'type',         s.type,
      'description',  s.description,
      'link',         s.link,
      'status',       s.status,
      'is_key_milestone', s.is_key_milestone,
      'submitted_by', u.name,
      'created_at',   s.created_at,
      'feedback_count',(SELECT COUNT(*) FROM feedback f WHERE f.submission_id = s.id)
    ) ORDER BY s.created_at DESC)
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    WHERE s.phase_id = ph.id
  ), '[]'::JSON),

  -- attachments
  'attachments', COALESCE((
    SELECT json_agg(json_build_object(
      'id',          pa.id,
      'title',       pa.title,
      'type',        pa.type,
      'url',         pa.url,
      'uploader',    u.name,
      'created_at',  pa.created_at
    ) ORDER BY pa.created_at DESC)
    FROM phase_attachments pa
    LEFT JOIN users u ON u.id = pa.uploaded_by
    WHERE pa.phase_id = ph.id
  ), '[]'::JSON),

  -- discussions
  'discussions', COALESCE((
    SELECT json_agg(json_build_object(
      'id',          pd.id,
      'user_id',     pd.user_id,
      'user_name',   u.name,
      'message',     pd.message,
      'type',        pd.type,
      'created_at',  pd.created_at
    ) ORDER BY pd.created_at)
    FROM phase_discussions pd
    JOIN users u ON u.id = pd.user_id
    WHERE pd.phase_id = ph.id
  ), '[]'::JSON)
)
FROM phases ph
WHERE ph.id = p_phase_id;
$$;


-- ──────────────────────────────────────────────────────────
-- 12. fn_kanban_board — Kanban page for a project
--     Groups tasks by status with user details
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_kanban_board(p_project_id UUID)
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
WITH task_cards AS (
  SELECT
    t.*,
    u.name     AS assignee_name,
    u.avatar_color AS assignee_color,
    ph.phase_name,
    (SELECT COUNT(*) FROM task_steps ts WHERE ts.task_id = t.id AND ts.status = 'completed') AS steps_done,
    (SELECT COUNT(*) FROM task_steps ts WHERE ts.task_id = t.id)                             AS steps_total
  FROM tasks t
  LEFT JOIN users u  ON u.id = t.assignee_id
  LEFT JOIN phases ph ON ph.id = t.phase_id
  WHERE t.project_id = p_project_id
)
SELECT json_build_object(
  'project_id', p_project_id,
  'columns', json_build_object(
    'planning',    (SELECT COALESCE(json_agg(json_build_object(
      'id',           tc.id,'title', tc.title,'priority', tc.priority,
      'assignee_name',tc.assignee_name,'assignee_color',tc.assignee_color,
      'estimated_hours',tc.estimated_hours,'steps_done',tc.steps_done,'steps_total',tc.steps_total
    ) ORDER BY tc.order_index),    '[]'::JSON) FROM task_cards tc WHERE tc.status = 'planning'),
    'in_progress', (SELECT COALESCE(json_agg(json_build_object(
      'id',           tc.id,'title', tc.title,'priority', tc.priority,
      'assignee_name',tc.assignee_name,'assignee_color',tc.assignee_color,
      'estimated_hours',tc.estimated_hours,'steps_done',tc.steps_done,'steps_total',tc.steps_total
    ) ORDER BY tc.order_index),    '[]'::JSON) FROM task_cards tc WHERE tc.status = 'in_progress'),
    'blocked',     (SELECT COALESCE(json_agg(json_build_object(
      'id',           tc.id,'title', tc.title,'priority', tc.priority,
      'assignee_name',tc.assignee_name,'assignee_color',tc.assignee_color,
      'estimated_hours',tc.estimated_hours,'steps_done',tc.steps_done,'steps_total',tc.steps_total
    ) ORDER BY tc.order_index),    '[]'::JSON) FROM task_cards tc WHERE tc.status = 'blocked'),
    'completed',   (SELECT COALESCE(json_agg(json_build_object(
      'id',           tc.id,'title', tc.title,'priority', tc.priority,
      'assignee_name',tc.assignee_name,'assignee_color',tc.assignee_color,
      'completed_at', tc.completed_at
    ) ORDER BY tc.completed_at DESC NULLS LAST), '[]'::JSON) FROM task_cards tc WHERE tc.status = 'completed')
  )
);
$$;


-- ──────────────────────────────────────────────────────────
-- 13. fn_timeline_data — Gantt chart / timeline page
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_timeline_data()
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
SELECT json_build_object(
  'projects', COALESCE(
    (SELECT json_agg(json_build_object(
      'id',            p.id,
      'title',         p.title,
      'status',        p.status,
      'priority',      p.priority,
      'type',          p.type,
      'start_date',    p.start_date,
      'end_date',      COALESCE(p.end_date, (p.start_date + (p.timebox_days || ' days')::INTERVAL)::DATE),
      'timebox_days',  p.timebox_days,
      'current_phase', p.current_phase,
      'owner_name',    u.name,
      'owner_color',   u.avatar_color,
      'phases', COALESCE((
        SELECT json_agg(json_build_object(
          'id',            ph.id,
          'phase_name',    ph.phase_name,
          'status',        ph.status,
          'order_index',   ph.order_index,
          'start_date',    ph.start_date,
          'end_date',      ph.end_date,
          'estimated_duration', ph.estimated_duration
        ) ORDER BY ph.order_index)
        FROM phases ph WHERE ph.project_id = p.id
      ), '[]'::JSON)
    ) ORDER BY p.start_date)
    FROM projects p
    JOIN users u ON u.id = p.owner_id
    WHERE p.status IN ('active','paused')),
    '[]'::JSON
  )
);
$$;


-- ──────────────────────────────────────────────────────────
-- 14. fn_global_search — command palette search
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_global_search(p_query TEXT)
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
SELECT json_build_object(
  'projects', COALESCE((
    SELECT json_agg(json_build_object(
      'id','title',p.title,'type',p.type,'status',p.status
    ))
    FROM projects p
    WHERE p.title ILIKE '%' || p_query || '%'
    LIMIT 5
  ), '[]'::JSON),

  'tasks', COALESCE((
    SELECT json_agg(json_build_object(
      'id',            t.id,
      'title',         t.title,
      'status',        t.status,
      'project_title', proj.title,
      'project_id',    t.project_id
    ))
    FROM tasks t
    JOIN projects proj ON proj.id = t.project_id
    WHERE t.title ILIKE '%' || p_query || '%'
    LIMIT 5
  ), '[]'::JSON),

  'users', COALESCE((
    SELECT json_agg(json_build_object(
      'id',           u.id,
      'name',         u.name,
      'role',         u.role,
      'department',   u.department,
      'avatar_color', u.avatar_color
    ))
    FROM users u
    WHERE u.name ILIKE '%' || p_query || '%' AND u.is_active
    LIMIT 5
  ), '[]'::JSON)
);
$$;


-- ──────────────────────────────────────────────────────────
-- 15. fn_advance_phase — atomic phase transition
--     Called after phase completion — advances project
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_advance_phase(p_phase_id UUID)
RETURNS JSON
LANGUAGE plpgsql
AS $$
DECLARE
  v_phase         phases%ROWTYPE;
  v_next_phase    phases%ROWTYPE;
BEGIN
  SELECT * INTO v_phase FROM phases WHERE id = p_phase_id;
  IF NOT FOUND THEN
    RETURN json_build_object('error', 'Phase not found');
  END IF;

  -- Mark current phase completed
  UPDATE phases
  SET status = 'completed', completed_at = NOW(), updated_at = NOW()
  WHERE id = p_phase_id;

  -- Find and activate next phase
  SELECT * INTO v_next_phase
  FROM phases
  WHERE project_id = v_phase.project_id
    AND order_index = v_phase.order_index + 1
    AND status = 'pending';

  IF FOUND THEN
    UPDATE phases
    SET status = 'active', started_at = NOW(), updated_at = NOW()
    WHERE id = v_next_phase.id;

    -- Update project current_phase
    UPDATE projects
    SET current_phase = v_next_phase.phase_name,
        current_phase_index = v_next_phase.order_index,
        updated_at = NOW()
    WHERE id = v_phase.project_id;

    RETURN json_build_object(
      'completed_phase',  v_phase.phase_name,
      'next_phase',       v_next_phase.phase_name,
      'next_phase_id',    v_next_phase.id,
      'project_updated',  true
    );
  ELSE
    -- No next phase — project done
    UPDATE projects
    SET status = 'completed', updated_at = NOW()
    WHERE id = v_phase.project_id
      AND NOT EXISTS (
        SELECT 1 FROM phases ph
        WHERE ph.project_id = v_phase.project_id AND ph.status IN ('pending','active','in_discussion')
          AND ph.id != p_phase_id
      );

    RETURN json_build_object(
      'completed_phase', v_phase.phase_name,
      'next_phase',      null,
      'project_complete', true
    );
  END IF;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- 16. fn_create_project — atomic project + phases creation
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_create_project(
  p_title               TEXT,
  p_type                TEXT,
  p_requirement         TEXT,
  p_objective           TEXT,
  p_outcome_type        TEXT,
  p_outcome_description TEXT,
  p_priority            TEXT,
  p_owner_id            UUID,
  p_assignee_ids        UUID[],
  p_co_owner_ids        UUID[],
  p_timebox_days        INTEGER,
  p_start_date          DATE,
  p_tech_stack          JSONB,
  p_ai_plan             JSONB
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_project_id UUID;
  v_uid        UUID;
  v_phases     JSONB;
  v_phase      JSONB;
  v_idx        INTEGER;
  v_first_name TEXT;
BEGIN
  -- Select phase template
  v_phases := CASE
    WHEN p_type IN ('engineering', 'product') THEN '
      [
        {"name":"Requirements & Planning","checklist":[{"item":"Define scope","done":false},{"item":"Write requirement doc","done":false},{"item":"Get CEO sign-off","done":false}],"sign_off":true,"est":"3 days"},
        {"name":"Architecture & Design",  "checklist":[{"item":"Create system design","done":false},{"item":"Review with team","done":false},{"item":"Document API contracts","done":false}],"sign_off":true,"est":"4 days"},
        {"name":"Development",            "checklist":[{"item":"Implement core features","done":false},{"item":"Write unit tests","done":false},{"item":"Code review","done":false}],"sign_off":false,"est":"7 days"},
        {"name":"Testing & QA",           "checklist":[{"item":"Integration tests","done":false},{"item":"Load testing","done":false},{"item":"Bug fixes","done":false}],"sign_off":false,"est":"3 days"},
        {"name":"Deployment",             "checklist":[{"item":"Deploy to staging","done":false},{"item":"Smoke tests","done":false},{"item":"Production deploy","done":false}],"sign_off":true,"est":"2 days"},
        {"name":"Done",                   "checklist":[{"item":"Retrospective","done":false},{"item":"Documentation","done":false},{"item":"Handover","done":false}],"sign_off":false,"est":"1 day"}
      ]'::JSONB
    WHEN p_type IN ('data_science', 'research') THEN '
      [
        {"name":"Hypothesis",  "checklist":[{"item":"Define research question","done":false},{"item":"Literature review","done":false},{"item":"Hypothesis statement","done":false}],"sign_off":true,"est":"2 days"},
        {"name":"Exploration", "checklist":[{"item":"Data gathering","done":false},{"item":"Exploratory analysis","done":false},{"item":"Key findings","done":false}],"sign_off":false,"est":"4 days"},
        {"name":"Experiment",  "checklist":[{"item":"Design experiments","done":false},{"item":"Run models","done":false},{"item":"Track metrics","done":false}],"sign_off":false,"est":"5 days"},
        {"name":"Evaluation",  "checklist":[{"item":"Analyse results","done":false},{"item":"Peer review","done":false},{"item":"Iterate","done":false}],"sign_off":true,"est":"3 days"},
        {"name":"Report",      "checklist":[{"item":"Write report","done":false},{"item":"Visualisations","done":false},{"item":"Recommendations","done":false}],"sign_off":true,"est":"3 days"},
        {"name":"Done",        "checklist":[{"item":"Present findings","done":false},{"item":"Archive data","done":false},{"item":"Close project","done":false}],"sign_off":false,"est":"1 day"}
      ]'::JSONB
    WHEN p_type = 'design' THEN '
      [
        {"name":"Discovery",  "checklist":[{"item":"User research","done":false},{"item":"Competitor analysis","done":false},{"item":"Brief alignment","done":false}],"sign_off":true,"est":"2 days"},
        {"name":"Wireframes", "checklist":[{"item":"Lo-fi wireframes","done":false},{"item":"Information architecture","done":false},{"item":"Stakeholder review","done":false}],"sign_off":false,"est":"3 days"},
        {"name":"Design",     "checklist":[{"item":"High-fidelity designs","done":false},{"item":"Component library","done":false},{"item":"Design tokens","done":false}],"sign_off":false,"est":"5 days"},
        {"name":"Handoff",    "checklist":[{"item":"Dev handoff","done":false},{"item":"Design specs","done":false},{"item":"Asset export","done":false}],"sign_off":true,"est":"2 days"}
      ]'::JSONB
    ELSE '
      [
        {"name":"Planning",  "checklist":[{"item":"Define objectives","done":false},{"item":"Stakeholder alignment","done":false}],"sign_off":true,"est":"2 days"},
        {"name":"Execution", "checklist":[{"item":"Core deliverables","done":false},{"item":"Progress reviews","done":false}],"sign_off":false,"est":"7 days"},
        {"name":"Review",    "checklist":[{"item":"Quality review","done":false},{"item":"Feedback","done":false}],"sign_off":true,"est":"3 days"},
        {"name":"Done",      "checklist":[{"item":"Handover","done":false},{"item":"Documentation","done":false}],"sign_off":false,"est":"1 day"}
      ]'::JSONB
  END;

  v_first_name := (v_phases->0->>'name');

  -- Insert project
  INSERT INTO projects
    (title, type, requirement, objective, outcome_type, outcome_description,
     priority, owner_id, current_phase, timebox_days, start_date, tech_stack, ai_plan)
  VALUES
    (p_title, p_type::project_type, p_requirement, p_objective,
     p_outcome_type, p_outcome_description, p_priority::project_priority,
     p_owner_id, v_first_name, p_timebox_days,
     COALESCE(p_start_date, CURRENT_DATE), p_tech_stack, p_ai_plan)
  RETURNING id INTO v_project_id;

  -- Insert phases
  v_idx := 0;
  FOR v_phase IN SELECT * FROM jsonb_array_elements(v_phases)
  LOOP
    INSERT INTO phases
      (project_id, phase_name, checklist, order_index, sign_off_required,
       estimated_duration, status)
    VALUES (
      v_project_id,
      v_phase->>'name',
      v_phase->'checklist',
      v_idx,
      (v_phase->>'sign_off')::BOOLEAN,
      v_phase->>'est',
      CASE WHEN v_idx = 0 THEN 'active'::phase_status ELSE 'pending'::phase_status END
    );
    v_idx := v_idx + 1;
  END LOOP;

  -- Insert assignees
  IF p_assignee_ids IS NOT NULL THEN
    FOREACH v_uid IN ARRAY p_assignee_ids
    LOOP
      INSERT INTO project_assignees (project_id, user_id)
      VALUES (v_project_id, v_uid)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  -- Insert co-owners
  IF p_co_owner_ids IS NOT NULL THEN
    FOREACH v_uid IN ARRAY p_co_owner_ids
    LOOP
      INSERT INTO project_co_owners (project_id, user_id)
      VALUES (v_project_id, v_uid)
      ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;

  RETURN v_project_id;
END;
$$;


-- ──────────────────────────────────────────────────────────
-- 17. fn_reviews_queue — review task queue page
-- ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_reviews_queue(
  p_assignee_id UUID    DEFAULT NULL,
  p_status      TEXT    DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
SELECT json_build_object(
  'reviews', COALESCE((
    SELECT json_agg(json_build_object(
      'id',             rt.id,
      'title',          rt.title,
      'description',    rt.description,
      'type',           rt.type,
      'priority',       rt.priority,
      'status',         rt.status,
      'due_date',       rt.due_date,
      'feedback_text',  rt.feedback_text,
      'assignee_id',    rt.assignee_id,
      'assignee_name',  a.name,
      'assignee_color', a.avatar_color,
      'requester_name', rq.name,
      'project_id',     rt.project_id,
      'project_title',  p.title,
      'days_overdue',   GREATEST(0, CURRENT_DATE - rt.due_date),
      'created_at',     rt.created_at
    ) ORDER BY
      CASE rt.priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
      rt.due_date NULLS LAST,
      rt.created_at DESC)
    FROM review_tasks rt
    LEFT JOIN users a  ON a.id  = rt.assignee_id
    LEFT JOIN users rq ON rq.id = rt.requester_id
    LEFT JOIN projects p ON p.id = rt.project_id
    WHERE (p_assignee_id IS NULL OR rt.assignee_id = p_assignee_id)
      AND (p_status IS NULL OR rt.status = p_status::review_task_status)
  ), '[]'::JSON),
  'stats', json_build_object(
    'pending',         (SELECT COUNT(*) FROM review_tasks WHERE status = 'pending'     AND (p_assignee_id IS NULL OR assignee_id = p_assignee_id)),
    'in_progress',     (SELECT COUNT(*) FROM review_tasks WHERE status = 'in_progress' AND (p_assignee_id IS NULL OR assignee_id = p_assignee_id)),
    'high_priority',   (SELECT COUNT(*) FROM review_tasks WHERE priority = 'high' AND status NOT IN ('completed','rejected') AND (p_assignee_id IS NULL OR assignee_id = p_assignee_id))
  )
);
$$;


-- ──────────────────────────────────────────────────────────
-- GRANT execute to app role (adjust role name to match RDS setup)
-- ──────────────────────────────────────────────────────────
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO projecthub_app;
