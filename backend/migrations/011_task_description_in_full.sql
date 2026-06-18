-- Ensure task description is returned by fn_project_full, fn_kanban_board, and
-- the /api/projects/{id}/tasks endpoint. Previously these omitted t.description,
-- so the project detail page could not display or refetch saved descriptions.
--
-- This migration preserves every other field from migration 007 and the original
-- fn_kanban_board in 003_functions.sql, adding only `description` (and `approach`
-- on the tasks summary, which the detail view also needs).

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
  'metadata',            p.metadata,
  'created_at',          p.created_at,
  'updated_at',          p.updated_at,

  'owner', json_build_object(
    'id',           owner.id,
    'name',         owner.name,
    'email',        owner.email,
    'avatar_color', owner.avatar_color,
    'role',         owner.role,
    'department',   owner.department
  ),

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

  'tasks', COALESCE((
    SELECT json_agg(json_build_object(
      'id',             t.id,
      'title',          t.title,
      'description',    t.description,
      'approach',       t.approach,
      'status',         t.status,
      'priority',       t.priority,
      'assignee_id',    t.assignee_id,
      'assignee_name',  u.name,
      'assignee_color', u.avatar_color,
      'phase_id',       t.phase_id,
      'estimated_hours',t.estimated_hours,
      'actual_hours',   t.actual_hours,
      'plan_status',    t.plan_status,
      'review_status',  t.review_status,
      'order_index',    t.order_index,
      'step_count',     (SELECT COUNT(*) FROM task_steps ts WHERE ts.task_id = t.id),
      'milestone_count',(SELECT COUNT(*) FROM task_milestones tm WHERE tm.task_id = t.id),
      'completed_at',   t.completed_at
    ) ORDER BY t.order_index, t.created_at)
    FROM tasks t
    LEFT JOIN users u ON u.id = t.assignee_id
    WHERE t.project_id = p.id
  ), '[]'::JSON),

  'documents', COALESCE((
    SELECT json_agg(json_build_object(
      'id',              d.id,
      'project_id',      d.project_id,
      'type',            d.type,
      'title',           d.title,
      'description',     d.description,
      'status',          d.status,
      'current_version', d.current_version,
      'sections',        d.sections,
      'tags',            d.tags,
      'file_url',        d.file_url,
      'file_name',       d.file_name,
      'mime_type',       d.mime_type,
      'file_size',       d.file_size,
      'created_by',      d.created_by,
      'created_at',      d.created_at,
      'updated_at',      d.updated_at
    ) ORDER BY d.updated_at DESC)
    FROM project_documents d
    WHERE d.project_id = p.id
  ), '[]'::JSON),

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

  'pending_submissions', (
    SELECT COUNT(*) FROM submissions s
    WHERE s.project_id = p.id AND s.status = 'submitted'
  ),

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


-- ── fn_kanban_board: include description on every column's task card.
-- Preserves the original per-column shape (completed keeps completed_at, others keep steps_*).
CREATE OR REPLACE FUNCTION fn_kanban_board(p_project_id UUID)
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
WITH task_cards AS (
  SELECT
    t.*,
    u.name         AS assignee_name,
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
      'id',             tc.id,
      'title',          tc.title,
      'description',    tc.description,
      'priority',       tc.priority,
      'assignee_name',  tc.assignee_name,
      'assignee_color', tc.assignee_color,
      'estimated_hours',tc.estimated_hours,
      'steps_done',     tc.steps_done,
      'steps_total',    tc.steps_total
    ) ORDER BY tc.order_index), '[]'::JSON) FROM task_cards tc WHERE tc.status = 'planning'),
    'in_progress', (SELECT COALESCE(json_agg(json_build_object(
      'id',             tc.id,
      'title',          tc.title,
      'description',    tc.description,
      'priority',       tc.priority,
      'assignee_name',  tc.assignee_name,
      'assignee_color', tc.assignee_color,
      'estimated_hours',tc.estimated_hours,
      'steps_done',     tc.steps_done,
      'steps_total',    tc.steps_total
    ) ORDER BY tc.order_index), '[]'::JSON) FROM task_cards tc WHERE tc.status = 'in_progress'),
    'blocked',     (SELECT COALESCE(json_agg(json_build_object(
      'id',             tc.id,
      'title',          tc.title,
      'description',    tc.description,
      'priority',       tc.priority,
      'assignee_name',  tc.assignee_name,
      'assignee_color', tc.assignee_color,
      'estimated_hours',tc.estimated_hours,
      'steps_done',     tc.steps_done,
      'steps_total',    tc.steps_total
    ) ORDER BY tc.order_index), '[]'::JSON) FROM task_cards tc WHERE tc.status = 'blocked'),
    'completed',   (SELECT COALESCE(json_agg(json_build_object(
      'id',             tc.id,
      'title',          tc.title,
      'description',    tc.description,
      'priority',       tc.priority,
      'assignee_name',  tc.assignee_name,
      'assignee_color', tc.assignee_color,
      'completed_at',   tc.completed_at
    ) ORDER BY tc.completed_at DESC NULLS LAST), '[]'::JSON) FROM task_cards tc WHERE tc.status = 'completed')
  )
);
$$;
