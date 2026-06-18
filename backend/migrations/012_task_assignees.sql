-- Multi-assignee support for tasks.
-- The existing tasks.assignee_id stays as the "primary" assignee (first one
-- chosen, surfaces in lists and kanban for backwards compat). The new
-- task_assignees join table holds the full set including the primary.

CREATE TABLE IF NOT EXISTS task_assignees (
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  added_by UUID REFERENCES users(id),
  PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_task_assignees_user ON task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task ON task_assignees(task_id);

-- Backfill: every existing task with an assignee_id becomes a single-row entry.
INSERT INTO task_assignees (task_id, user_id)
SELECT id, assignee_id FROM tasks WHERE assignee_id IS NOT NULL
ON CONFLICT DO NOTHING;


-- ── fn_task_full: include the full assignees array alongside the legacy
-- primary assignee_id/assignee_name fields, so the task detail view can render
-- multiple chips.
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
  'assignees', COALESCE((
    SELECT json_agg(json_build_object(
      'id', au.id, 'name', au.name, 'avatar_color', au.avatar_color,
      'role', au.role, 'department', au.department
    ) ORDER BY au.name)
    FROM task_assignees ta JOIN users au ON au.id = ta.user_id
    WHERE ta.task_id = t.id
  ), '[]'::JSON),
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
