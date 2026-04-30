-- ============================================================
-- FarmwiseAI Resource Allocation — Production Seed SQL
-- Generated from Excel tracker data
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- MIGRATE SCHEMA (add columns missing from older deployments)
-- ────────────────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS role_type     TEXT NOT NULL DEFAULT 'Member',
  ADD COLUMN IF NOT EXISTS department    TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS avatar_color  TEXT NOT NULL DEFAULT '#3b82f6',
  ADD COLUMN IF NOT EXISTS is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS metadata      JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS objective            TEXT,
  ADD COLUMN IF NOT EXISTS outcome_type         TEXT,
  ADD COLUMN IF NOT EXISTS outcome_description  TEXT,
  ADD COLUMN IF NOT EXISTS owner_id             UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS current_phase_index  INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timebox_days         INTEGER DEFAULT 14,
  ADD COLUMN IF NOT EXISTS start_date           DATE,
  ADD COLUMN IF NOT EXISTS end_date             DATE,
  ADD COLUMN IF NOT EXISTS updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE phases
  ADD COLUMN IF NOT EXISTS sign_off_required  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS signed_off_by      JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS estimated_duration TEXT,
  ADD COLUMN IF NOT EXISTS started_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS type             submission_type,
  ADD COLUMN IF NOT EXISTS status           submission_status NOT NULL DEFAULT 'submitted',
  ADD COLUMN IF NOT EXISTS reviewed_by      UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_key_milestone BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE checkpoints
  ADD COLUMN IF NOT EXISTS decision     checkpoint_decision NOT NULL DEFAULT 'continue',
  ADD COLUMN IF NOT EXISTS notes        TEXT,
  ADD COLUMN IF NOT EXISTS ai_insights  TEXT,
  ADD COLUMN IF NOT EXISTS action_items JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS decided_by   UUID REFERENCES users(id);

BEGIN;

-- ────────────────────────────────────────────────────────────
-- DELETE EXISTING DATA (clears all tables before re-seeding)
-- ────────────────────────────────────────────────────────────
DELETE FROM notifications;
DELETE FROM standup_entries;
DELETE FROM capture_items;
DELETE FROM capture_sessions;
DELETE FROM leave_requests;
DELETE FROM discussion_messages;
DELETE FROM discussions;
DELETE FROM feedback;
DELETE FROM checkpoints;
DELETE FROM ai_insights;
DELETE FROM review_tasks;
DELETE FROM submissions;
DELETE FROM task_steps;
DELETE FROM tasks;
DELETE FROM phases;
DELETE FROM project_co_owners;
DELETE FROM project_assignees;
DELETE FROM projects;
DELETE FROM users;


