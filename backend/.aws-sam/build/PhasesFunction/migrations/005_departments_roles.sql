-- ============================================================
-- ProjectHub — Departments & Roles Schema
-- Migration: 005
-- Run after: 004_views.sql
-- ============================================================

-- ============================================================
-- DEPARTMENTS
-- ============================================================

CREATE TABLE departments (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL,
  description TEXT,
  color       VARCHAR(20)  NOT NULL DEFAULT '#6366f1',
  head_id     UUID         REFERENCES users(id) ON DELETE SET NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_department_name UNIQUE (name)
);

CREATE TRIGGER trg_departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- ROLES
-- ============================================================

CREATE TABLE roles (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(100) NOT NULL,
  description   TEXT,
  department_id UUID         REFERENCES departments(id) ON DELETE SET NULL,
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_role_name UNIQUE (name)
);

CREATE TRIGGER trg_roles_updated_at
  BEFORE UPDATE ON roles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- LINK USERS → DEPARTMENTS
-- Add department_id FK alongside the existing department VARCHAR.
-- Both stay in sync via the trigger below.
-- ============================================================

ALTER TABLE users
  ADD COLUMN department_id UUID REFERENCES departments(id) ON DELETE SET NULL;

-- ============================================================
-- SEED: migrate distinct department names from users
-- ============================================================

INSERT INTO departments (name)
SELECT DISTINCT department
FROM   users
WHERE  department IS NOT NULL
  AND  department <> ''
ON CONFLICT (name) DO NOTHING;

-- Back-fill department_id on users
UPDATE users u
SET    department_id = d.id
FROM   departments d
WHERE  d.name = u.department
  AND  u.department IS NOT NULL
  AND  u.department <> '';

-- ============================================================
-- SEED: migrate distinct role names from users
-- ============================================================

INSERT INTO roles (name, department_id)
SELECT DISTINCT ON (u.role)
       u.role,
       d.id
FROM   users u
LEFT   JOIN departments d ON d.name = u.department
WHERE  u.role IS NOT NULL
  AND  u.role <> ''
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- TRIGGER: keep users.department text in sync with department_id
-- ============================================================

CREATE OR REPLACE FUNCTION sync_user_department()
RETURNS TRIGGER AS $$
BEGIN
  -- When department_id is set, mirror the name to the text column
  IF NEW.department_id IS NOT NULL THEN
    SELECT name INTO NEW.department
    FROM   departments
    WHERE  id = NEW.department_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_sync_department
  BEFORE INSERT OR UPDATE OF department_id ON users
  FOR EACH ROW EXECUTE FUNCTION sync_user_department();

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_departments_name       ON departments(name);
CREATE INDEX idx_departments_head       ON departments(head_id);
CREATE INDEX idx_departments_is_active  ON departments(is_active);

CREATE INDEX idx_roles_name             ON roles(name);
CREATE INDEX idx_roles_department       ON roles(department_id);
CREATE INDEX idx_roles_is_active        ON roles(is_active);

CREATE INDEX idx_users_department_id    ON users(department_id);
