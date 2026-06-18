-- ============================================================
-- ProjectHub — Migration 015: project access scoping
--
-- Team Leads and Members may only see projects they own, co-own, or are
-- assigned to. CEO and Admin (or a NULL viewer, e.g. internal calls) see
-- everything. The scoping is applied inside fn_projects_list so that the
-- paginated `total` and the returned page stay consistent.
--
-- Per-project detail and sub-resource access is enforced in the Lambda
-- handler (_require_view_access); this migration only covers the list view.
-- ============================================================

-- Adding two parameters changes the signature, so CREATE OR REPLACE would
-- leave the old 8-arg overload in place (an unscoped code path). Drop it first
-- so the scoped version below is the only fn_projects_list.
DROP FUNCTION IF EXISTS fn_projects_list(TEXT, TEXT, TEXT, UUID, UUID, TEXT, INTEGER, INTEGER);

CREATE OR REPLACE FUNCTION fn_projects_list(
  p_status      TEXT     DEFAULT NULL,
  p_type        TEXT     DEFAULT NULL,
  p_priority    TEXT     DEFAULT NULL,
  p_owner_id    UUID     DEFAULT NULL,
  p_assignee_id UUID     DEFAULT NULL,
  p_search      TEXT     DEFAULT NULL,
  p_limit       INTEGER  DEFAULT 50,
  p_offset      INTEGER  DEFAULT 0,
  p_viewer_id   UUID     DEFAULT NULL,
  p_viewer_role TEXT     DEFAULT NULL
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
    -- Viewer scoping: CEO/Admin (or unscoped calls) see all; everyone else
    -- only sees projects they own, co-own, or are assigned to.
    AND (
      p_viewer_id IS NULL
      OR p_viewer_role IN ('CEO', 'Admin')
      OR p.owner_id = p_viewer_id
      OR EXISTS (
            SELECT 1 FROM project_co_owners co
            WHERE co.project_id = p.id AND co.user_id = p_viewer_id
        )
      OR EXISTS (
            SELECT 1 FROM project_assignees pav
            WHERE pav.project_id = p.id AND pav.user_id = p_viewer_id
        )
    )
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


-- ── fn_timeline_data — scoped to the viewer's projects ──────
DROP FUNCTION IF EXISTS fn_timeline_data();

CREATE OR REPLACE FUNCTION fn_timeline_data(
  p_viewer_id   UUID DEFAULT NULL,
  p_viewer_role TEXT DEFAULT NULL
)
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
    WHERE p.status IN ('active','paused')
      AND (
        p_viewer_id IS NULL
        OR p_viewer_role IN ('CEO', 'Admin')
        OR p.owner_id = p_viewer_id
        OR EXISTS (SELECT 1 FROM project_co_owners co
                     WHERE co.project_id = p.id AND co.user_id = p_viewer_id)
        OR EXISTS (SELECT 1 FROM project_assignees pav
                     WHERE pav.project_id = p.id AND pav.user_id = p_viewer_id)
      )),
    '[]'::JSON
  )
);
$$;


-- ── fn_global_search — projects/tasks scoped to the viewer ──
DROP FUNCTION IF EXISTS fn_global_search(TEXT);

CREATE OR REPLACE FUNCTION fn_global_search(
  p_query       TEXT,
  p_viewer_id   UUID DEFAULT NULL,
  p_viewer_role TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE sql STABLE PARALLEL SAFE
AS $$
SELECT json_build_object(
  'projects', COALESCE((
    SELECT json_agg(json_build_object(
      'id', p.id, 'title', p.title, 'type', p.type, 'status', p.status
    ))
    FROM projects p
    WHERE p.title ILIKE '%' || p_query || '%'
      AND (
        p_viewer_id IS NULL
        OR p_viewer_role IN ('CEO', 'Admin')
        OR p.owner_id = p_viewer_id
        OR EXISTS (SELECT 1 FROM project_co_owners co
                     WHERE co.project_id = p.id AND co.user_id = p_viewer_id)
        OR EXISTS (SELECT 1 FROM project_assignees pav
                     WHERE pav.project_id = p.id AND pav.user_id = p_viewer_id)
      )
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
      AND (
        p_viewer_id IS NULL
        OR p_viewer_role IN ('CEO', 'Admin')
        OR proj.owner_id = p_viewer_id
        OR EXISTS (SELECT 1 FROM project_co_owners co
                     WHERE co.project_id = proj.id AND co.user_id = p_viewer_id)
        OR EXISTS (SELECT 1 FROM project_assignees pav
                     WHERE pav.project_id = proj.id AND pav.user_id = p_viewer_id)
      )
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