-- ────────────────────────────────────────────────────────────
-- USERS (Employees from the Excel tracker)
-- ────────────────────────────────────────────────────────────
INSERT INTO users (id, name, email, password_hash, role, role_type, department, avatar_color)
VALUES
  -- Leadership
  ('00fa1000-0000-0000-0000-000000000001', 'Anand V',             'anand@farmwise.ai',          '$2b$12$2M5O9oF6uZ9w8oUyYfkhwOYkdquJjlzmeSppN4l0knNp3FHEax4Wy', 'CTO',                  'CEO',       'Leadership',              '#1e40af'),
  
  -- Engineering - Software (Backend)
  ('00fa1000-0101-0101-0101-000000000101', 'Siva Vignesh Sivanandam', 'siva@farmwise.ai',       '$2b$12$GPye9RsIcEjxs3IhLr0RhOyCfv/4VSJlcqM45Nx3jlHhXyl1FOoqG', 'Technical Lead',       'Team Lead', 'Software Engineering',    '#10b981'),
  ('00fa1000-0105-0105-0105-000000000105', 'Mani Bharathi R',         'manibharathi@farmwise.ai', '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Software Engineer - Backend', 'Member', 'Software Engineering', '#059669'),
  ('00fa1000-0142-0142-0142-000000000142', 'Ponmani Vasanthan M',     'ponmani@farmwise.ai',       '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Software Engineer - Backend', 'Member', 'Software Engineering', '#047857'),
  ('00fa1000-0184-0184-0184-000000000184', 'Shiva Gurunath',          'shiva@farmwise.ai',         '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Software Engineer - Backend', 'Member', 'Software Engineering', '#065f46'),
  
  -- Engineering - Software (Frontend)
  ('00fa1000-0170-0170-0170-000000000170', 'Sidharthan Durai',       'sidharthan@farmwise.ai',    '$2b$12$GPye9RsIcEjxs3IhLr0RhOyCfv/4VSJlcqM45Nx3jlHhXyl1FOoqG', 'Technical Lead',       'Team Lead', 'Software Engineering',    '#3b82f6'),
  ('00fa1000-0101-0102-0102-000000000102', 'Pradeep Raj',            'pradeep@farmwise.ai',       '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Senior Software Engineer - Frontend', 'Member', 'Software Engineering', '#2563eb'),
  ('00fa1000-0135-0135-0135-000000000135', 'Manikandan R',           'manikandan@farmwise.ai',    '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Software Engineer - Frontend', 'Member', 'Software Engineering', '#1d4ed8'),
  ('00fa1000-0133-0133-0133-000000000133', 'Manoj Prabahar R',       'manoj@farmwise.ai',         '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Software Engineer - Frontend', 'Member', 'Software Engineering', '#1e40af'),
  ('00fa1000-0181-0181-0181-000000000181', 'Gowtham P',              'gowtham@farmwise.ai',       '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Software Engineer - Frontend', 'Member', 'Software Engineering', '#3730a3'),
  ('00fa1000-0206-0206-0206-000000000206', 'Hariharan Venkatachalam', 'hariharan@farmwise.ai',    '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Software Engineer - Frontend', 'Member', 'Software Engineering', '#4338ca'),
  ('00fa1000-0188-0188-0188-000000000188', 'Meyyappan Subbiah',      'meyyappan@farmwise.ai',     '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Software Engineer',    'Member', 'Software Engineering',    '#4f46e5'),
  ('00fa1000-0204-0204-0204-000000000204', 'George Mathew Paul',     'george@farmwise.ai',        '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Software Engineer', 'Member', 'Software Engineering', '#6366f1'),
  ('00fa1000-0212-0212-0212-000000000212', 'Abinaya P',              'abinaya@farmwise.ai',       '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Software Engineer - Frontend', 'Member', 'Software Engineering', '#818cf8'),

  -- Engineering - Mobile
  ('00fa1000-0179-0179-0179-000000000179', 'Tamilmaran Varatharajan', 'tamilmaran@farmwise.ai',   '$2b$12$GPye9RsIcEjxs3IhLr0RhOyCfv/4VSJlcqM45Nx3jlHhXyl1FOoqG', 'Senior Software Engineer', 'Team Lead', 'Software Engineering', '#f59e0b'),
  ('00fa1000-0174-0174-0174-000000000174', 'Kosuru Uday Saikumar',   'uday@farmwise.ai',          '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Senior Mobile Application Developer', 'Member', 'Software Engineering', '#d97706'),
  ('00fa1000-0183-0183-0183-000000000183', 'Nithiya Sri',            'nithiya@farmwise.ai',       '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Mobile Developer', 'Member', 'Software Engineering', '#b45309'),

  -- Engineering - Testing
  ('00fa1000-0144-0144-0144-000000000144', 'Lavanya S',              'lavanya@farmwise.ai',       '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Senior Software Test Engineer', 'Member', 'Software Engineering', '#dc2626'),
  ('00fa1000-0148-0148-0148-000000000148', 'Aamirunnisa SK',         'aamirunnisa@farmwise.ai',   '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Senior Software Test Engineer', 'Member', 'Software Engineering', '#b91c1c'),

  -- Data Science
  ('00fa1000-0182-0182-0182-000000000182', 'Vishwanathan Marimuthu', 'vishwanathan@farmwise.ai',  '$2b$12$GPye9RsIcEjxs3IhLr0RhOyCfv/4VSJlcqM45Nx3jlHhXyl1FOoqG', 'Associate Data Scientist', 'Team Lead', 'Data Science', '#a855f7'),
  ('00fa1000-0195-0195-0195-000000000195', 'Navya Vijayakumar Nair', 'navya@farmwise.ai',         '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Data Scientist', 'Member', 'Data Science', '#9333ea'),
  ('00fa1000-0196-0196-0196-000000000196', 'Govindraj S',            'govindraj@farmwise.ai',     '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Data Scientist', 'Member', 'Data Science', '#7e22ce'),
  ('00fa1000-0197-0197-0197-000000000197', 'Pranav P',               'pranav@farmwise.ai',        '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Data Scientist', 'Member', 'Data Science', '#6b21a8'),
  ('00fa1000-0200-0200-0200-000000000200', 'Sathish R',              'sathish@farmwise.ai',       '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Data Scientist', 'Member', 'Data Science', '#581c87'),

  -- GIS
  ('00fa1000-0118-0118-0118-000000000118', 'Rahulji Manivannan',    'rahulji@farmwise.ai',       '$2b$12$GPye9RsIcEjxs3IhLr0RhOyCfv/4VSJlcqM45Nx3jlHhXyl1FOoqG', 'Head - GIS',           'Team Lead', 'Geographic Information System', '#0891b2'),
  ('00fa1000-0115-0115-0115-000000000115', 'Divya Kala S',           'divya@farmwise.ai',         '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Lead- GIS Analyst',    'Member', 'Geographic Information System', '#06b6d4'),
  ('00fa1000-0114-0114-0114-000000000114', 'Jenifer J',              'jenifer@farmwise.ai',       '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'GIS Analyst',          'Member', 'Geographic Information System', '#22d3ee'),
  ('00fa1000-0127-0127-0127-000000000127', 'Jensi Priya',            'jensi@farmwise.ai',         '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'GIS Analyst',          'Member', 'Geographic Information System', '#67e8f9'),
  ('00fa1000-0157-0157-0157-000000000157', 'Naveen C',               'naveen@farmwise.ai',        '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'GIS Analyst',          'Member', 'Geographic Information System', '#a5f3fc'),
  ('00fa1000-0166-0166-0166-000000000166', 'Praveen Kumar',          'praveenk@farmwise.ai',      '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'GIS Analyst',          'Member', 'Geographic Information System', '#cffafe'),
  ('00fa1000-0203-0203-0203-000000000203', 'Akash Saravanan',        'akash@farmwise.ai',         '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'GIS Analyst',          'Member', 'Geographic Information System', '#ecfeff'),

  -- Remote Sensing
  ('00fa1000-0139-0139-0139-000000000139', 'Keerthana R',            'keerthana@farmwise.ai',     '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Software Engineer - Remote Sensing', 'Member', 'Remote Sensing', '#14b8a6'),
  ('00fa1000-0193-0193-0193-000000000193', 'Amal Sugathan',          'amal@farmwise.ai',          '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Geospatial Data Analyst', 'Member', 'Remote Sensing', '#0d9488'),
  ('00fa1000-0194-0194-0194-000000000194', 'Malavika S Krishnan',    'malavika@farmwise.ai',      '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Geospatial Data Analyst', 'Member', 'Remote Sensing', '#0f766e'),

  -- Drone
  ('00fa1000-0124-0124-0124-000000000124', 'Manimaran V',            'manimaran@farmwise.ai',     '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Drone System Engineer', 'Member', 'Drone', '#ca8a04'),
  ('00fa1000-0171-0171-0171-000000000171', 'Aswin Kumar Gandhi',     'aswin@farmwise.ai',         '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Senior Engineer - Drone Operations', 'Member', 'Drone', '#a16207'),

  -- Product
  ('00fa1000-0107-0107-0107-000000000107', 'Mukilan Ravichandran',   'mukilan@farmwise.ai',       '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate UI UX Designer', 'Member', 'Product', '#ec4899'),
  ('00fa1000-0164-0164-0164-000000000164', 'Pradeep Raj P',          'pradeepraj@farmwise.ai',    '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'UI UX Designer',       'Member', 'Product',              '#db2777'),
  ('00fa1000-0175-0175-0175-000000000175', 'Veeramani L',            'veeramani@farmwise.ai',     '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Business Analyst',     'Member', 'Product',              '#be185d'),
  ('00fa1000-0186-0186-0186-000000000186', 'Yogesh Palanivel Veluchamy Suresh', 'yogesh@farmwise.ai', '$2b$12$GPye9RsIcEjxs3IhLr0RhOyCfv/4VSJlcqM45Nx3jlHhXyl1FOoqG', 'Lead Business Analyst', 'Team Lead', 'Product', '#9d174d'),
  ('00fa1000-0198-0198-0198-000000000198', 'Jishnu Rajan',           'jishnu@farmwise.ai',        '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Product Analyst', 'Member', 'Product', '#831843'),
  ('00fa1000-0199-0199-0199-000000000199', 'Madhumitha Muthuselvan', 'madhumitha@farmwise.ai',    '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Business Analyst', 'Member', 'Product', '#701a75'),
  ('00fa1000-0213-0213-0213-000000000213', 'Ramesh Chandra Narra',   'ramesh@farmwise.ai',        '$2b$12$37scFljw7mRQ9lM5gpiq7uTyZ49xlXaOs1VBKwrsYkNV.iLJGuDYu', 'Associate Product Analyst', 'Member', 'Product', '#86198f'),

  -- Leadership/Other
  ('00fa1000-0001-0001-0001-000000000001', 'Purushothaman .',        'purushothaman@farmwise.ai', '$2b$12$2M5O9oF6uZ9w8oUyYfkhwOYkdquJjlzmeSppN4l0knNp3FHEax4Wy', 'VP Engineering',       'CEO',       'Leadership',              '#64748b'),
  ('00fa1000-0002-0002-0002-000000000002', 'Judge Raja Ramadurai',   'judge@farmwise.ai',         '$2b$12$GPye9RsIcEjxs3IhLr0RhOyCfv/4VSJlcqM45Nx3jlHhXyl1FOoqG', 'Director - Drone & RS', 'Team Lead', 'Leadership',              '#475569'),

  -- Interns
  ('00fa1000-9001-9001-9001-000000000001', 'Kousik A M',             'kousik@farmwise.ai',        '$2b$12$ZwqnPaYQQoIRY6PsehlRceV7w379s0vhnj0X/51s/Az5ED26a.bbu', 'Intern - Backend Engineer', 'Member', 'Software Engineering', '#94a3b8'),
  ('00fa1000-9002-9002-9002-000000000002', 'Jaynithi M',             'jaynithi@farmwise.ai',      '$2b$12$ZwqnPaYQQoIRY6PsehlRceV7w379s0vhnj0X/51s/Az5ED26a.bbu', 'Intern - Product Analyst', 'Member', 'Product', '#94a3b8')
ON CONFLICT (email) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- PROJECTS (Active projects from the Ongoing Project Reference sheet)
-- ────────────────────────────────────────────────────────────
INSERT INTO projects
  (id, title, type, requirement, objective, outcome_type, outcome_description,
   status, priority, owner_id, current_phase, timebox_days, start_date,
   tech_stack, ai_plan)
VALUES
  (
    '00b10c00-0001-0001-0001-000000000001',
    'SIPCOT - Land Management Portal',
    'engineering',
    'Comprehensive land management portal for SIPCOT with GIS integration, parcel mapping, workflow automation, and reporting dashboard.',
    'Digital transformation of SIPCOT land records and management processes',
    'web_application',
    'Production-ready land management portal with GIS mapping, document management, and workflow automation',
    'active', 'high',
    '00fa1000-0170-0170-0170-000000000170', -- Sidharthan Durai
    'Development', 240, '2025-11-01',
    '["React", "Node.js", "PostgreSQL", "PostGIS", "Python", "AWS", "Docker"]',
    '{"summary": "Full-stack land management portal with GIS parcel mapping, multi-role workflow, document digitization, and analytics", "risks": [{"risk": "GIS data accuracy and completeness from SIPCOT", "mitigation": "Validation pipeline + field verification workflow", "severity": "high"}, {"risk": "Multiple stakeholder approval delays", "mitigation": "Dedicated BA for stakeholder management", "severity": "medium"}], "killCriteria": ["System cannot handle 5000+ parcels", "GIS rendering > 3 seconds"]}'
  ),
  (
    '00b10c00-0002-0002-0002-000000000002',
    'CCMC - Door to Door Survey',
    'engineering',
    'Mobile-first survey application for Coimbatore City Municipal Corporation door-to-door data collection with offline support and GIS integration.',
    'Enable efficient digital door-to-door survey covering all households in Coimbatore corporation limits',
    'mobile_application',
    'Survey mobile app with offline capability, GIS tagging, and real-time dashboard',
    'active', 'high',
    '00fa1000-0118-0118-0118-000000000118', -- Rahulji Manivannan
    'In Progress', 270, '2024-11-01',
    '["Flutter", "PostgreSQL", "PostGIS", "Node.js", "Python"]',
    '{"summary": "Mobile survey app with offline-first architecture, household geo-tagging, and admin dashboard with analytics", "risks": [{"risk": "Offline sync conflicts", "mitigation": "CRDT-based conflict resolution", "severity": "medium"}, {"risk": "Surveyor training and adoption", "mitigation": "Train-the-trainer program + in-app guidance", "severity": "medium"}], "killCriteria": ["App sync failure rate > 5%", "Survey completion < 80% of target"]}'
  ),
  (
    '00b10c00-0003-0003-0003-000000000003',
    'GHMC - GIS Intelligence System',
    'engineering',
    'Web GIS application with QR-based mobile app for Greater Hyderabad Municipal Corporation asset mapping and intelligence.',
    'GIS-powered asset intelligence system with QR code tagging for municipal asset management',
    'web_application',
    'GIS web portal and QR mobile app for municipal asset tracking and intelligence',
    'active', 'high',
    '00fa1000-0179-0179-0179-000000000179', -- Tamilmaran Varatharajan
    'Client Review', 102, '2026-02-18',
    '["React", "Node.js", "PostgreSQL", "PostGIS", "Leaflet", "Flutter", "Python"]',
    '{"summary": "GIS intelligence system with web admin portal and QR-based mobile app for asset discovery and survey", "risks": [{"risk": "Running delay as noted in tracker", "mitigation": "Additional frontend and backend resources allocated", "severity": "high"}, {"risk": "QR code scanning reliability in field conditions", "mitigation": "Multiple format support + fallback manual entry", "severity": "medium"}], "killCriteria": ["Mobile QR scan > 2 seconds in good lighting", "Web map load > 4 seconds"]}'
  ),
  (
    '00b10c00-0004-0004-0004-000000000004',
    'GIS and Site Suitability Tasks',
    'engineering',
    'Ongoing GIS analysis and site suitability assessments for SIPCOT industrial park planning.',
    'Deliver comprehensive GIS-based site suitability analysis for industrial park locations',
    'data_service',
    'GIS analysis reports, suitability maps, and spatial datasets for SIPCOT decision-making',
    'active', 'medium',
    '00fa1000-0118-0118-0118-000000000118', -- Rahulji Manivannan
    'In Progress', 790, '2024-11-01',
    '["QGIS", "Python", "PostGIS", "ArcGIS", "Remote Sensing Data"]',
    '{"summary": "Multi-criteria GIS suitability analysis using weighted overlay, proximity analysis, and terrain modelling", "risks": [{"risk": "Data currency for land use and infrastructure layers", "mitigation": "Cross-validate with satellite imagery and field surveys", "severity": "medium"}], "killCriteria": ["Analysis accuracy < 85% when validated against ground truth"]}'
  ),
  (
    '00b10c00-0005-0005-0005-000000000005',
    'TNSDMA - Feedback System',
    'engineering',
    'Feedback system integration for Tamil Nadu State Disaster Management Authority with real-time collection, analysis, and reporting.',
    'Enable structured feedback collection and analysis for disaster management operations',
    'web_application',
    'Feedback collection and analytics platform with role-based dashboards',
    'active', 'high',
    '00fa1000-0186-0186-0186-000000000186', -- Yogesh Palanivel
    'In Progress', 116, '2026-03-06',
    '["React", "Node.js", "PostgreSQL", "Python", "Apache Airflow"]',
    '{"summary": "Multi-stakeholder feedback system with question builder, response analytics, and automated report generation", "risks": [{"risk": "Integration with TNSDMA legacy systems", "mitigation": "API-first design with adapter pattern", "severity": "medium"}], "killCriteria": ["Report generation > 30 seconds", "Response collection failure rate > 1%"]}'
  ),
  (
    '00b10c00-0006-0006-0006-000000000006',
    'Field Inspection Management System – Yadadri Bhuvanagiri Collectorate',
    'engineering',
    'Mobile-first field inspection management system for Yadadri Bhuvanagiri collectorate with offline data collection, photo documentation, and workflow management.',
    'Digitize and streamline field inspection workflows for the collectorate',
    'mobile_application',
    'Inspection management system with mobile app and admin dashboard',
    'active', 'high',
    '00fa1000-0000-0000-0000-000000000001', -- Anand V
    'Roll Out', 40, '2026-04-01',
    '["Flutter", "Node.js", "PostgreSQL", "AWS S3", "Python"]',
    '{"summary": "Field inspection app with offline data capture, photo upload, GPS tagging, and workflow-based inspection management", "risks": [{"risk": "Tight 40-day timeline", "mitigation": "Dedicated cross-functional team assigned", "severity": "high"}, {"risk": "Device compatibility with collectorate hardware", "mitigation": "Device testing matrix during development", "severity": "medium"}], "killCriteria": ["App crashes > 2% of inspection sessions", "Data sync fails for offline inspections"]}'
  ),
  (
    '00b10c00-0007-0007-0007-000000000007',
    'Drone Maps SaaS AI',
    'data_science',
    'AI-powered drone mapping SaaS platform with automated orthomosaic generation, object detection, and analytics for agriculture.',
    'Build an AI-first drone mapping platform for precision agriculture',
    'saas_platform',
    'Drone mapping SaaS with AI analytics, automated processing pipeline, and 3D visualization',
    'active', 'high',
    '00fa1000-0105-0105-0105-000000000105', -- Siva Vignesh Sivanandam
    'Demo Phase', 180, '2025-12-01',
    '["Python", "React", "Three.js", "PyTorch", "GDAL", "AWS", "Kubernetes"]',
    '{"summary": "Drone imagery processing pipeline with AI-based crop analysis, 3D terrain models, and time-series vegetation indices", "risks": [{"risk": "Variable drone image quality affecting AI accuracy", "mitigation": "Pre-processing quality check + auto-rejection of low-quality inputs", "severity": "high"}, {"risk": "Processing pipeline scalability for large farms", "mitigation": "Serverless architecture with auto-scaling", "severity": "medium"}], "killCriteria": ["Orthomosaic generation > 30 min for 100-acre farm", "AI crop detection accuracy < 85%"]}'
  ),
  (
    '00b10c00-0008-0008-0008-000000000008',
    'TNIAMP - WRD AMC',
    'operations',
    'Annual maintenance contract for TNIAMP Water Resources Department applications including support, bug fixes, and minor enhancements.',
    'Ensure 99.9% uptime and timely support for WRD production applications',
    'service',
    'AMC service delivery with SLA compliance, support ticketing, and quarterly reviews',
    'active', 'medium',
    '00fa1000-0170-0170-0170-000000000170', -- Sidharthan Durai
    'AMC / Support', 365, '2024-01-02',
    '["Various - dependent on application stack"]',
    '{"summary": "Ongoing AMC with L1/L2/L3 support tiers, monthly patching, and performance monitoring", "risks": [{"risk": "Multiple applications with different tech stacks", "mitigation": "Documented runbooks and cross-trained team", "severity": "low"}], "killCriteria": ["SLA breach > 2 consecutive months"]}'
  ),
  (
    '00b10c00-0009-0009-0009-000000000009',
    'Gen AI For Financial Profile For Individuals (Video)',
    'data_science',
    'AI-powered video-based financial profile generation for Experian India using GenAI and computer vision.',
    'Create personalized financial profile videos using AI-driven content generation',
    'ai_service',
    'AI video generation platform for personalized financial profiles',
    'active', 'high',
    '00fa1000-0186-0186-0186-000000000186', -- Yogesh Palanivel
    'In Progress', 121, '2026-04-01',
    '["Python", "GenAI", "Computer Vision", "AWS", "React"]',
    '{"summary": "GenAI pipeline for video content generation with personalization engine based on financial data points", "risks": [{"risk": "GenAI output quality and consistency", "mitigation": "Human-in-the-loop review + quality scoring", "severity": "high"}, {"risk": "Data privacy compliance for financial data", "mitigation": "Data isolation + encryption at rest and in transit", "severity": "high"}], "killCriteria": ["Video generation > 5 minutes per profile", "Content accuracy < 95%"]}'
  ),
  (
    '00b10c00-0010-0010-0010-000000000010',
    'Real Estate Platform – Land-wise',
    'engineering',
    'Internal platform for land parcel discovery, comparison, and suitability analysis using GIS and market data.',
    'Build a land discovery platform integrating GIS, market data, and property analytics',
    'web_application',
    'Land discovery platform with comparative analysis and investment insights',
    'active', 'medium',
    '00fa1000-0118-0118-0118-000000000118', -- Rahulji Manivannan
    'Internal', 90, '2026-03-01',
    '["React", "Node.js", "PostgreSQL", "PostGIS", "Python"]',
    '{"summary": "Land discovery platform with parcel search, comparison tools, market analytics, and suitability scoring", "risks": [{"risk": "Data sourcing for market prices and transaction history", "mitigation": "Multiple data source aggregation + confidence scoring", "severity": "medium"}], "killCriteria": ["Search latency > 2 seconds", "Data coverage < 60% for target regions"]}'
  )
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- PROJECT ASSIGNEES (based on allocation percentages in Excel)
-- ────────────────────────────────────────────────────────────
INSERT INTO project_assignees (project_id, user_id)
VALUES
  -- SIPCOT LMP (proj-0001)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0170-0170-0170-000000000170'), -- Sidharthan (100%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0101-0102-0102-000000000102'), -- Pradeep Raj (100%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0105-0105-0105-000000000105'), -- Mani Bharathi (100%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0179-0179-0179-000000000179'), -- Tamilmaran (100%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0181-0181-0181-000000000181'), -- Gowtham (100%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0148-0148-0148-000000000148'), -- Aamirunnisa (100%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0183-0183-0183-000000000183'), -- Nithiya Sri (100%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0164-0164-0164-000000000164'), -- Pradeep Raj P (100%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0188-0188-0188-000000000188'), -- Meyyappan (100%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0195-0195-0195-000000000195'), -- Navya (100%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0204-0204-0204-000000000204'), -- George (100%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0206-0206-0206-000000000206'), -- Hariharan (100%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0135-0135-0135-000000000135'), -- Manikandan (30%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0133-0133-0133-000000000133'), -- Manoj (20%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0142-0142-0142-000000000142'), -- Ponmani (0.2%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0115-0115-0115-000000000115'), -- Divya Kala (0.1%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0118-0118-0118-000000000118'), -- Rahulji (0.2%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0186-0186-0186-000000000186'), -- Yogesh (0.1%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0198-0198-0198-000000000198'), -- Jishnu (0.2%)
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0107-0107-0107-000000000107'), -- Mukilan (0%)

  -- CCMC Survey (proj-0002)
  ('00b10c00-0002-0002-0002-000000000002', '00fa1000-0118-0118-0118-000000000118'), -- Rahulji (10%)
  ('00b10c00-0002-0002-0002-000000000002', '00fa1000-0157-0157-0157-000000000157'), -- Naveen (100%)
  ('00b10c00-0002-0002-0002-000000000002', '00fa1000-0166-0166-0166-000000000166'), -- Praveen Kumar (100%)
  ('00b10c00-0002-0002-0002-000000000002', '00fa1000-0175-0175-0175-000000000175'), -- Veeramani (100%)
  ('00b10c00-0002-0002-0002-000000000002', '00fa1000-0114-0114-0114-000000000114'), -- Jenifer (0%)
  ('00b10c00-0002-0002-0002-000000000002', '00fa1000-0115-0115-0115-000000000115'), -- Divya Kala (0%)
  ('00b10c00-0002-0002-0002-000000000002', '00fa1000-0127-0127-0127-000000000127'), -- Jensi (0%)
  ('00b10c00-0002-0002-0002-000000000002', '00fa1000-0203-0203-0203-000000000203'), -- Akash (0%)

  -- GHMC GIS (proj-0003)
  ('00b10c00-0003-0003-0003-000000000003', '00fa1000-0179-0179-0179-000000000179'), -- Tamilmaran
  ('00b10c00-0003-0003-0003-000000000003', '00fa1000-0107-0107-0107-000000000107'), -- Mukilan (60%)
  ('00b10c00-0003-0003-0003-000000000003', '00fa1000-0133-0133-0133-000000000133'), -- Manoj (20%)
  ('00b10c00-0003-0003-0003-000000000003', '00fa1000-0174-0174-0174-000000000174'), -- Uday (30%)
  ('00b10c00-0003-0003-0003-000000000003', '00fa1000-0184-0184-0184-000000000184'), -- Shiva Gurunath (50%)
  ('00b10c00-0003-0003-0003-000000000003', '00fa1000-0144-0144-0144-000000000144'), -- Lavanya (0%)
  ('00b10c00-0003-0003-0003-000000000003', '00fa1000-0213-0213-0213-000000000213'), -- Ramesh (40%)

  -- GIS Site Suitability (proj-0004)
  ('00b10c00-0004-0004-0004-000000000004', '00fa1000-0118-0118-0118-000000000118'), -- Rahulji (30%)
  ('00b10c00-0004-0004-0004-000000000004', '00fa1000-0114-0114-0114-000000000114'), -- Jenifer (100%)
  ('00b10c00-0004-0004-0004-000000000004', '00fa1000-0115-0115-0115-000000000115'), -- Divya Kala (100%)
  ('00b10c00-0004-0004-0004-000000000004', '00fa1000-0127-0127-0127-000000000127'), -- Jensi (100%)
  ('00b10c00-0004-0004-0004-000000000004', '00fa1000-0157-0157-0157-000000000157'), -- Naveen (5%)
  ('00b10c00-0004-0004-0004-000000000004', '00fa1000-0166-0166-0166-000000000166'), -- Praveen Kumar (0%)
  ('00b10c00-0004-0004-0004-000000000004', '00fa1000-0203-0203-0203-000000000203'), -- Akash (100%)
  ('00b10c00-0004-0004-0004-000000000004', '00fa1000-0186-0186-0186-000000000186'), -- Yogesh (0%)

  -- TNSDMA Feedback (proj-0005)
  ('00b10c00-0005-0005-0005-000000000005', '00fa1000-0186-0186-0186-000000000186'), -- Yogesh (50%)
  ('00b10c00-0005-0005-0005-000000000005', '00fa1000-0105-0105-0105-000000000105'), -- Siva Vignesh (50%)
  ('00b10c00-0005-0005-0005-000000000005', '00fa1000-0144-0144-0144-000000000144'), -- Lavanya (40%)

  -- Yadadri FIMS (proj-0006)
  ('00b10c00-0006-0006-0006-000000000006', '00fa1000-0000-0000-0000-000000000001'), -- Anand V
  ('00b10c00-0006-0006-0006-000000000006', '00fa1000-0133-0133-0133-000000000133'), -- Manoj (40%)
  ('00b10c00-0006-0006-0006-000000000006', '00fa1000-0144-0144-0144-000000000144'), -- Lavanya (50%)
  ('00b10c00-0006-0006-0006-000000000006', '00fa1000-0196-0196-0196-000000000196'), -- Govindraj (40%)
  ('00b10c00-0006-0006-0006-000000000006', '00fa1000-0197-0197-0197-000000000197'), -- Pranav (40%)
  ('00b10c00-0006-0006-0006-000000000006', '00fa1000-0200-0200-0200-000000000200'), -- Sathish (50%)
  ('00b10c00-0006-0006-0006-000000000006', '00fa1000-0164-0164-0164-000000000164'), -- Pradeep Raj P (0%)
  ('00b10c00-0006-0006-0006-000000000006', '00fa1000-0179-0179-0179-000000000179'), -- Tamilmaran (0%)
  ('00b10c00-0006-0006-0006-000000000006', '00fa1000-0198-0198-0198-000000000198'), -- Jishnu (0%)

  -- Drone Maps AI (proj-0007)
  ('00b10c00-0007-0007-0007-000000000007', '00fa1000-0105-0105-0105-000000000105'), -- Siva Vignesh (20%)
  ('00b10c00-0007-0007-0007-000000000007', '00fa1000-0135-0135-0135-000000000135'), -- Manikandan (40%)
  ('00b10c00-0007-0007-0007-000000000007', '00fa1000-0139-0139-0139-000000000139'), -- Keerthana (70%)
  ('00b10c00-0007-0007-0007-000000000007', '00fa1000-0182-0182-0182-000000000182'), -- Vishwanathan (20%)
  ('00b10c00-0007-0007-0007-000000000007', '00fa1000-0193-0193-0193-000000000193'), -- Amal (30%)
  ('00b10c00-0007-0007-0007-000000000007', '00fa1000-0194-0194-0194-000000000194'), -- Malavika (30%)
  ('00b10c00-0007-0007-0007-000000000007', '00fa1000-0196-0196-0196-000000000196'), -- Govindraj (20%)
  ('00b10c00-0007-0007-0007-000000000007', '00fa1000-0197-0197-0197-000000000197'), -- Pranav (20%)
  ('00b10c00-0007-0007-0007-000000000007', '00fa1000-0101-0102-0102-000000000102'), -- Pradeep Raj (0%)
  ('00b10c00-0007-0007-0007-000000000007', '00fa1000-0179-0179-0179-000000000179'), -- Tamilmaran (0%)
  ('00b10c00-0007-0007-0007-000000000007', '00fa1000-0107-0107-0107-000000000107'), -- Mukilan (0%)

  -- TNIAMP WRD AMC (proj-0008)
  ('00b10c00-0008-0008-0008-000000000008', '00fa1000-0170-0170-0170-000000000170'), -- Sidharthan
  ('00b10c00-0008-0008-0008-000000000008', '00fa1000-0101-0102-0102-000000000102'), -- Pradeep Raj (50%)
  ('00b10c00-0008-0008-0008-000000000008', '00fa1000-0105-0105-0105-000000000105'), -- Siva Vignesh (10%)
  ('00b10c00-0008-0008-0008-000000000008', '00fa1000-0135-0135-0135-000000000135'), -- Manikandan (20%)
  ('00b10c00-0008-0008-0008-000000000008', '00fa1000-0142-0142-0142-000000000142'), -- Ponmani (20%)
  ('00b10c00-0008-0008-0008-000000000008', '00fa1000-0148-0148-0148-000000000148'), -- Aamirunnisa (30%)
  ('00b10c00-0008-0008-0008-000000000008', '00fa1000-0175-0175-0175-000000000175'), -- Veeramani (30%)
  ('00b10c00-0008-0008-0008-000000000008', '00fa1000-0179-0179-0179-000000000179'), -- Tamilmaran
  ('00b10c00-0008-0008-0008-000000000008', '00fa1000-0181-0181-0181-000000000181'), -- Gowtham (20%)

  -- Experian GenAI (proj-0009)
  ('00b10c00-0009-0009-0009-000000000009', '00fa1000-0186-0186-0186-000000000186'), -- Yogesh (30%)
  ('00b10c00-0009-0009-0009-000000000009', '00fa1000-0184-0184-0184-000000000184'), -- Shiva Gurunath (50%)
  ('00b10c00-0009-0009-0009-000000000009', '00fa1000-0197-0197-0197-000000000197'), -- Pranav (60%)
  ('00b10c00-0009-0009-0009-000000000009', '00fa1000-0144-0144-0144-000000000144'), -- Lavanya (0%)

  -- Real Estate Platform (proj-0010)
  ('00b10c00-0010-0010-0010-000000000010', '00fa1000-0118-0118-0118-000000000118'), -- Rahulji
  ('00b10c00-0010-0010-0010-000000000010', '00fa1000-0164-0164-0164-000000000164'), -- Pradeep Raj P (40%)
  ('00b10c00-0010-0010-0010-000000000010', '00fa1000-0182-0182-0182-000000000182'), -- Vishwanathan (30%)
  ('00b10c00-0010-0010-0010-000000000010', '00fa1000-9001-9001-9001-000000000001'), -- Kousik (80%)
  ('00b10c00-0010-0010-0010-000000000010', '00fa1000-9002-9002-9002-000000000002')  -- Jaynithi (80%)
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- PROJECT CO-OWNERS
-- ────────────────────────────────────────────────────────────
INSERT INTO project_co_owners (project_id, user_id)
VALUES
  ('00b10c00-0001-0001-0001-000000000001', '00fa1000-0179-0179-0179-000000000179'), -- Tamilmaran co-owns SIPCOT LMP
  ('00b10c00-0003-0003-0003-000000000003', '00fa1000-0107-0107-0107-000000000107'), -- Mukilan co-owns GHMC
  ('00b10c00-0005-0005-0005-000000000005', '00fa1000-0105-0105-0105-000000000105'), -- Siva Vignesh co-owns TNSDMA
  ('00b10c00-0006-0006-0006-000000000006', '00fa1000-0133-0133-0133-000000000133'), -- Manoj co-owns Yadadri FIMS
  ('00b10c00-0007-0007-0007-000000000007', '00fa1000-0139-0139-0139-000000000139'), -- Keerthana co-owns Drone Maps
  ('00b10c00-0009-0009-0009-000000000009', '00fa1000-0197-0197-0197-000000000197')  -- Pranav co-owns Experian GenAI
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- PHASES (for active projects)
-- ────────────────────────────────────────────────────────────
INSERT INTO phases
  (id, project_id, phase_name, status, checklist, order_index,
   sign_off_required, estimated_duration, started_at, completed_at)
VALUES
  -- SIPCOT LMP phases
  ('00b40001-0000-0100-0000-000000000001', '00b10c00-0001-0001-0001-000000000001',
   'Requirements & Planning', 'completed',
   '["Define scope with SIPCOT", "Stakeholder interviews", "Requirements document approved"]',
   0, TRUE, '14 days', '2025-11-01 00:00:00', '2025-11-15 00:00:00'),
  ('00b40001-0000-0200-0000-000000000002', '00b10c00-0001-0001-0001-000000000001',
   'Architecture & Design', 'completed',
   '["System architecture design", "Database schema", "API contracts", "UI/UX wireframes"]',
   1, TRUE, '30 days', '2025-11-16 00:00:00', '2025-12-15 00:00:00'),
  ('00b40001-0000-0300-0000-000000000003', '00b10c00-0001-0001-0001-000000000001',
   'Development', 'active',
   '["Core modules development", "GIS integration", "Document management", "Workflow engine"]',
   2, FALSE, '120 days', '2025-12-16 00:00:00', NULL),
  ('00b40001-0000-0400-0000-000000000004', '00b10c00-0001-0001-0001-000000000001',
   'Testing & QA', 'pending',
   '["Integration testing", "Performance testing", "UAT with SIPCOT"]',
   3, FALSE, '30 days', NULL, NULL),
  ('00b40001-0000-0500-0000-000000000005', '00b10c00-0001-0001-0001-000000000001',
   'Deployment', 'pending',
   '["Production deployment", "Data migration", "Go-live"]',
   4, TRUE, '14 days', NULL, NULL),

  -- GHMC phases
  ('00b40003-0000-0100-0000-000000000001', '00b10c00-0003-0003-0003-000000000003',
   'Requirements & Planning', 'completed',
   '["GHMC requirement gathering", "Asset taxonomy definition", "QR code specification"]',
   0, TRUE, '10 days', '2026-02-18 00:00:00', '2026-02-28 00:00:00'),
  ('00b40003-0000-0200-0000-000000000002', '00b10c00-0003-0003-0003-000000000003',
   'Development', 'active',
   '["Web GIS portal", "QR mobile app", "Asset database", "Admin dashboard"]',
   1, FALSE, '45 days', '2026-03-01 00:00:00', NULL),
  ('00b40003-0000-0300-0000-000000000003', '00b10c00-0003-0003-0003-000000000003',
   'Client Review', 'active',
   '["GHMC review session", "Feedback incorporation", "Final sign-off"]',
   2, TRUE, '20 days', '2026-04-15 00:00:00', NULL),

  -- TNSDMA Feedback phases
  ('00b40005-0000-0100-0000-000000000001', '00b10c00-0005-0005-0005-000000000005',
   'Requirements & Planning', 'completed',
   '["TNSDMA stakeholder meetings", "Feedback workflow mapping", "Integration points identified"]',
   0, TRUE, '10 days', '2026-03-06 00:00:00', '2026-03-16 00:00:00'),
  ('00b40005-0000-0200-0000-000000000002', '00b10c00-0005-0005-0005-000000000005',
   'Development', 'active',
   '["Feedback collection module", "Analytics dashboard", "Report generation", "API integrations"]',
   1, FALSE, '45 days', '2026-03-17 00:00:00', NULL),
  ('00b40005-0000-0300-0000-000000000003', '00b10c00-0005-0005-0005-000000000005',
   'UAT & Deployment', 'pending',
   '["TNSDMA UAT", "Performance testing", "Production deployment"]',
   2, TRUE, '20 days', NULL, NULL),

  -- Yadadri FIMS phases
  ('00b40006-0000-0100-0000-000000000001', '00b10c00-0006-0006-0006-000000000006',
   'Requirements & Planning', 'completed',
   '["Collectorate requirement study", "Inspection workflow mapping", "Offline requirement analysis"]',
   0, TRUE, '5 days', '2026-04-01 00:00:00', '2026-04-05 00:00:00'),
  ('00b40006-0000-0200-0000-000000000002', '00b10c00-0006-0006-0006-000000000006',
   'Development', 'active',
   '["Mobile app development", "Admin dashboard", "Offline sync engine", "Photo documentation"]',
   1, FALSE, '20 days', '2026-04-06 00:00:00', NULL),
  ('00b40006-0000-0300-0000-000000000003', '00b10c00-0006-0006-0006-000000000006',
   'Roll Out', 'active',
   '["Field testing", "Training", "Go-live"]',
   2, TRUE, '10 days', '2026-04-26 00:00:00', NULL),

  -- Drone Maps AI phases
  ('00b40007-0000-0100-0000-000000000001', '00b10c00-0007-0007-0007-000000000007',
   'Research & Prototype', 'completed',
   '["Drone imagery analysis", "AI model selection", "Processing pipeline prototype"]',
   0, TRUE, '30 days', '2025-12-01 00:00:00', '2026-01-01 00:00:00'),
  ('00b40007-0000-0200-0000-000000000002', '00b10c00-0007-0007-0007-000000000007',
   'Core Development', 'active',
   '["Processing pipeline", "AI model training", "Web platform UI", "3D visualization"]',
   1, FALSE, '90 days', '2026-01-02 00:00:00', NULL),
  ('00b40007-0000-0300-0000-000000000003', '00b10c00-0007-0007-0007-000000000007',
   'Demo Phase', 'active',
   '["Demo preparation", "Beta testing", "Investor/funder demos"]',
   2, TRUE, '30 days', '2026-04-01 00:00:00', NULL),

  -- Experian GenAI phases
  ('00b40009-0000-0100-0000-000000000001', '00b10c00-0009-0009-0009-000000000009',
   'Requirements & Planning', 'completed',
   '["Experian requirement analysis", "Data privacy compliance review", "AI model architecture"]',
   0, TRUE, '10 days', '2026-04-01 00:00:00', '2026-04-10 00:00:00'),
  ('00b40009-0000-0200-0000-000000000002', '00b10c00-0009-0009-0009-000000000009',
   'Development', 'active',
   '["GenAI pipeline", "Video generation engine", "Financial data integration", "Review dashboard"]',
   1, FALSE, '50 days', '2026-04-11 00:00:00', NULL),
  ('00b40009-0000-0300-0000-000000000003', '00b10c00-0009-0009-0009-000000000009',
   'UAT & Compliance', 'pending',
   '["Experian UAT", "Security audit", "Production deployment"]',
   2, TRUE, '20 days', NULL, NULL)
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- TASKS (key tasks for active phases)
-- ────────────────────────────────────────────────────────────
INSERT INTO tasks
  (id, project_id, phase_id, title, description, assignee_id, status, priority,
   estimated_hours, approach, plan_status, success_criteria, kill_criteria, order_index)
VALUES
  -- SIPCOT LMP Development tasks
  ('0000ee00-0001-0001-0000-000000000001', '00b10c00-0001-0001-0001-000000000001',
   '00b40001-0000-0300-0000-000000000003',
   'GIS Parcel Mapping Module',
   'Implement PostGIS-based parcel mapping with interactive Leaflet map, parcel search, and spatial queries.',
   '00fa1000-0118-0118-0118-000000000118', -- Rahulji
   'in_progress', 'high', 80.0,
   'PostGIS spatial queries with Leaflet frontend. GeoJSON-based parcel rendering with WebGL for performance.',
   'finalized',
   '["5000+ parcels render < 3 seconds", "Spatial search returns in < 500ms", "Parcel editing with version history"]',
   '["Map rendering > 5 seconds for 1000 parcels", "PostGIS query planner shows sequential scan"]',
   0),
  ('0000ee00-0002-0002-0000-000000000002', '00b10c00-0001-0001-0001-000000000001',
   '00b40001-0000-0300-0000-000000000003',
   'Document Management Workflow',
   'Build document upload, OCR, approval workflow, and archival system for land records.',
   '00fa1000-0170-0170-0170-000000000170', -- Sidharthan
   'in_progress', 'high', 60.0,
   'React-based document uploader with Node.js backend. Tesseract OCR for document digitization.',
   'finalized',
   '["Document upload < 10 seconds for 10MB file", "OCR accuracy > 90%", "Approval workflow with configurable steps"]',
   '["OCR accuracy < 80% on clean documents", "Workflow state machine deadlocks detected"]',
   1),
  ('0000ee00-0003-0003-0000-000000000003', '00b10c00-0001-0001-0001-000000000001',
   '00b40001-0000-0300-0000-000000000003',
   'Frontend Component Library',
   'Build reusable React component library with design system consistency for LMP portal.',
   '00fa1000-0101-0102-0102-000000000102', -- Pradeep Raj
   'in_progress', 'medium', 40.0,
   'Atomic design methodology. Components with Storybook documentation and unit tests.',
   'finalized',
   '["40+ reusable components", "100% unit test coverage", "Storybook with interactive examples"]',
   '["Bundle size > 500KB for core components", "Theme switching breaks layout"]',
   2),

  -- GHMC Development tasks
  ('0000ee00-0004-0004-0000-000000000004', '00b10c00-0003-0003-0003-000000000003',
   '00b40003-0000-0200-0000-000000000002',
   'QR Mobile App Development',
   'Build Flutter-based mobile app for QR-based asset discovery, survey data collection, and photo capture.',
   '00fa1000-0179-0179-0179-000000000179', -- Tamilmaran
   'in_progress', 'high', 60.0,
   'Flutter with GetX state management. Offline-first with SQLite sync. Camera plugin for QR and photo.',
   'finalized',
   '["QR scan < 2 seconds", "Offline survey data syncs correctly", "Photo upload with auto-compression"]',
   '["QR scan failure rate > 10%", "Sync conflicts corrupting survey data"]',
   0),
  ('0000ee00-0005-0005-0000-000000000005', '00b10c00-0003-0003-0003-000000000003',
   '00b40003-0000-0200-0000-000000000002',
   'GIS Intelligence Dashboard',
   'Web GIS dashboard with asset heatmaps, clustering, search, and analytics widgets.',
   '00fa1000-0133-0133-0133-000000000133', -- Manoj
   'in_progress', 'high', 50.0,
   'React + Leaflet for GIS. WebGL heatmap layer for performance. Recharts for analytics widgets.',
   'finalized',
   '["Dashboard load < 3 seconds", "10000+ assets on map without lag", "Filter panel with < 100ms response"]',
   '["Map rendering > 8 seconds", "WebGL not supported on target browsers"]',
   1),

  -- TNSDMA Feedback tasks
  ('0000ee00-0006-0006-0000-000000000006', '00b10c00-0005-0005-0005-000000000005',
   '00b40005-0000-0200-0000-000000000002',
   'Feedback Collection Engine',
   'Dynamic form builder with question types, validation, and multi-channel collection (web, API, SMS).',
   '00fa1000-0105-0105-0105-000000000105', -- Siva Vignesh
   'in_progress', 'high', 40.0,
   'React form builder with drag-drop. Node.js API with rate limiting. SMS gateway integration.',
   'finalized',
   '["Form builder supports 15+ question types", "API response time < 200ms", "SMS delivery rate > 95%"]',
   '["Form submission fails under 100 concurrent users", "SMS gateway downtime > 1%"]',
   0),
  ('0000ee00-0007-0007-0000-000000000007', '00b10c00-0005-0005-0005-000000000005',
   '00b40005-0000-0200-0000-000000000002',
   'Analytics & Reporting Dashboard',
   'Real-time analytics dashboard with customizable reports, charts, and export in PDF/Excel.',
   '00fa1000-0186-0186-0186-000000000186', -- Yogesh
   'in_progress', 'high', 30.0,
   'React with Recharts for visualization. Apache Airflow for scheduled report generation.',
   'finalized',
   '["Dashboard refresh < 1 second", "PDF report generation < 10 seconds", "All charts exportable"]',
   '["Report generation > 30 seconds", "Dashboard showing stale data > 5 minutes"]',
   1),

  -- Drone Maps AI tasks
  ('0000ee00-0008-0008-0000-000000000008', '00b10c00-0007-0007-0007-000000000007',
   '00b40007-0000-0200-0000-000000000002',
   'Orthomosaic Processing Pipeline',
   'Automated pipeline for stitching drone images into orthomosaics with georeferencing.',
   '00fa1000-0139-0139-0139-000000000139', -- Keerthana
   'in_progress', 'high', 80.0,
   'OpenDroneMap + custom Python pipeline. AWS Batch for scaling. GDAL for georeferencing.',
   'finalized',
   '["100-acre farm processed < 30 minutes", "Georeferencing accuracy < 2m RMSE", "Pipeline handles 4K+ images"]',
   '["Processing fails on > 20% of image sets", "Cost > $5 per acre for processing"]',
   0),
  ('0000ee00-0009-0009-0000-000000000009', '00b10c00-0007-0007-0007-000000000007',
   '00b40007-0000-0200-0000-000000000002',
   'AI Crop Analysis Model',
   'Train and deploy AI models for crop type detection, health assessment, and yield estimation from drone imagery.',
   '00fa1000-0182-0182-0182-000000000182', -- Vishwanathan
   'in_progress', 'high', 60.0,
   'PyTorch with transfer learning. Custom dataset with labeled drone imagery. MLflow for experiment tracking.',
   'finalized',
   '["Crop detection accuracy > 85%", "Health assessment precision > 80%", "Model inference < 2 seconds per acre"]',
   '["Accuracy < 70% after 3 iterations", "Model size > 500MB affecting deployment"]',
   1),

  -- Experian GenAI tasks
  ('0000ee00-0010-0010-0000-000000000010', '00b10c00-0009-0009-0009-000000000009',
   '00b40009-0000-0200-0000-000000000002',
   'GenAI Video Generation Pipeline',
   'Build AI pipeline for generating personalized financial profile videos using GenAI and text-to-video models.',
   '00fa1000-0197-0197-0197-000000000197', -- Pranav
   'in_progress', 'high', 80.0,
   'OpenAI/Claude for content generation. ElevenLabs for voice synthesis. Custom video composition engine.',
   'finalized',
   '["Video generation < 5 minutes per profile", "Content personalization accuracy > 95%", "Voice quality rated > 4/5"]',
   '["Generation > 10 minutes", "Content hallucination rate > 5%", "Voice synthesis artifacts"]',
   0),
  ('0000ee00-0011-0011-0000-000000000011', '00b10c00-0009-0009-0009-000000000009',
   '00b40009-0000-0200-0000-000000000002',
   'Financial Data Integration & Privacy',
   'Integrate with Experian financial data APIs with PII masking, encryption, and compliance validation.',
   '00fa1000-0184-0184-0184-000000000184', -- Shiva Gurunath
   'in_progress', 'high', 40.0,
   'REST API integration with OAuth2. AES-256 encryption for PII. Audit logging for compliance.',
   'finalized',
   '["API response time < 500ms", "PII masking covers all identifiable fields", "Compliance audit pass rate 100%"]',
   '["API availability < 99.9%", "PII leakage detected in logs", "Compliance requirement unmet"]',
   1),

  -- Yadadri FIMS tasks
  ('0000ee00-0012-0012-0000-000000000012', '00b10c00-0006-0006-0006-000000000006',
   '00b40006-0000-0200-0000-000000000002',
   'Mobile Inspection App',
   'Build Flutter app for field inspections with offline data capture, GPS, photo, and digital signatures.',
   '00fa1000-0133-0133-0133-000000000133', -- Manoj
   'in_progress', 'high', 40.0,
   'Flutter with offline SQLite sync. Camera and GPS plugins. Canvas-based digital signature.',
   'finalized',
   '["Offline mode works for 8+ hours", "GPS accuracy < 10 meters", "Photo with automatic geo-tagging"]',
   '["App crashes > 2% of sessions", "Offline data lost on app restart", "GPS timeout > 30 seconds"]',
   0),

  -- Real Estate Platform tasks
  ('0000ee00-0013-0013-0000-000000000013', '00b10c00-0010-0010-0010-000000000010',
   NULL,
   'Land Parcel Search & Comparison',
   'Search engine with geo-spatial queries, filtering, and side-by-side comparison of land parcels.',
   '00fa1000-0182-0182-0182-000000000182', -- Vishwanathan
   'in_progress', 'medium', 30.0,
   'Elasticsearch for text search. PostGIS for spatial queries. React comparison table with dynamic columns.',
   'finalized',
   '["Search < 2 seconds", "Comparison table supports 10+ parcels", "Filter combinations applied in < 500ms"]',
   '[]',
   0)
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- TASK STEPS (for key in-progress tasks)
-- ────────────────────────────────────────────────────────────
INSERT INTO task_steps
  (id, task_id, description, expected_outcome, category, status,
   order_index, estimated_hours, actual_hours, assignee_id)
VALUES
  -- GIS Parcel Mapping steps
  ('00eee000-0001-0000-0000-000000000001', '0000ee00-0001-0001-0000-000000000001',
   'Design PostGIS schema for parcels, boundaries, and metadata',
   'Normalized schema with spatial indexes and partitioning strategy',
   'design', 'completed', 0, 8.0, 10.0,
   '00fa1000-0118-0118-0118-000000000118'),
  ('00eee000-0002-0000-0000-000000000002', '0000ee00-0001-0001-0000-000000000001',
   'Implement GeoJSON API endpoints for parcel CRUD',
   'REST API with GeoJSON responses and spatial query support',
   'development', 'completed', 1, 16.0, 20.0,
   '00fa1000-0170-0170-0170-000000000170'),
  ('00eee000-0003-0000-0000-000000000003', '0000ee00-0001-0001-0000-000000000001',
   'Build Leaflet map component with parcel overlay and interactions',
   'Interactive map with parcel selection, hover info, and styling',
   'development', 'in_progress', 2, 24.0, NULL,
   '00fa1000-0101-0102-0102-000000000102'),
  ('00eee000-0004-0000-0000-000000000004', '0000ee00-0001-0001-0000-000000000001',
   'Implement spatial search with bounding box and radius queries',
   'Search box with autocomplete and spatial result highlighting',
   'development', 'pending', 3, 16.0, NULL,
   '00fa1000-0181-0181-0181-000000000181'),
  ('00eee000-0005-0000-0000-000000000005', '0000ee00-0001-0001-0000-000000000001',
   'Performance testing with 5000+ parcels dataset',
   'Performance report showing < 3 second render times',
   'testing', 'pending', 4, 16.0, NULL,
   '00fa1000-0148-0148-0148-000000000148'),

  -- QR Mobile App steps
  ('00eee000-0006-0000-0000-000000000006', '0000ee00-0004-0004-0000-000000000004',
   'Set up Flutter project with offline-first architecture',
   'Project scaffold with SQLite sync and state management setup',
   'development', 'completed', 0, 8.0, 6.0,
   '00fa1000-0179-0179-0179-000000000179'),
  ('00eee000-0007-0000-0000-000000000007', '0000ee00-0004-0004-0000-000000000004',
   'Implement QR scanner with multiple format support',
   'QR scanner handling QR, DataMatrix, and PDF417 formats',
   'development', 'completed', 1, 12.0, 10.0,
   '00fa1000-0174-0174-0174-000000000174'),
  ('00eee000-0008-0000-0000-000000000008', '0000ee00-0004-0004-0000-000000000004',
   'Build offline survey form with validation and sync queue',
   'Offline-capable forms with background sync on connectivity',
   'development', 'in_progress', 2, 20.0, NULL,
   '00fa1000-0179-0179-0179-000000000179'),
  ('00eee000-0009-0000-0000-000000000009', '0000ee00-0004-0004-0000-000000000004',
   'Add photo capture with geo-tagging and auto-compression',
   'Photo module with EXIF geo-tags and < 500KB compressed images',
   'development', 'pending', 3, 12.0, NULL,
   '00fa1000-0133-0133-0133-000000000133'),
  ('00eee000-0010-0000-0000-000000000010', '0000ee00-0004-0004-0000-000000000004',
   'Integration testing with GHMC asset database',
   'End-to-end test passing with real asset data from GHMC',
   'testing', 'pending', 4, 8.0, NULL,
   '00fa1000-0144-0144-0144-000000000144'),

  -- Orthomosaic Pipeline steps
  ('00eee000-0011-0000-0000-000000000011', '0000ee00-0008-0008-0000-000000000008',
   'Set up OpenDroneMap processing cluster on AWS',
   'Auto-scaling ODM cluster with S3 input/output',
   'deployment', 'completed', 0, 16.0, 20.0,
   '00fa1000-0139-0139-0139-000000000139'),
  ('00eee000-0012-0000-0000-000000000012', '0000ee00-0008-0008-0000-000000000008',
   'Build preprocessing image quality validation',
   'Image validator rejecting blurry, overexposed, or low-overlap images',
   'development', 'completed', 1, 12.0, 15.0,
   '00fa1000-0193-0193-0193-000000000193'),
  ('00eee000-0013-0000-0000-000000000013', '0000ee00-0008-0008-0000-000000000008',
   'Implement georeferencing with ground control point support',
   'Georeferencing accuracy < 2m RMSE with GCP file upload',
   'development', 'in_progress', 2, 20.0, NULL,
   '00fa1000-0139-0139-0139-000000000139'),
  ('00eee000-0014-0000-0000-000000000014', '0000ee00-0008-0008-0000-000000000008',
   'Create pipeline monitoring and alerting dashboard',
   'Dashboard showing pipeline status, processing times, and error rates',
   'development', 'pending', 3, 16.0, NULL,
   '00fa1000-0194-0194-0194-000000000194'),
  ('00eee000-0015-0000-0000-000000000015', '0000ee00-0008-0008-0000-000000000008',
   'Scale testing with 100-acre farm datasets',
   'Pipeline handles 4K+ images in < 30 minutes at < $5/acre',
   'testing', 'pending', 4, 16.0, NULL,
   '00fa1000-0193-0193-0193-000000000193'),

  -- Experian GenAI steps
  ('00eee000-0016-0000-0000-000000000016', '0000ee00-0010-0010-0000-000000000010',
   'Design content template system with variable insertion',
   'Template engine supporting 20+ templates with dynamic financial data',
   'design', 'completed', 0, 12.0, 10.0,
   '00fa1000-0197-0197-0197-000000000197'),
  ('00eee000-0017-0000-0000-000000000017', '0000ee00-0010-0010-0000-000000000010',
   'Integrate GenAI for personalized script generation',
   'Script generator producing coherent financial profile narratives',
   'development', 'in_progress', 1, 24.0, NULL,
   '00fa1000-0197-0197-0197-000000000197'),
  ('00eee000-0018-0000-0000-000000000018', '0000ee00-0010-0010-0000-000000000010',
   'Implement voice synthesis with ElevenLabs API',
   'Natural-sounding voice narration with financial terminology accuracy',
   'development', 'pending', 2, 16.0, NULL,
   '00fa1000-0184-0184-0184-000000000184'),
  ('00eee000-0019-0000-0000-000000000019', '0000ee00-0010-0010-0000-000000000010',
   'Build video composition and rendering engine',
   'Video compositor combining visuals, voice, and on-screen data overlays',
   'development', 'pending', 3, 28.0, NULL,
   '00fa1000-0197-0197-0197-000000000197')
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- SUBMISSIONS (key milestones from active projects)
-- ────────────────────────────────────────────────────────────
INSERT INTO submissions
  (id, phase_id, project_id, user_id, title, type, description,
   link, status, reviewed_by, reviewed_at, is_key_milestone)
VALUES
  -- SIPCOT LMP submissions
  ('00bb1000-0001-0000-0000-000000000001',
   '00b40001-0000-0200-0000-000000000002', '00b10c00-0001-0001-0001-000000000001',
   '00fa1000-0170-0170-0170-000000000170',
   'SIPCOT LMP Architecture Document', 'document',
   'Complete system architecture with component diagrams, API contracts, and database schema',
   'https://docs.farmwise.ai/sipcot-lmp-architecture',
   'approved', '00fa1000-0000-0000-0000-000000000001', '2025-12-15 00:00:00', TRUE),
  ('00bb1000-0002-0000-0000-000000000002',
   '00b40001-0000-0300-0000-000000000003', '00b10c00-0001-0001-0001-000000000001',
   '00fa1000-0101-0102-0102-000000000102',
   'LMP Frontend Component Library', 'code',
   '40+ reusable React components with Storybook documentation',
   'https://github.com/farmwise/sipcot-lmp-frontend',
   'submitted', NULL, NULL, FALSE),
  ('00bb1000-0003-0000-0000-000000000003',
   '00b40001-0000-0300-0000-000000000003', '00b10c00-0001-0001-0001-000000000001',
   '00fa1000-0170-0170-0170-000000000170',
   'GIS Parcel Module - 50% Completion Review', 'document',
   'Mid-development review with completed GIS schema, API endpoints, and map component progress',
   'https://docs.farmwise.ai/sipcot-gis-review',
   'submitted', NULL, NULL, FALSE),

  -- GHMC submissions
  ('00bb1000-0004-0000-0000-000000000004',
   '00b40003-0000-0200-0000-000000000002', '00b10c00-0003-0003-0003-000000000003',
   '00fa1000-0179-0179-0179-000000000179',
   'GHMC QR Mobile App - Beta Build', 'code',
   'Beta version of Flutter mobile app with QR scanning and offline survey',
   'https://github.com/farmwise/ghmc-mobile',
   'submitted', NULL, NULL, TRUE),
  ('00bb1000-0005-0000-0000-000000000005',
   '00b40003-0000-0200-0000-000000000002', '00b10c00-0003-0003-0003-000000000003',
   '00fa1000-0107-0107-0107-000000000107', -- Mukilan
   'GHMC Design Assets & Wireframes', 'design',
   'Complete UI/UX design assets for web portal and mobile app',
   'https://figma.com/farmwise/ghmc-design-system',
   'approved', '00fa1000-0179-0179-0179-000000000179', '2026-03-10 00:00:00', TRUE),

  -- Drone Maps AI submissions
  ('00bb1000-0006-0000-0000-000000000006',
   '00b40007-0000-0200-0000-000000000002', '00b10c00-0007-0007-0007-000000000007',
   '00fa1000-0139-0139-0139-000000000139',
   'Orthomosaic Pipeline - Proof of Concept Results', 'data',
   'Processing results showing 25-minute processing for 50-acre farm with 92% accuracy',
   'https://drone-maps.farmwise.ai/poc-results',
   'approved', '00fa1000-0105-0105-0105-000000000105', '2026-03-15 00:00:00', TRUE),
  ('00bb1000-0007-0000-0000-000000000007',
   '00b40007-0000-0200-0000-000000000002', '00b10c00-0007-0007-0007-000000000007',
   '00fa1000-0182-0182-0182-000000000182',
   'AI Crop Detection Model - Baseline', 'notebook',
   'Initial model achieving 78% crop detection accuracy on validation set',
   'https://sagemaker.aws/notebooks/drone-crop-baseline',
   'approved', '00fa1000-0105-0105-0105-000000000105', '2026-04-01 00:00:00', TRUE),

  -- Experian GenAI submissions
  ('00bb1000-0008-0000-0000-000000000008',
   '00b40009-0000-0200-0000-000000000002', '00b10c00-0009-0009-0009-000000000009',
   '00fa1000-0197-0197-0197-000000000197',
   'Video Generation Pipeline - Template System', 'document',
   'Content template system design with 15+ financial profile templates',
   'https://docs.farmwise.ai/experian-templates',
   'approved', '00fa1000-0186-0186-0186-000000000186', '2026-04-20 00:00:00', FALSE),

  -- TNSDMA submissions
  ('00bb1000-0009-0000-0000-000000000009',
   '00b40005-0000-0200-0000-000000000002', '00b10c00-0005-0005-0005-000000000005',
   '00fa1000-0105-0105-0105-000000000105',
   'Feedback Form Builder - MVP', 'code',
   'Dynamic form builder with 10+ question types and validation engine',
   'https://github.com/farmwise/tnsdma-form-builder',
   'submitted', NULL, NULL, TRUE),

  -- Yadadri FIMS submissions
  ('00bb1000-0010-0000-0000-000000000010',
   '00b40006-0000-0200-0000-000000000002', '00b10c00-0006-0006-0006-000000000006',
   '00fa1000-0133-0133-0133-000000000133',
   'FIMS Mobile App - Alpha Build', 'code',
   'Alpha version with basic inspection workflow and offline data capture',
   'https://github.com/farmwise/yadadri-fims',
   'submitted', NULL, NULL, FALSE)
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- FEEDBACK (on submissions)
-- ────────────────────────────────────────────────────────────
INSERT INTO feedback (id, submission_id, from_user_id, text, is_ai)
VALUES
  ('fb000000-0001-0000-0000-000000000001', '00bb1000-0001-0000-0000-000000000001',
   '00fa1000-0000-0000-0000-000000000001',
   'Architecture looks solid. PostGIS spatial partitioning strategy is well thought out. Approved for development phase.',
   FALSE),
  ('fb000000-0002-0000-0000-000000000002', '00bb1000-0001-0000-0000-000000000001',
   '00fa1000-0179-0179-0179-000000000179',
   'Good API contract design. Mobile app integration points are clearly defined. Suggest adding a batch sync endpoint for offline mode.',
   FALSE),
  ('fb000000-0003-0000-0000-000000000003', '00bb1000-0005-0000-0000-000000000005',
   '00fa1000-0179-0179-0179-000000000179',
   'Design system is comprehensive. QR scanning UI handles edge cases well. Moving forward with development.',
   FALSE),
  ('fb000000-0004-0000-0000-000000000004', '00bb1000-0006-0000-0000-000000000006',
   '00fa1000-0105-0105-0105-000000000105',
   '25-minute processing for 50 acres is ahead of target. Scale testing plan looks good. Approve proceeding to full pipeline.',
   FALSE),
  ('fb000000-0005-0000-0000-000000000005', '00bb1000-0007-0000-0000-000000000007',
   '00fa1000-0105-0105-0105-000000000105',
   '78% baseline is acceptable for first iteration. Focus on data augmentation and transfer learning to close the gap to 85%.',
   FALSE),
  ('fb000000-0006-0000-0000-000000000006', '00bb1000-0007-0000-0000-000000000007',
   NULL,
   'Based on similar agricultural models, adding NDVI and multi-spectral bands as input channels typically improves accuracy by 7-10%. Consider incorporating Sentinel-2 satellite data for temporal comparison.',
   TRUE),
  ('fb000000-0007-0000-0000-000000000007', '00bb1000-0002-0000-0000-000000000002',
   '00fa1000-0170-0170-0170-000000000170',
   'Component library coverage looks good. Need to verify accessibility compliance (WCAG 2.1 AA) before merging to main.',
   FALSE),
  ('fb000000-0008-0000-0000-000000000008', '00bb1000-0009-0000-0000-000000000009',
   '00fa1000-0186-0186-0186-000000000186',
   'Form builder MVP handles core use cases. Conditional logic implementation needs to be added for TNSDMA complex forms.',
   FALSE)
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- CHECKPOINTS (project health checks)
-- ────────────────────────────────────────────────────────────
INSERT INTO checkpoints (id, project_id, decision, notes, decided_by)
VALUES
  ('cc000000-0001-0000-0000-000000000001',
   '00b10c00-0001-0001-0001-000000000001',
   'continue',
   'SIPCOT LMP at 50% completion. GIS module on track, document workflow slightly delayed. Overall schedule: green. Resource allocation adequate.',
   '00fa1000-0000-0000-0000-000000000001'),
  ('cc000000-0002-0000-0000-000000000002',
   '00b10c00-0003-0003-0003-000000000003',
   'at_risk',
   'GHMC project running behind schedule as noted in tracker. Additional resources (Manoj, Shiva Gurunath) allocated. Client review phase approaching with pending items.',
   '00fa1000-0000-0000-0000-000000000001'),
  ('cc000000-0003-0000-0000-000000000003',
   '00b10c00-0007-0007-0007-000000000007',
   'continue',
   'Drone Maps AI making good progress. Orthomosaic processing ahead of target. AI model improvements needed but on track for Demo Phase. Demo materials needed by May 10.',
   '00fa1000-0002-0002-0002-000000000002'), -- Judge Raja
  ('cc000000-0004-0000-0000-000000000004',
   '00b10c00-0005-0005-0005-000000000005',
   'continue',
   'TNSDMA Feedback System on track. Form builder MVP delivered. Analytics dashboard in progress. UAT scheduled for May.',
   '00fa1000-0000-0000-0000-000000000001'),
  ('cc000000-0005-0000-0000-000000000005',
   '00b10c00-0006-0006-0006-000000000006',
   'continue',
   'Yadadri FIMS tight timeline but on schedule. Alpha build delivered. Field testing preparation underway. All hands focused on May 10 deadline.',
   '00fa1000-0000-0000-0000-000000000001'),
  ('cc000000-0006-0000-0000-000000000006',
   '00b10c00-0009-0009-0009-000000000009',
   'continue',
   'Experian GenAI pipeline progressing well. Template system approved. Privacy compliance review scheduled. Data integration next milestone.',
   '00fa1000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- REVIEW TASKS
-- ────────────────────────────────────────────────────────────
INSERT INTO review_tasks
  (id, title, type, description, assignee_id, requester_id,
   project_id, status, priority, due_date)
VALUES
  ('ee000000-0001-0000-0000-000000000001',
   'Review GIS Parcel Module Code', 'code',
   'Review PostGIS schema, API endpoints, and Leaflet map component for correctness and performance.',
   '00fa1000-0000-0000-0000-000000000001',
   '00fa1000-0170-0170-0170-000000000170',
   '00b10c00-0001-0001-0001-000000000001',
   'pending', 'high', '2026-05-05'),
  ('ee000000-0002-0000-0000-000000000002',
   'Review LMP Frontend Component Library', 'code',
   'Review React component library for code quality, accessibility, and design system consistency.',
   '00fa1000-0170-0170-0170-000000000170',
   '00fa1000-0101-0102-0102-000000000102',
   '00b10c00-0001-0001-0001-000000000001',
   'pending', 'medium', '2026-05-03'),
  ('ee000000-0003-0000-0000-000000000003',
   'Review GHMC QR Mobile App Beta', 'code',
   'Review Flutter app beta build for QR scanning reliability, offline sync, and UI/UX compliance.',
   '00fa1000-0186-0186-0186-000000000186',
   '00fa1000-0179-0179-0179-000000000179',
   '00b10c00-0003-0003-0003-000000000003',
   'pending', 'high', '2026-05-01'),
  ('ee000000-0004-0000-0000-000000000004',
   'Security Audit - Experian API Integration', 'document',
   'Review data privacy implementation, PII masking, and compliance with Experian security requirements.',
   '00fa1000-0000-0000-0000-000000000001',
   '00fa1000-0184-0184-0184-000000000184',
   '00b10c00-0009-0009-0009-000000000009',
   'pending', 'high', '2026-05-10'),
  ('ee000000-0005-0000-0000-000000000005',
   'Review Orthomosaic Pipeline Performance', 'data',
   'Validate processing pipeline benchmarks, cost analysis, and georeferencing accuracy.',
   '00fa1000-0105-0105-0105-000000000105',
   '00fa1000-0139-0139-0139-000000000139',
   '00b10c00-0007-0007-0007-000000000007',
   'pending', 'medium', '2026-05-05'),
  ('ee000000-0006-0000-0000-000000000006',
   'Review TNSDMA Form Builder MVP', 'code',
   'Review dynamic form builder for feature completeness, performance, and accessibility.',
   '00fa1000-0186-0186-0186-000000000186',
   '00fa1000-0105-0105-0105-000000000105',
   '00b10c00-0005-0005-0005-000000000005',
   'pending', 'medium', '2026-05-02')
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- AI INSIGHTS (from resource allocation patterns and project data)
-- ────────────────────────────────────────────────────────────
INSERT INTO ai_insights
  (id, project_id, user_id, type, severity, title, description, action_items, status)
VALUES
  ('1a000000-0001-0000-0000-000000000001',
   '00b10c00-0001-0001-0001-000000000001', NULL,
   'risk', 'high',
   'SIPCOT LMP over-allocation risk for Sidharthan Durai',
   'Sidharthan is allocated at 100% on SIPCOT LMP plus additional TNIAMP AMC responsibilities. Total allocation exceeds 100%, risking delivery quality and burnout.',
   '["Review Sidharthan''s allocations and consider delegating TNIAMP AMC tasks", "Set up buffer for unexpected LMP issues"]',
   'active'),
  ('1a000000-0002-0000-0000-000000000002',
   '00b10c00-0003-0003-0003-000000000003', NULL,
   'blocker', 'high',
   'GHMC project delay flagged in tracker - Running delay',
   'Multiple resources have remarks noting ''Running delay''. The Client Review phase is active but 30% of allocated resources (Lavanya at 0%) are not contributing to this phase effectively.',
   '["Daily standup focused on GHMC unblocking", "Escalate to Anand for additional resource approval", "Re-evaluate May 30 deadline feasibility"]',
   'active'),
  ('1a000000-0003-0000-0000-000000000003',
   '00b10c00-0007-0007-0007-000000000007', NULL,
   'opportunity', 'medium',
   'Drone Maps AI demo timeline optimization potential',
   'Multiple resources at 70-30% allocation on Drone Maps AI. Consolidating part-time allocations to full-time for 2-week sprint could deliver Demo Phase 3 weeks earlier.',
   '["Temporarily increase Keerthana to 100% for 2 weeks", "Shift Amal and Malavika to 50% each on demo materials"]',
   'active'),
  ('1a000000-0004-0000-0000-000000000004',
   '00b10c00-0006-0006-0006-000000000006', NULL,
   'risk', 'high',
   'Yadadri FIMS 40-day timeline extremely tight',
   'Project has 40-day window with multiple 50%-allocated resources. Cross-team dependencies and concurrent projects increase risk of missing May 10 deadline.',
   '["Daily burn-down tracking", "Have rollback plan if milestone slips", "Pre-identify minimal viable scope for May 10"]',
   'active'),
  ('1a000000-0005-0000-0000-000000000005',
   NULL, NULL,
   'risk', 'medium',
   'GIS team resource concentration risk',
   'GIS team (Jenifer, Divya Kala, Jensi, Akash) all at 100% on GIS Site Suitability with CCMC survey entries at 0%. If GIS Site Suitability scope increases, no buffer exists.',
   '["Cross-train Naveen C for GIS Site Suitability backup", "Maintain knowledge base for all GIS analyses"]',
   'active'),
  ('1a000000-0006-0000-0000-000000000006',
   '00b10c00-0009-0009-0009-000000000009', NULL,
   'opportunity', 'low',
   'Experian project data science capacity available',
   'Pranav P (60%) and Govindraj S (40% on Yadadri) have remaining capacity. Could accelerate GenAI pipeline or assist other projects.',
   '["Consider temporary allocation shift to blocked projects", "Accelerate video rendering engine development"]',
   'active')
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- DISCUSSIONS (key project conversations)
-- ────────────────────────────────────────────────────────────
INSERT INTO discussions (id, project_id, phase_id, title, author_id, is_resolved)
VALUES
  ('d1000000-0001-0000-0000-000000000001', '00b10c00-0001-0001-0001-000000000001',
   '00b40001-0000-0300-0000-000000000003',
   'SIPCOT parcel data format from client - GeoJSON vs Shapefile',
   '00fa1000-0118-0118-0118-000000000118', -- Rahulji
   TRUE),
  ('d1000000-0002-0000-0000-000000000002', '00b10c00-0003-0003-0003-000000000003',
   '00b40003-0000-0200-0000-000000000002',
   'GHMC QR code scanning performance in low light',
   '00fa1000-0179-0179-0179-000000000179', -- Tamilmaran
   FALSE),
  ('d1000000-0003-0000-0000-000000000003', '00b10c00-0007-0007-0007-000000000007',
   '00b40007-0000-0200-0000-000000000002',
   'AI model selection for crop detection',
   '00fa1000-0182-0182-0182-000000000182', -- Vishwanathan
   TRUE),
  ('d1000000-0004-0000-0000-000000000004', '00b10c00-0005-0005-0005-000000000005',
   '00b40005-0000-0200-0000-000000000002',
   'TNSDMA SMS gateway integration approach',
   '00fa1000-0105-0105-0105-000000000105', -- Siva Vignesh
   FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO discussion_messages (id, discussion_id, author_id, content, parent_id)
VALUES
  -- Discussion 1 messages
  ('d0000000-0001-0000-0000-000000000001', 'd1000000-0001-0000-0000-000000000001',
   '00fa1000-0118-0118-0118-000000000118',
   'SIPCOT has shared initial parcel data in Shapefile format but also has GeoJSON exports available. Which should be our primary ingestion format?',
   NULL),
  ('d0000000-0002-0000-0000-000000000002', 'd1000000-0001-0000-0000-000000000001',
   '00fa1000-0170-0170-0170-000000000170',
   'GeoJSON is easier for API responses, but Shapefile is better for bulk import with attributes. I''d suggest ingesting as Shapefile and converting to GeoJSON on export.',
   NULL),
  ('d0000000-0003-0000-0000-000000000003', 'd1000000-0001-0000-0000-000000000001',
   '00fa1000-0118-0118-0118-000000000118',
   'Agreed. We''ll build a Shapefile importer with GDAL and store normalized in PostGIS. API returns GeoJSON. Marking as resolved.',
   NULL),

  -- Discussion 2 messages
  ('d0000000-0004-0000-0000-000000000004', 'd1000000-0002-0000-0000-000000000002',
   '00fa1000-0174-0174-0174-000000000174',
   'QR scanning in low light field conditions is taking 3-5 seconds which is above our 2-second target. Need to explore torch activation and image preprocessing.',
   NULL),
  ('d0000000-0005-0000-0000-000000000005', 'd1000000-0002-0000-0000-000000000002',
   '00fa1000-0179-0179-0179-000000000179',
   'Can we auto-enable torch when ambient light < 100 lux? Also look into zxing preprocessing options for low-light enhancement.',
   NULL),

  -- Discussion 3 messages
  ('d0000000-0006-0000-0000-000000000006', 'd1000000-0003-0000-0000-000000000003',
   '00fa1000-0182-0182-0182-000000000182',
   'Evaluating YOLOv8 vs Faster R-CNN for crop detection. YOLOv8 faster inference but Faster R-CNN better accuracy on small objects (early-stage crops).',
   NULL),
  ('d0000000-0007-0000-0000-000000000007', 'd1000000-0003-0000-0000-000000000003',
   '00fa1000-0105-0105-0105-000000000105',
   'Go with YOLOv8 for Demo Phase (speed matters). Can switch to Faster R-CNN later if accuracy requirement increases. Decision made.',
   NULL),

  -- Discussion 4 messages
  ('d0000000-0008-0000-0000-000000000008', 'd1000000-0004-0000-0000-000000000004',
   '00fa1000-0105-0105-0105-000000000105',
   'Need to decide between Twilio vs Gupshup for SMS gateway. Twilio has better API but Gupshup is cheaper for domestic SMS in India.',
   NULL),
  ('d0000000-0009-0000-0000-000000000009', 'd1000000-0004-0000-0000-000000000004',
   '00fa1000-0186-0186-0186-000000000186',
   'Gupshup for domestic (70% of traffic), Twilio for international. Build an abstraction layer so we can switch. Cost analysis attached.',
   NULL)
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- CAPTURE SESSIONS & ITEMS
-- ────────────────────────────────────────────────────────────
INSERT INTO capture_sessions (id, user_id, raw_text)
VALUES (
  'ca100000-0001-0000-0000-000000000001',
  '00fa1000-0000-0000-0000-000000000001',
  'Need to review GHMC timeline with Tamilmaran. Risk of missing May deadline. Check SIPCOT GIS module progress with Sidharthan. Drone Maps AI demo prep needs acceleration - assign Amal full-time for 2 weeks. Review Experian security compliance. commitment: Board presentation on Q1 project portfolio by Friday EOD. follow up with Judge Raja on drone team capacity.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO capture_items
  (id, session_id, user_id, type, title, description,
   assignee_id, due_date, priority, status)
VALUES
  ('ca200000-0001-0000-0000-000000000001', 'ca100000-0001-0000-0000-000000000001',
   '00fa1000-0000-0000-0000-000000000001',
   'todo',
   'Review GHMC timeline with Tamilmaran',
   'Risk of missing May deadline. Review current progress and blockers.',
   '00fa1000-0179-0179-0179-000000000179',
   '2026-05-01', 'high', 'pending'),
  ('ca200000-0002-0000-0000-000000000002', 'ca100000-0001-0000-0000-000000000001',
   '00fa1000-0000-0000-0000-000000000001',
   'follow_up',
   'Check SIPCOT GIS module status with Sidharthan',
   'Confirm GIS parcel module is on track for 50% milestone review.',
   '00fa1000-0170-0170-0170-000000000170',
   '2026-05-02', 'medium', 'pending'),
  ('ca200000-0003-0000-0000-000000000003', 'ca100000-0001-0000-0000-000000000001',
   '00fa1000-0000-0000-0000-000000000001',
   'todo',
   'Accelerate Drone Maps AI demo preparation',
   'Assign Amal full-time for 2 weeks to accelerate demo materials.',
   '00fa1000-0193-0193-0193-000000000193',
   '2026-05-10', 'high', 'pending'),
  ('ca200000-0004-0000-0000-000000000004', 'ca100000-0001-0000-0000-000000000001',
   '00fa1000-0000-0000-0000-000000000001',
   'review_reminder',
   'Review Experian security compliance',
   'Security audit needed before financial data integration goes live.',
   NULL,
   '2026-05-05', 'high', 'pending'),
  ('ca200000-0005-0000-0000-000000000005', 'ca100000-0001-0000-0000-000000000001',
   '00fa1000-0000-0000-0000-000000000001',
   'commitment',
   'Board presentation on Q1 project portfolio',
   'Committed to presenting Q1 2026 project portfolio to board by Friday EOD.',
   '00fa1000-0000-0000-0000-000000000001',
   '2026-05-02', 'high', 'converted'),
  ('ca200000-0006-0000-0000-000000000006', 'ca100000-0001-0000-0000-000000000001',
   '00fa1000-0000-0000-0000-000000000001',
   'follow_up',
   'Drone team capacity check with Judge Raja',
   'Review drone team bandwidth for potential new projects in Q2.',
   '00fa1000-0002-0002-0002-000000000002', -- Judge Raja
   '2026-05-03', 'medium', 'pending')
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- LEAVE REQUESTS (simulated from working status in Excel)
-- ────────────────────────────────────────────────────────────
INSERT INTO leave_requests
  (id, user_id, type, start_date, end_date, days, reason,
   status, approved_by, approved_at, cover_person_id, coverage_plan, is_planned)
VALUES
  (
    'ea000000-0001-0000-0000-000000000001',
    '00fa1000-0170-0170-0170-000000000170', -- Sidharthan
    'planned', '2026-05-15', '2026-05-17', 3,
    'Personal commitment - pre-approved',
    'approved', '00fa1000-0000-0000-0000-000000000001', '2026-04-15',
    '00fa1000-0179-0179-0179-000000000179', -- Tamilmaran covers
    'Tamilmaran covers LMP code reviews and standups', TRUE
  ),
  (
    'ea000000-0002-0000-0000-000000000002',
    '00fa1000-0118-0118-0118-000000000118', -- Rahulji
    'planned', '2026-05-20', '2026-05-24', 5,
    'Family vacation',
    'approved', '00fa1000-0000-0000-0000-000000000001', '2026-04-01',
    '00fa1000-0115-0115-0115-000000000115', -- Divya Kala covers
    'Divya Kala handles GIS project coordination during absence', TRUE
  ),
  (
    'ea000000-0003-0000-0000-000000000003',
    '00fa1000-0101-0102-0102-000000000102', -- Pradeep Raj
    'wfh', '2026-04-29', '2026-05-01', 3,
    'WFH for medical appointment series',
    'approved', '00fa1000-0170-0170-0170-000000000170', '2026-04-28',
    NULL,
    'Available on Slack throughout. All PRs will be reviewed same-day.', TRUE
  ),
  (
    'ea000000-0004-0000-0000-000000000004',
    '00fa1000-0186-0186-0186-000000000186', -- Yogesh
    'personal', '2026-05-02', '2026-05-02', 1,
    'Family commitment',
    'pending', NULL, NULL,
    NULL, NULL, TRUE
  ),
  (
    'ea000000-0005-0000-0000-000000000005',
    '00fa1000-0144-0144-0144-000000000144', -- Lavanya
    'sick', '2026-04-28', '2026-04-29', 2,
    'Fever - doctor advised rest',
    'approved', '00fa1000-0179-0179-0179-000000000179', '2026-04-28',
    '00fa1000-0148-0148-0148-000000000148', -- Aamirunnisa covers
    'Aamirunnisa handles critical testing for GHMC and TNSDMA', FALSE
  )
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- STANDUP ENTRIES (simulated from current allocation data)
-- ────────────────────────────────────────────────────────────
INSERT INTO standup_entries (id, user_id, date, yesterday, today, blockers, mood)
VALUES
  (
    '5d000000-0001-0000-0000-000000000001',
    '00fa1000-0170-0170-0170-000000000170', '2026-04-29',
    'Reviewed SIPCOT LMP document workflow module. Completed PR reviews for frontend component library.',
    'Working on GIS parcel module integration testing. Need to resolve PostGIS query performance issue.',
    'PostGIS spatial index not being used for some queries - working with Rahulji on optimization.', 3
  ),
  (
    '5d000000-0002-0000-0000-000000000002',
    '00fa1000-0179-0179-0179-000000000179', '2026-04-29',
    'GHMC QR app beta build submitted. Tested offline sync for 100+ survey records.',
    'Addressing QR scanning performance in low light. Reviewing client feedback on web portal.',
    'Low light QR scanning taking 3-5 seconds vs 2-second target. Need Uday''s input on torch activation.', 3
  ),
  (
    '5d000000-0003-0000-0000-000000000003',
    '00fa1000-0139-0139-0139-000000000139', '2026-04-29',
    'Completed orthomosaic pipeline georeferencing module. Started scale testing.',
    'Running 100-acre farm scale test. Also reviewing AI model integration points.',
    'Scale test requires additional AWS GPU instances - awaiting approval from Anand.', 4
  ),
  (
    '5d000000-0004-0000-0000-000000000004',
    '00fa1000-0118-0118-0118-000000000118', '2026-04-29',
    'Completed SIPCOT parcel data import pipeline. Reviewed site suitability analysis for upcoming report.',
    'SIPCOT stakeholder meeting prep. CCMC survey data quality review with team.',
    'None today.', 4
  ),
  (
    '5d000000-0005-0000-0000-000000000005',
    '00fa1000-0105-0105-0105-000000000105', '2026-04-29',
    'TNSDMA form builder MVP submitted for review. Worked on Drone Maps AI model architecture review.',
    'SMS gateway integration for TNSDMA. Code review for Drone Maps AI crop detection model.',
    'SMS gateway provider decision pending - need Yogesh''s input on Gupshup vs Twilio.', 3
  ),
  (
    '5d000000-0006-0000-0000-000000000006',
    '00fa1000-0197-0197-0197-000000000197', '2026-04-29',
    'Completed Experian video template system. GenAI script generation pipeline ready for integration.',
    'Integrating voice synthesis with ElevenLabs API. Starting video composition engine.',
    'ElevenLabs API rate limits may affect scaling - need to discuss with Experian.', 4
  ),
  (
    '5d000000-0007-0000-0000-000000000007',
    '00fa1000-0133-0133-0133-000000000133', '2026-04-29',
    'Yadadri FIMS alpha build submitted. Fixed offline data capture bugs.',
    'Working on inspection workflow logic and digital signature implementation.',
    'Offline storage limit on low-end devices - need to implement compression strategy.', 3
  )
ON CONFLICT (user_id, date) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
INSERT INTO notifications (id, user_id, type, title, message, is_read)
VALUES
  ('00110000-0001-0000-0000-000000000001',
   '00fa1000-0000-0000-0000-000000000001',
   'review_requested',
   'GHMC QR Mobile App Beta needs your review',
   'Tamilmaran submitted the GHMC QR mobile app beta build for CEO review. Running delay noted - time sensitive.',
   FALSE),
  ('00110000-0002-0000-0000-000000000002',
   '00fa1000-0000-0000-0000-000000000001',
   'leave_request',
   'Leave request from Yogesh',
   'Yogesh has requested personal leave on May 2. Pending your approval.',
   FALSE),
  ('00110000-0003-0000-0000-000000000003',
   '00fa1000-0000-0000-0000-000000000001',
   'deadline_approaching',
   'Yadadri FIMS deadline - 10 days remaining',
   'Yadadri FIMS project has 10 days until May 10 rollout deadline. Alpha build submitted. Field testing pending.',
   FALSE),
  ('00110000-0004-0000-0000-000000000004',
   '00fa1000-0179-0179-0179-000000000179',
   'task_comment',
   'Lavanya added comments on GHMC testing',
   'Lavanya: ''QR scanning edge cases found - barcode with damage still scanning incorrectly. Added test cases to Jira.''',
   FALSE),
  ('00110000-0005-0000-0000-000000000005',
   '00fa1000-0170-0170-0170-000000000170',
   'ai_insight',
   'AI Insight: Over-allocation risk detected',
   'AI detected your allocation exceeds 100%. Consider delegating TNIAMP AMC tasks to reduce burnout risk.',
   TRUE),
  ('00110000-0006-0000-0000-000000000006',
   '00fa1000-0186-0186-0186-000000000186',
   'review_requested',
   'Review needed: Experian video template system',
   'Pranav submitted the video template system for your review. Approved preliminarily, final review pending.',
   FALSE),
  ('00110000-0007-0000-0000-000000000007',
   '00fa1000-0105-0105-0105-000000000105',
   'ai_insight',
   'AI: Satellite data could improve crop detection model',
   'NDVI and Sentinel-2 data typically improves agricultural AI accuracy by 7-10%. Consider adding as input features.',
   TRUE),
  ('00110000-0008-0000-0000-000000000008',
   '00fa1000-0002-0002-0002-000000000002', -- Judge Raja
   'follow_up',
   'Drone team capacity review requested',
   'Anand wants to discuss drone team Q2 capacity. Follow-up scheduled for May 3.',
   FALSE)
ON CONFLICT (id) DO NOTHING;

COMMIT;