-- ============================================================
-- ProjectHub — Performance Indexes
-- ============================================================

-- Users
CREATE INDEX idx_users_email        ON users(email);
CREATE INDEX idx_users_role_type    ON users(role_type);
CREATE INDEX idx_users_department   ON users(department);
CREATE INDEX idx_users_is_active    ON users(is_active);

-- Sessions
CREATE INDEX idx_sessions_user_id   ON sessions(user_id);
CREATE INDEX idx_sessions_token     ON sessions(token_hash);
CREATE INDEX idx_sessions_expires   ON sessions(expires_at);

-- Projects
CREATE INDEX idx_projects_owner         ON projects(owner_id);
CREATE INDEX idx_projects_status        ON projects(status);
CREATE INDEX idx_projects_priority      ON projects(priority);
CREATE INDEX idx_projects_type          ON projects(type);
CREATE INDEX idx_projects_created_at    ON projects(created_at DESC);
CREATE INDEX idx_projects_title_trgm    ON projects USING gin(title gin_trgm_ops);

-- Project assignees
CREATE INDEX idx_project_assignees_user    ON project_assignees(user_id);
CREATE INDEX idx_project_assignees_project ON project_assignees(project_id);
CREATE INDEX idx_project_co_owners_user    ON project_co_owners(user_id);

-- Phases
CREATE INDEX idx_phases_project     ON phases(project_id);
CREATE INDEX idx_phases_status      ON phases(status);
CREATE INDEX idx_phases_order       ON phases(project_id, order_index);

-- Tasks
CREATE INDEX idx_tasks_project      ON tasks(project_id);
CREATE INDEX idx_tasks_phase        ON tasks(phase_id);
CREATE INDEX idx_tasks_assignee     ON tasks(assignee_id);
CREATE INDEX idx_tasks_status       ON tasks(status);
CREATE INDEX idx_tasks_priority     ON tasks(priority);
CREATE INDEX idx_tasks_created_at   ON tasks(created_at DESC);

-- Task steps
CREATE INDEX idx_task_steps_task    ON task_steps(task_id);
CREATE INDEX idx_task_steps_order   ON task_steps(task_id, order_index);

-- Task updates
CREATE INDEX idx_task_updates_task  ON task_updates(task_id);

-- Task milestones
CREATE INDEX idx_milestones_task    ON task_milestones(task_id);

-- Deliverables
CREATE INDEX idx_deliverables_milestone ON deliverables(milestone_id);
CREATE INDEX idx_deliverables_task      ON deliverables(task_id);

-- Deadline extensions
CREATE INDEX idx_deadline_ext_task    ON deadline_extensions(task_id);
CREATE INDEX idx_deadline_ext_project ON deadline_extensions(project_id);
CREATE INDEX idx_deadline_ext_status  ON deadline_extensions(status);

-- Submissions
CREATE INDEX idx_submissions_project ON submissions(project_id);
CREATE INDEX idx_submissions_phase   ON submissions(phase_id);
CREATE INDEX idx_submissions_user    ON submissions(user_id);
CREATE INDEX idx_submissions_status  ON submissions(status);

-- Feedback
CREATE INDEX idx_feedback_submission ON feedback(submission_id);

-- Checkpoints
CREATE INDEX idx_checkpoints_project ON checkpoints(project_id);

-- Leave requests
CREATE INDEX idx_leave_user         ON leave_requests(user_id);
CREATE INDEX idx_leave_status       ON leave_requests(status);
CREATE INDEX idx_leave_dates        ON leave_requests(start_date, end_date);
CREATE INDEX idx_leave_approved_by  ON leave_requests(approved_by);

-- Availability
CREATE INDEX idx_availability_user_date ON team_availability(user_id, date);

-- Capture sessions & items
CREATE INDEX idx_capture_sessions_user ON capture_sessions(user_id);
CREATE INDEX idx_capture_items_user    ON capture_items(user_id);
CREATE INDEX idx_capture_items_status  ON capture_items(status);
CREATE INDEX idx_capture_items_session ON capture_items(session_id);

-- Review tasks
CREATE INDEX idx_review_tasks_assignee  ON review_tasks(assignee_id);
CREATE INDEX idx_review_tasks_project   ON review_tasks(project_id);
CREATE INDEX idx_review_tasks_status    ON review_tasks(status);
CREATE INDEX idx_review_tasks_due       ON review_tasks(due_date);

-- Discussions
CREATE INDEX idx_discussions_project ON discussions(project_id);
CREATE INDEX idx_discussions_phase   ON discussions(phase_id);

-- Discussion messages
CREATE INDEX idx_disc_messages_discussion ON discussion_messages(discussion_id);
CREATE INDEX idx_disc_messages_parent     ON discussion_messages(parent_id);

-- AI insights
CREATE INDEX idx_ai_insights_project ON ai_insights(project_id);
CREATE INDEX idx_ai_insights_type    ON ai_insights(type);
CREATE INDEX idx_ai_insights_status  ON ai_insights(status);

-- Notifications
CREATE INDEX idx_notifications_user    ON notifications(user_id);
CREATE INDEX idx_notifications_unread  ON notifications(user_id, is_read) WHERE is_read = FALSE;
CREATE INDEX idx_notifications_created ON notifications(created_at DESC);

-- Standup
CREATE INDEX idx_standup_user_date ON standup_entries(user_id, date);

-- Audit log
CREATE INDEX idx_audit_user         ON audit_logs(user_id);
CREATE INDEX idx_audit_entity       ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_created_at   ON audit_logs(created_at DESC);

-- Project documents
CREATE INDEX idx_project_docs_project ON project_documents(project_id);

-- Project updates
CREATE INDEX idx_project_updates_project ON project_updates(project_id);
CREATE INDEX idx_project_updates_user    ON project_updates(user_id);
