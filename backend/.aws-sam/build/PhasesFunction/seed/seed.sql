-- ============================================================
-- ProjectHub — Production Seed SQL
-- Generated from seed.py on 2026-04-29
-- ============================================================

BEGIN;

-- ────────────────────────────────────────────────────────────
-- USERS
-- ────────────────────────────────────────────────────────────
INSERT INTO users (id, name, email, password_hash, role, role_type, department, avatar_color)
VALUES
  ('aaaaaaaa-0001-0001-0001-000000000001', 'Rahul',   'rahul@company.dev',   '$2b$12$g.Fn4/il2yfYJM1peM4lF.a5MHbRb3n4yPqC1oItBUTzFUdgQatxi', 'CEO',                   'CEO',       'Leadership',  '#3b82f6'),
  ('aaaaaaaa-0002-0002-0002-000000000002', 'Priya',   'priya@company.dev',   '$2b$12$dNUdOze5z0XmTuHU3wtt..6PLjoYozeSSRd.ld46dXRRT99frg9LO', 'Senior Data Scientist', 'Member',    'Data Science','#a855f7'),
  ('aaaaaaaa-0003-0003-0003-000000000003', 'Arjun',   'arjun@company.dev',   '$2b$12$tCxfNpoVsQHLw.ky7KqcUuQ8s4pHTYDRnpNqNOglau8IDA/2SQp0u', 'Full-Stack Engineer',   'Team Lead', 'Engineering', '#10b981'),
  ('aaaaaaaa-0004-0004-0004-000000000004', 'Meera',   'meera@company.dev',   '$2b$12$dNUdOze5z0XmTuHU3wtt..6PLjoYozeSSRd.ld46dXRRT99frg9LO', 'ML Engineer',           'Member',    'Data Science','#f59e0b'),
  ('aaaaaaaa-0005-0005-0005-000000000005', 'Vikram',  'vikram@company.dev',  '$2b$12$dNUdOze5z0XmTuHU3wtt..6PLjoYozeSSRd.ld46dXRRT99frg9LO', 'Backend Engineer',      'Member',    'Engineering', '#ef4444'),
  ('aaaaaaaa-0006-0006-0006-000000000006', 'Sneha',   'sneha@company.dev',   '$2b$12$dNUdOze5z0XmTuHU3wtt..6PLjoYozeSSRd.ld46dXRRT99frg9LO', 'Product Designer',      'Member',    'Design',      '#ec4899'),
  ('aaaaaaaa-0007-0007-0007-000000000007', 'Karthik', 'karthik@company.dev', '$2b$12$tCxfNpoVsQHLw.ky7KqcUuQ8s4pHTYDRnpNqNOglau8IDA/2SQp0u', 'Marketing Lead',        'Team Lead', 'Marketing',   '#8b5cf6'),
  ('aaaaaaaa-0008-0008-0008-000000000008', 'Ananya',  'ananya@company.dev',  '$2b$12$dNUdOze5z0XmTuHU3wtt..6PLjoYozeSSRd.ld46dXRRT99frg9LO', 'Strategy Analyst',      'Member',    'Strategy',    '#06b6d4'),
  ('aaaaaaaa-0009-0009-0009-000000000009', 'Admin',   'admin@farmwise.ai',   '$2b$12$cWjcG8E0O2vJhAodapFBTOpr4k./yXId6HyOznfj2xd715YDLAeUW', 'System Administrator',  'Admin',     'General',     '#64748b')
ON CONFLICT (email) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- PROJECTS
-- ────────────────────────────────────────────────────────────
INSERT INTO projects
  (id, title, type, requirement, objective, outcome_type, outcome_description,
   status, priority, owner_id, current_phase, timebox_days, start_date,
   tech_stack, ai_plan)
VALUES
  (
    'bbbbbbbb-0001-0001-0001-000000000001',
    'API Gateway & Rate Limiting Service',
    'engineering',
    'Build a centralized API gateway that handles authentication, rate limiting, and request routing for all our microservices. Should support JWT validation, per-client rate limits, and circuit breaker patterns. Must handle 10k+ requests/second.',
    'Build a high-performance centralized API gateway for all microservices',
    'api_service',
    'Production-ready API gateway with rate limiting, auth, and circuit breaker',
    'active', 'high',
    'aaaaaaaa-0003-0003-0003-000000000003',
    'Development', 21, '2026-04-21',
    '["Go", "Redis", "Docker", "Kubernetes", "Prometheus", "gRPC"]',
    '{"summary": "Build a Go-based API gateway with Redis-backed token bucket rate limiting and gRPC internal communication", "risks": [{"risk": "Redis single point of failure", "mitigation": "Redis Sentinel with 3-node cluster", "severity": "high"}, {"risk": "JWT secret rotation downtime", "mitigation": "Dual-key rotation strategy", "severity": "medium"}], "killCriteria": ["Cannot achieve 10k req/s on 4-core instance", "Memory leak under sustained load"]}'
  ),
  (
    'bbbbbbbb-0002-0002-0002-000000000002',
    'ML-Driven Demand Forecasting Model',
    'data_science',
    'Build a demand forecasting ML model for our agri-supply chain using historical sales data, weather patterns, and seasonal trends. Target: <8% MAPE on 30-day horizon.',
    'Reduce inventory waste by 25% through accurate demand prediction',
    'ml_model',
    'Production ML model with <8% MAPE on 30-day forecast horizon',
    'active', 'high',
    'aaaaaaaa-0002-0002-0002-000000000002',
    'Experiment', 30, '2026-04-17',
    '["Python", "XGBoost", "LightGBM", "MLflow", "Apache Airflow", "AWS SageMaker", "Pandas"]',
    '{"summary": "Ensemble model combining LightGBM for trend and LSTM for seasonality with automated retraining pipeline", "risks": [{"risk": "Data quality issues in historical records", "mitigation": "Data validation pipeline + anomaly detection", "severity": "high"}, {"risk": "Distribution shift in production", "mitigation": "Weekly retraining + drift detection alerts", "severity": "medium"}], "killCriteria": ["MAPE > 15% after 3 iterations", "Retraining cost > $500/month"]}'
  ),
  (
    'bbbbbbbb-0003-0003-0003-000000000003',
    'FarmConnect Design System v2',
    'design',
    'Redesign and document the full FarmConnect component library. Create Figma component library, design tokens, usage guidelines, and handoff specs for engineering team.',
    'Single source of truth for all UI components reducing design inconsistencies',
    'design_system',
    'Figma component library with 60+ components and design tokens',
    'active', 'medium',
    'aaaaaaaa-0006-0006-0006-000000000006',
    'Design', 25, '2026-04-24',
    '["Figma", "Storybook", "Tailwind CSS", "Radix UI"]',
    '{"summary": "Audit existing components, define design tokens, build Figma library, export to Storybook", "risks": [{"risk": "Inconsistent token naming between Figma and code", "mitigation": "Shared token spec agreed upfront", "severity": "medium"}], "killCriteria": ["Engineering team rejects handoff format after 2 revisions"]}'
  ),
  (
    'bbbbbbbb-0004-0004-0004-000000000004',
    'SEA Market Expansion Strategy',
    'strategy',
    'Analyse South-East Asian markets (Vietnam, Thailand, Indonesia) for FarmConnect expansion. Provide go/no-go recommendation with 3-year financial model.',
    'Identify best-fit SEA market for 2027 launch with validated business case',
    'strategy_document',
    'Executive strategy document with market analysis and financial model',
    'active', 'medium',
    'aaaaaaaa-0008-0008-0008-000000000008',
    'Exploration', 45, '2026-04-26',
    '[]',
    '{"summary": "Primary + secondary research across 3 SEA markets with Porter''s Five Forces and financial modelling", "risks": [{"risk": "Limited local market data availability", "mitigation": "Partner with local research firms", "severity": "medium"}], "killCriteria": ["All 3 markets show negative NPV at realistic penetration rates"]}'
  ),
  (
    'bbbbbbbb-0005-0005-0005-000000000005',
    'HR Onboarding Automation',
    'operations',
    'Automate the new-hire onboarding workflow: document collection, system provisioning, buddy assignment, and 30/60/90-day check-ins using internal tools.',
    'Reduce onboarding time from 5 days to 1 day through automation',
    'automation',
    'Automated onboarding workflow handling 10+ concurrent new hires',
    'active', 'low',
    'aaaaaaaa-0007-0007-0007-000000000007',
    'Requirements & Planning', 20, '2026-04-28',
    '["Zapier", "Notion", "Slack API", "Google Workspace"]',
    '{"summary": "No-code automation using Zapier + Slack for provisioning triggers and Notion for documentation", "risks": [{"risk": "IT provisioning API instability", "mitigation": "Manual fallback checklist with notifications", "severity": "low"}], "killCriteria": ["Automation error rate > 10% in first month"]}'
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- PROJECT ASSIGNEES & CO-OWNERS
-- ────────────────────────────────────────────────────────────
INSERT INTO project_assignees (project_id, user_id)
VALUES
  ('bbbbbbbb-0001-0001-0001-000000000001', 'aaaaaaaa-0003-0003-0003-000000000003'),
  ('bbbbbbbb-0001-0001-0001-000000000001', 'aaaaaaaa-0005-0005-0005-000000000005'),
  ('bbbbbbbb-0002-0002-0002-000000000002', 'aaaaaaaa-0002-0002-0002-000000000002'),
  ('bbbbbbbb-0002-0002-0002-000000000002', 'aaaaaaaa-0004-0004-0004-000000000004'),
  ('bbbbbbbb-0003-0003-0003-000000000003', 'aaaaaaaa-0006-0006-0006-000000000006'),
  ('bbbbbbbb-0004-0004-0004-000000000004', 'aaaaaaaa-0008-0008-0008-000000000008'),
  ('bbbbbbbb-0004-0004-0004-000000000004', 'aaaaaaaa-0001-0001-0001-000000000001'),
  ('bbbbbbbb-0005-0005-0005-000000000005', 'aaaaaaaa-0007-0007-0007-000000000007')
ON CONFLICT DO NOTHING;

INSERT INTO project_co_owners (project_id, user_id)
VALUES
  ('bbbbbbbb-0001-0001-0001-000000000001', 'aaaaaaaa-0005-0005-0005-000000000005'),
  ('bbbbbbbb-0002-0002-0002-000000000002', 'aaaaaaaa-0004-0004-0004-000000000004')
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- PHASES
-- Dates based on seed run date 2026-04-29
-- ────────────────────────────────────────────────────────────
INSERT INTO phases
  (id, project_id, phase_name, status, checklist, order_index,
   sign_off_required, estimated_duration, started_at, completed_at)
VALUES
  -- Project 1 — Engineering phases
  ('cccccccc-0101-0101-0101-000000000101', 'bbbbbbbb-0001-0001-0001-000000000001',
   'Requirements & Planning', 'completed',
   '["Define scope","Write requirement doc","Get CEO sign-off"]',
   0, TRUE,  '3 days', '2026-04-21 00:00:00', '2026-04-20 00:00:00'),

  ('cccccccc-0102-0102-0102-000000000102', 'bbbbbbbb-0001-0001-0001-000000000001',
   'Architecture & Design', 'completed',
   '["Create system design","Review with team","Document API contracts"]',
   1, TRUE,  '4 days', '2026-04-22 00:00:00', '2026-04-21 00:00:00'),

  ('cccccccc-0103-0103-0103-000000000103', 'bbbbbbbb-0001-0001-0001-000000000001',
   'Development', 'active',
   '["Implement core features","Write unit tests","Code review"]',
   2, FALSE, '7 days', '2026-04-23 00:00:00', NULL),

  ('cccccccc-0104-0104-0104-000000000104', 'bbbbbbbb-0001-0001-0001-000000000001',
   'Testing & QA', 'pending',
   '["Integration tests","Load testing","Bug fixes"]',
   3, FALSE, '3 days', NULL, NULL),

  ('cccccccc-0105-0105-0105-000000000105', 'bbbbbbbb-0001-0001-0001-000000000001',
   'Deployment', 'pending',
   '["Deploy to staging","Smoke tests","Production deploy"]',
   4, TRUE,  '2 days', NULL, NULL),

  ('cccccccc-0106-0106-0106-000000000106', 'bbbbbbbb-0001-0001-0001-000000000001',
   'Done', 'pending',
   '["Retrospective","Documentation","Handover"]',
   5, FALSE, '1 day',  NULL, NULL),

  -- Project 2 — Research phases
  ('cccccccc-0201-0201-0201-000000000201', 'bbbbbbbb-0002-0002-0002-000000000002',
   'Hypothesis', 'completed',
   '["Define research question","Literature review","Hypothesis statement"]',
   0, TRUE,  '2 days', '2026-04-17 00:00:00', '2026-04-16 00:00:00'),

  ('cccccccc-0202-0202-0202-000000000202', 'bbbbbbbb-0002-0002-0002-000000000002',
   'Exploration', 'completed',
   '["Data gathering","Exploratory analysis","Key findings"]',
   1, FALSE, '4 days', '2026-04-18 00:00:00', '2026-04-17 00:00:00'),

  ('cccccccc-0203-0203-0203-000000000203', 'bbbbbbbb-0002-0002-0002-000000000002',
   'Experiment', 'active',
   '["Design experiments","Run models","Track metrics"]',
   2, FALSE, '5 days', '2026-04-19 00:00:00', NULL),

  ('cccccccc-0204-0204-0204-000000000204', 'bbbbbbbb-0002-0002-0002-000000000002',
   'Evaluation', 'pending',
   '["Analyse results","Peer review","Iterate"]',
   3, TRUE,  '3 days', NULL, NULL),

  ('cccccccc-0205-0205-0205-000000000205', 'bbbbbbbb-0002-0002-0002-000000000002',
   'Report', 'pending',
   '["Write report","Visualisations","Recommendations"]',
   4, TRUE,  '3 days', NULL, NULL),

  ('cccccccc-0206-0206-0206-000000000206', 'bbbbbbbb-0002-0002-0002-000000000002',
   'Done', 'pending',
   '["Present findings","Archive data","Close project"]',
   5, FALSE, '1 day',  NULL, NULL),

  -- Project 3 — Design phases
  ('cccccccc-0301-0301-0301-000000000301', 'bbbbbbbb-0003-0003-0003-000000000003',
   'Discovery', 'completed',
   '["User research","Competitor analysis","Brief alignment"]',
   0, TRUE,  '2 days', '2026-04-24 00:00:00', '2026-04-23 00:00:00'),

  ('cccccccc-0302-0302-0302-000000000302', 'bbbbbbbb-0003-0003-0003-000000000003',
   'Wireframes', 'pending',
   '["Lo-fi wireframes","Information architecture","Stakeholder review"]',
   1, FALSE, '3 days', '2026-04-25 00:00:00', NULL),

  ('cccccccc-0303-0303-0303-000000000303', 'bbbbbbbb-0003-0003-0003-000000000003',
   'Design', 'active',
   '["High-fidelity designs","Component library","Design tokens"]',
   2, FALSE, '5 days', '2026-04-26 00:00:00', NULL),

  ('cccccccc-0304-0304-0304-000000000304', 'bbbbbbbb-0003-0003-0003-000000000003',
   'Handoff', 'pending',
   '["Dev handoff","Design specs","Asset export"]',
   3, TRUE,  '2 days', NULL, NULL)

ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- TASKS
-- ────────────────────────────────────────────────────────────
INSERT INTO tasks
  (id, project_id, phase_id, title, description, assignee_id, status, priority,
   estimated_hours, approach, plan_status, success_criteria, kill_criteria, order_index)
VALUES
  (
    'dddddddd-0001-0001-0001-000000000001',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'cccccccc-0103-0103-0103-000000000103',
    'Architecture & System Design',
    'Complete system architecture, API contracts, data flow diagrams, and tech stack justification.',
    'aaaaaaaa-0003-0003-0003-000000000003',
    'completed', 'high', 16.0,
    'Research existing gateway patterns, benchmark Go stdlib vs NGINX, produce architecture doc.',
    'finalized',
    '["Architecture doc approved", "API contracts defined", "Tech stack justified"]',
    '[]',
    0
  ),
  (
    'dddddddd-0002-0002-0002-000000000002',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'cccccccc-0103-0103-0103-000000000103',
    'Core Routing Engine',
    'Implement request routing engine with path-based routing, load balancing, and health checks.',
    'aaaaaaaa-0005-0005-0005-000000000005',
    'in_progress', 'high', 24.0,
    'Use Go net/http with custom mux. Implement consistent hashing for upstream selection.',
    'finalized',
    '["Routes 10k+ req/s on single core", "Health check failover < 100ms", "Zero memory leaks under 1hr load test"]',
    '["Cannot achieve 8k req/s after optimization"]',
    1
  ),
  (
    'dddddddd-0003-0003-0003-000000000003',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'cccccccc-0103-0103-0103-000000000103',
    'Rate Limiter Implementation',
    'Build token-bucket rate limiter with Redis backend. Support per-client, per-route, and global limits.',
    'aaaaaaaa-0003-0003-0003-000000000003',
    'in_progress', 'high', 20.0,
    'Token bucket with Redis atomic operations (Lua script). Client ID extracted from JWT sub claim.',
    'finalized',
    '["Accurate rate limiting at 10k req/s", "Redis failure graceful degradation", "Per-client limits configurable via API"]',
    '["Redis read latency > 2ms at p99"]',
    2
  ),
  (
    'dddddddd-0004-0004-0004-000000000004',
    'bbbbbbbb-0002-0002-0002-000000000002',
    'cccccccc-0203-0203-0203-000000000203',
    'Feature Engineering Pipeline',
    'Build automated feature engineering pipeline transforming raw sales + weather data into ML-ready features.',
    'aaaaaaaa-0002-0002-0002-000000000002',
    'in_progress', 'high', 32.0,
    'Apache Airflow DAG with pandas transforms. Features: lag variables, rolling stats, weather correlations.',
    'finalized',
    '["Pipeline runs end-to-end without errors", "All 47 features documented", "< 2hr daily refresh time"]',
    '["Data coverage < 80% for target SKUs"]',
    0
  ),
  (
    'dddddddd-0005-0005-0005-000000000005',
    'bbbbbbbb-0002-0002-0002-000000000002',
    'cccccccc-0203-0203-0203-000000000203',
    'LightGBM Baseline Model',
    'Train and evaluate LightGBM baseline model. Establish MAPE benchmark for comparison.',
    'aaaaaaaa-0004-0004-0004-000000000004',
    'completed', 'high', 20.0,
    'LightGBM with Optuna hyperparameter search. Walk-forward cross-validation on 2 years data.',
    'finalized',
    '["MAPE < 12% on validation set", "Model reproducible with fixed seed", "Feature importance documented"]',
    '["MAPE > 20% after tuning — revisit feature set"]',
    1
  ),
  (
    'dddddddd-0006-0006-0006-000000000006',
    'bbbbbbbb-0003-0003-0003-000000000003',
    'cccccccc-0303-0303-0303-000000000303',
    'Core Component Library',
    'Design and document 60+ reusable components in Figma with variants, states, and usage guidelines.',
    'aaaaaaaa-0006-0006-0006-000000000006',
    'in_progress', 'medium', 40.0,
    'Audit existing screens, identify patterns, build atomic components first (atoms → molecules → organisms).',
    'finalized',
    '["60+ components with all states", "Design tokens exported", "Every component has usage doc"]',
    '["Engineering team requests format change after 80% completion"]',
    0
  ),
  (
    'dddddddd-0007-0007-0007-000000000007',
    'bbbbbbbb-0004-0004-0004-000000000004',
    'cccccccc-0202-0202-0202-000000000202',
    'Market Sizing & Competitive Analysis',
    'TAM/SAM/SOM analysis for Vietnam, Thailand, Indonesia. Competitive landscape with 5 local players each.',
    'aaaaaaaa-0008-0008-0008-000000000008',
    'in_progress', 'medium', 24.0,
    'Secondary research via Statista, World Bank data. Primary: 10 farmer interviews per market.',
    'finalized',
    '["Market size validated from 3+ sources", "Top 5 competitors per market profiled", "Pricing benchmarks established"]',
    '["Market data unavailable for 2/3 target markets"]',
    0
  ),
  (
    'dddddddd-0008-0008-0008-000000000008',
    'bbbbbbbb-0005-0005-0005-000000000005',
    'cccccccc-0101-0101-0101-000000000101',
    'Process Mapping & Tool Audit',
    'Document current manual onboarding steps. Audit existing tools (Slack, Notion, G-Suite) for automation hooks.',
    'aaaaaaaa-0007-0007-0007-000000000007',
    'planning', 'medium', 8.0,
    'Interview HR + IT teams. Map current state with swim-lane diagram. Identify automation touchpoints.',
    'ai_generated',
    '["Current process fully documented", "All tools inventoried with API capabilities", "Bottlenecks identified and prioritised"]',
    '[]',
    0
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- TASK STEPS
-- ────────────────────────────────────────────────────────────
INSERT INTO task_steps
  (id, task_id, description, expected_outcome, category, status,
   order_index, estimated_hours, actual_hours, assignee_id)
VALUES
  -- t1 Architecture steps
  ('dcf8df7f-f4a5-44f2-b9d0-a4cd47cb2272', 'dddddddd-0001-0001-0001-000000000001',
   'Research gateway patterns (Envoy, Kong, custom)',
   'Comparison doc with pros/cons',
   'research', 'completed', 0, 4.0, 3.5,
   'aaaaaaaa-0003-0003-0003-000000000003'),

  ('082ab19e-4b1b-4b36-af98-10db6236ebfe', 'dddddddd-0001-0001-0001-000000000001',
   'Draft system architecture document',
   'Architecture doc with component diagrams and data flow',
   'design', 'completed', 1, 6.0, 7.0,
   'aaaaaaaa-0003-0003-0003-000000000003'),

  ('85aa9f2b-e174-41fa-8bcb-d751624cf5c2', 'dddddddd-0001-0001-0001-000000000001',
   'Define API contracts and OpenAPI specs',
   'OpenAPI 3.0 spec for all gateway endpoints',
   'design', 'completed', 2, 4.0, 4.0,
   'aaaaaaaa-0003-0003-0003-000000000003'),

  ('24559a14-44c8-4b03-87dd-5da68448770c', 'dddddddd-0001-0001-0001-000000000001',
   'Peer review and sign-off',
   'Signed-off architecture doc',
   'review', 'completed', 3, 2.0, 2.5,
   'aaaaaaaa-0003-0003-0003-000000000003'),

  -- t2 Routing Engine steps
  ('d58962ac-8d8b-4b91-9372-fa971a226098', 'dddddddd-0002-0002-0002-000000000002',
   'Implement HTTP mux with path-based routing',
   'Working router handling 100+ path patterns',
   'development', 'completed', 0, 8.0, 9.0,
   'aaaaaaaa-0005-0005-0005-000000000005'),

  ('e7e4b2fb-af65-4407-8f82-eaa4aac9ec75', 'dddddddd-0002-0002-0002-000000000002',
   'Add upstream health checking',
   'Health check loop with configurable intervals and thresholds',
   'development', 'in_progress', 1, 6.0, NULL,
   'aaaaaaaa-0005-0005-0005-000000000005'),

  ('6bca5ed9-b088-431c-9f7f-b8c5b744e553', 'dddddddd-0002-0002-0002-000000000002',
   'Implement load balancing strategies',
   'Round-robin + consistent-hash balancers with hot-swap',
   'development', 'pending', 2, 6.0, NULL,
   'aaaaaaaa-0005-0005-0005-000000000005'),

  ('973a0e71-c8b8-4a77-a61c-4afa9a9d324a', 'dddddddd-0002-0002-0002-000000000002',
   'Benchmark and optimise',
   'Benchmark report showing 10k+ req/s',
   'testing', 'pending', 3, 4.0, NULL,
   'aaaaaaaa-0005-0005-0005-000000000005'),

  -- t4 Feature Engineering steps
  ('8209ccd6-60f0-430f-9794-18f769b455a3', 'dddddddd-0004-0004-0004-000000000004',
   'Define feature schema and data contract',
   'Documented feature schema with types and null policies',
   'design', 'completed', 0, 4.0, 4.5,
   'aaaaaaaa-0002-0002-0002-000000000002'),

  ('ed835a8d-761f-4f77-ba65-2d0272230d80', 'dddddddd-0004-0004-0004-000000000004',
   'Implement lag and rolling window features',
   '47 lag/rolling features passing unit tests',
   'development', 'in_progress', 1, 12.0, NULL,
   'aaaaaaaa-0002-0002-0002-000000000002'),

  ('85574175-2d82-442b-a4f7-fe798741fd85', 'dddddddd-0004-0004-0004-000000000004',
   'Add weather correlation features',
   'Weather features with 0.6+ correlation to demand',
   'development', 'pending', 2, 8.0, NULL,
   'aaaaaaaa-0004-0004-0004-000000000004'),

  ('ea7cf230-0f1e-4131-a1b4-e2abf64c9e05', 'dddddddd-0004-0004-0004-000000000004',
   'Airflow DAG and scheduling',
   'DAG running on schedule with alerting on failure',
   'deployment', 'pending', 3, 8.0, NULL,
   'aaaaaaaa-0002-0002-0002-000000000002')

ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- SUBMISSIONS
-- ────────────────────────────────────────────────────────────
INSERT INTO submissions
  (id, phase_id, project_id, user_id, title, type, description,
   link, status, reviewed_by, reviewed_at, is_key_milestone)
VALUES
  (
    'ebb9596b-682e-4bdc-bea1-e11672b113fd',
    'cccccccc-0101-0101-0101-000000000101',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'aaaaaaaa-0003-0003-0003-000000000003',
    'Architecture Design Document', 'document',
    'System architecture with component diagrams and data flow',
    'https://docs.google.com/document/d/arch-v1',
    'approved', 'aaaaaaaa-0001-0001-0001-000000000001',
    '2026-04-22 00:00:00', TRUE
  ),
  (
    'de8094b2-253a-4344-8046-3c2be832aaaa',
    'cccccccc-0102-0102-0102-000000000102',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'aaaaaaaa-0005-0005-0005-000000000005',
    'Routing Engine Benchmark Results', 'data',
    'Performance benchmarks showing 15k req/s on single instance',
    'https://grafana.internal/d/routing-bench',
    'approved', 'aaaaaaaa-0001-0001-0001-000000000001',
    '2026-04-25 00:00:00', TRUE
  ),
  (
    '28db76a9-29c5-46f9-b97c-cf50be4668a8',
    'cccccccc-0103-0103-0103-000000000103',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'aaaaaaaa-0003-0003-0003-000000000003',
    'Rate Limiter PR', 'code',
    'Token bucket implementation with Redis backend',
    'https://github.com/farmwise/api-gateway/pull/42',
    'submitted', NULL, NULL, FALSE
  ),
  (
    '7e0813af-27e7-4ed9-8b52-3ec03381656f',
    'cccccccc-0201-0201-0201-000000000201',
    'bbbbbbbb-0002-0002-0002-000000000002',
    'aaaaaaaa-0002-0002-0002-000000000002',
    'Research Hypothesis Document', 'document',
    'Demand forecasting hypothesis with success metrics and data requirements',
    'https://notion.so/demand-forecast-hypothesis',
    'approved', 'aaaaaaaa-0001-0001-0001-000000000001',
    '2026-04-19 00:00:00', TRUE
  ),
  (
    '241a3c7a-daba-4069-aa2d-2dbf23d4c179',
    'cccccccc-0203-0203-0203-000000000203',
    'bbbbbbbb-0002-0002-0002-000000000002',
    'aaaaaaaa-0004-0004-0004-000000000004',
    'LightGBM Baseline Notebook', 'notebook',
    'LightGBM baseline achieving 11.2% MAPE on validation set',
    'https://sagemaker.console.aws/notebooks/lgbm-baseline',
    'approved', 'aaaaaaaa-0002-0002-0002-000000000002',
    '2026-04-27 00:00:00', TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- FEEDBACK
-- ────────────────────────────────────────────────────────────
INSERT INTO feedback (id, submission_id, from_user_id, text, is_ai)
VALUES
  ('0ad595fd-3536-4f25-b4f7-360ab2cb222a', 'ebb9596b-682e-4bdc-bea1-e11672b113fd',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'Solid architecture. Token bucket approach for rate limiting is the right call. Approve to proceed.',
   FALSE),

  ('a9336901-34ae-4b45-95a0-3a913ab294eb', 'ebb9596b-682e-4bdc-bea1-e11672b113fd',
   'aaaaaaaa-0005-0005-0005-000000000005',
   'Good coverage of failure modes. Suggest adding a section on Redis eviction policy impact.',
   FALSE),

  ('e6698be0-de6e-45fd-b65e-c40e5f52e033', 'de8094b2-253a-4344-8046-3c2be832aaaa',
   'aaaaaaaa-0001-0001-0001-000000000001',
   '15k req/s headroom gives us confidence. Move to Development phase.',
   FALSE),

  ('6f97a8c3-c4e0-4847-aa3e-5a4d7c1af3c6', '7e0813af-27e7-4ed9-8b52-3ec03381656f',
   'aaaaaaaa-0001-0001-0001-000000000001',
   'Hypothesis is well-scoped. 8% MAPE target is aggressive but achievable. Approve.',
   FALSE),

  ('336bee7f-2217-4c76-a128-2df3756567a2', '241a3c7a-daba-4069-aa2d-2dbf23d4c179',
   'aaaaaaaa-0002-0002-0002-000000000002',
   '11.2% MAPE is a solid baseline. Focus on ensemble with LSTM for seasonality next.',
   FALSE),

  ('0542d87f-f653-4074-8c07-59ae8c5c2158', '241a3c7a-daba-4069-aa2d-2dbf23d4c179',
   NULL,
   'Based on the feature importance analysis, consider adding 7-day weather forecast as a leading indicator. Historical weather correlation with demand is 0.71 in similar models.',
   TRUE)

ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- CHECKPOINTS
-- ────────────────────────────────────────────────────────────
INSERT INTO checkpoints (id, project_id, decision, notes, decided_by)
VALUES
  (
    'd581431f-83d3-482e-b67f-139922a6ba82',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'continue',
    'Architecture validated, routing engine on track. Rate limiter PR under review. On schedule for 21-day timebox.',
    'aaaaaaaa-0001-0001-0001-000000000001'
  ),
  (
    'beea52f9-64f2-48fb-ae0e-762edbb889cb',
    'bbbbbbbb-0002-0002-0002-000000000002',
    'continue',
    'Baseline MAPE 11.2% — within striking distance of 8% target. Feature engineering pipeline 60% complete. Approved to proceed to ensemble modelling.',
    'aaaaaaaa-0001-0001-0001-000000000001'
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- LEAVE REQUESTS
-- ────────────────────────────────────────────────────────────
INSERT INTO leave_requests
  (id, user_id, type, start_date, end_date, days, reason,
   status, approved_by, approved_at, cover_person_id, coverage_plan, is_planned)
VALUES
  (
    'c1e0b2ae-95c1-416b-ab58-7cd292278f71',
    'aaaaaaaa-0003-0003-0003-000000000003',
    'planned', '2026-05-13', '2026-05-17', 5,
    'Annual family vacation — booked 6 months in advance.',
    'approved', 'aaaaaaaa-0001-0001-0001-000000000001', '2026-03-30',
    'aaaaaaaa-0005-0005-0005-000000000005',
    'Vikram covers API gateway dev tasks', TRUE
  ),
  (
    'bafb433c-ccb3-4105-afa4-9d7911e9d4a6',
    'aaaaaaaa-0002-0002-0002-000000000002',
    'sick', '2026-04-27', '2026-04-28', 2,
    'Fever and rest recommended by doctor.',
    'approved', 'aaaaaaaa-0001-0001-0001-000000000001', '2026-04-27',
    'aaaaaaaa-0004-0004-0004-000000000004',
    'Meera monitors Airflow DAG runs', FALSE
  ),
  (
    '4e51c4d5-1e58-4ecf-b93a-8ebd565c7bbc',
    'aaaaaaaa-0004-0004-0004-000000000004',
    'planned', '2026-05-06', '2026-05-08', 3,
    'Attending NeurIPS 2026 workshop.',
    'approved', 'aaaaaaaa-0001-0001-0001-000000000001', '2026-04-09',
    'aaaaaaaa-0002-0002-0002-000000000002',
    'Priya handles model review', TRUE
  ),
  (
    '04ecdb80-6a74-433b-9054-cafb61764384',
    'aaaaaaaa-0006-0006-0006-000000000006',
    'personal', '2026-05-02', '2026-05-02', 1,
    'Family commitment.',
    'pending', NULL, NULL, NULL, NULL, TRUE
  ),
  (
    'd67f1dbf-fecb-44d3-b76e-c17370770294',
    'aaaaaaaa-0007-0007-0007-000000000007',
    'wfh', '2026-04-29', '2026-04-29', 1,
    'Working from home for plumber visit.',
    'approved', 'aaaaaaaa-0001-0001-0001-000000000001', '2026-04-29',
    NULL, 'Available on Slack throughout day', TRUE
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- CAPTURE SESSIONS & ITEMS
-- ────────────────────────────────────────────────────────────
INSERT INTO capture_sessions (id, user_id, raw_text)
VALUES (
  '91db9811-b8c9-4eab-9199-5add06cac41d',
  'aaaaaaaa-0001-0001-0001-000000000001',
  'follow up with arjun about rate limiter PR. Meera to present baseline model results friday. Sneha - need wireframes for dashboard by next tuesday. check redis sentinel config before deploy. commitment: CEO review of API gateway architecture doc by eod wednesday.'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO capture_items
  (id, session_id, user_id, type, title, description,
   assignee_id, due_date, priority, status)
VALUES
  (
    '583d9d3e-8133-4d76-bbe2-6bb923052b52',
    '91db9811-b8c9-4eab-9199-5add06cac41d',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'follow_up',
    'Follow up with Arjun on rate limiter PR',
    'Rate limiter PR is pending review — confirm timeline and blockers.',
    'aaaaaaaa-0003-0003-0003-000000000003',
    '2026-04-30', 'high', 'pending'
  ),
  (
    '08dcfa10-4c4f-4693-a65d-21ff8ca938f3',
    '91db9811-b8c9-4eab-9199-5add06cac41d',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'review_reminder',
    'Meera to present baseline model results',
    'LightGBM baseline presentation on Friday standup.',
    'aaaaaaaa-0004-0004-0004-000000000004',
    '2026-05-02', 'medium', 'pending'
  ),
  (
    '2c157f13-8300-49a0-a097-c25ebc4974e4',
    '91db9811-b8c9-4eab-9199-5add06cac41d',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'todo',
    'Review wireframes for dashboard',
    'Sneha needs wireframe sign-off by next Tuesday.',
    'aaaaaaaa-0006-0006-0006-000000000006',
    '2026-05-06', 'medium', 'pending'
  ),
  (
    '6b02be79-b75d-4474-a1a6-7af246af5aac',
    '91db9811-b8c9-4eab-9199-5add06cac41d',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'todo',
    'Check Redis Sentinel configuration',
    'Validate Redis Sentinel quorum and failover settings before production deploy.',
    NULL,
    '2026-05-04', 'high', 'pending'
  ),
  (
    '11ed61b3-e780-4e4e-b87a-e01c08788080',
    '91db9811-b8c9-4eab-9199-5add06cac41d',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'commitment',
    'CEO review of API Gateway architecture doc',
    'Committed to reviewing and signing off by EOD Wednesday.',
    'aaaaaaaa-0001-0001-0001-000000000001',
    '2026-05-01', 'high', 'converted'
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- REVIEW TASKS
-- ────────────────────────────────────────────────────────────
INSERT INTO review_tasks
  (id, title, type, description, assignee_id, requester_id,
   project_id, status, priority, due_date)
VALUES
  (
    'd4c420d9-aca3-41eb-b3d4-b3bb488ab472',
    'Review Rate Limiter PR', 'code',
    'Token bucket rate limiter with Redis backend. Check correctness, edge cases, and performance.',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'aaaaaaaa-0003-0003-0003-000000000003',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'pending', 'high', '2026-04-30'
  ),
  (
    '36a8f47b-912b-4f8f-8f36-2e1762dff8b7',
    'Review LightGBM Notebook', 'notebook',
    'Validate baseline model methodology, feature engineering, and cross-validation approach.',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'aaaaaaaa-0004-0004-0004-000000000004',
    'bbbbbbbb-0002-0002-0002-000000000002',
    'in_progress', 'high', '2026-05-01'
  ),
  (
    '88edd144-3002-4f02-81a3-44f8c5bac6aa',
    'Review Market Sizing Methodology', 'document',
    'Validate TAM/SAM/SOM calculations and data source credibility for SEA market analysis.',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'aaaaaaaa-0008-0008-0008-000000000008',
    'bbbbbbbb-0004-0004-0004-000000000004',
    'pending', 'medium', '2026-05-04'
  ),
  (
    '52589f1a-4ba0-4602-a6e3-1c328dfe0335',
    'Design System Component Review', 'document',
    'Review first 20 components for accessibility, consistency with brand guidelines, and dev handoff readiness.',
    'aaaaaaaa-0003-0003-0003-000000000003',
    'aaaaaaaa-0006-0006-0006-000000000006',
    'bbbbbbbb-0003-0003-0003-000000000003',
    'pending', 'medium', '2026-05-03'
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- AI INSIGHTS
-- ────────────────────────────────────────────────────────────
INSERT INTO ai_insights
  (id, project_id, user_id, type, severity, title, description, action_items, status)
VALUES
  (
    '7c042ffe-a284-4bbb-9fde-73c84241ba14',
    'bbbbbbbb-0001-0001-0001-000000000001', NULL,
    'risk', 'high',
    'Redis single point of failure in rate limiter',
    'Rate limiter depends on single Redis instance. If Redis goes down, rate limiting is disabled — exposing all upstream services to potential overload.',
    '["Set up Redis Sentinel with 3-node cluster", "Implement circuit breaker fallback to in-memory rate limiting"]',
    'active'
  ),
  (
    '9e0e2150-478e-404d-8487-6e54cbad50db',
    'bbbbbbbb-0002-0002-0002-000000000002', NULL,
    'opportunity', 'medium',
    'Weather forecast API integration could reduce MAPE by 2-3%',
    'Leading indicator analysis shows 7-day weather forecast has 0.71 correlation with demand. Adding it as a feature could close the gap to 8% MAPE target.',
    '["Integrate OpenWeather API as feature source", "A/B test model with/without forecast features"]',
    'active'
  ),
  (
    '7ac9e75f-f5b9-4839-9f29-9489589e4c03',
    'bbbbbbbb-0001-0001-0001-000000000001',
    'aaaaaaaa-0005-0005-0005-000000000005',
    'blocker', 'high',
    'Routing engine health check implementation blocked on library decision',
    'Vikram is evaluating 3 health check libraries but decision is delayed 2 days due to benchmarking setup issues.',
    '["Assign benchmarking task to second engineer", "Set 24hr decision deadline"]',
    'active'
  ),
  (
    '12427e94-18bc-4fd7-b1d0-f967a253776a',
    NULL,
    'aaaaaaaa-0003-0003-0003-000000000003',
    'risk', 'medium',
    'Arjun''s upcoming leave may impact API Gateway rate limiter milestone',
    'Arjun is on leave from Apr 28. Rate limiter PR is in review. If not merged by Apr 27, Development phase milestone slips by 5 days.',
    '["Prioritise rate limiter PR review this week", "Brief Vikram on rate limiter code for potential handoff"]',
    'active'
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- DISCUSSIONS & MESSAGES
-- ────────────────────────────────────────────────────────────
INSERT INTO discussions (id, project_id, phase_id, title, author_id, is_resolved)
VALUES (
  '850c8f32-0b06-43b3-9563-434829050c33',
  'bbbbbbbb-0001-0001-0001-000000000001',
  'cccccccc-0103-0103-0103-000000000103',
  'Rate limiting strategy: token bucket vs leaky bucket',
  'aaaaaaaa-0005-0005-0005-000000000005',
  FALSE
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO discussion_messages (id, discussion_id, author_id, content, parent_id)
VALUES
  (
    'a7391095-f11a-4d37-93a3-6345acdf5fdf',
    '850c8f32-0b06-43b3-9563-434829050c33',
    'aaaaaaaa-0005-0005-0005-000000000005',
    'I''m leaning towards token bucket — it allows burst traffic which is friendlier for API clients. Leaky bucket would smooth everything out but could hurt p99 latency. Thoughts?',
    NULL
  ),
  (
    '8fbd8d3f-9f41-4ba8-9956-5aaaafd74641',
    '850c8f32-0b06-43b3-9563-434829050c33',
    'aaaaaaaa-0003-0003-0003-000000000003',
    'Agree. Token bucket is industry standard for API rate limiting (AWS API Gateway, Stripe both use it). The burst allowance is a feature not a bug.',
    NULL
  ),
  (
    '9d5addf8-5e73-4851-8610-094881ff88b1',
    '850c8f32-0b06-43b3-9563-434829050c33',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'Token bucket approved. Make sure the burst size is configurable per client tier — free tier gets smaller burst headroom.',
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- STANDUP ENTRIES
-- ────────────────────────────────────────────────────────────
INSERT INTO standup_entries (id, user_id, date, yesterday, today, blockers, mood)
VALUES
  (
    '4cc30b05-2aca-4058-b8d0-090a9e962764',
    'aaaaaaaa-0003-0003-0003-000000000003', '2026-04-29',
    'Completed routing engine HTTP mux implementation',
    'Working on health check implementation for upstream services',
    'Choosing between 3 health check libraries — decision by EOD', 4
  ),
  (
    '1d47cc16-39f6-4b4a-a439-8a317b0350e7',
    'aaaaaaaa-0005-0005-0005-000000000005', '2026-04-29',
    'Reviewed architecture doc feedback',
    'Starting rate limiter Redis Lua script implementation',
    NULL, 4
  ),
  (
    '41bf109a-7113-47fa-b67f-9036cd0f6ff9',
    'aaaaaaaa-0002-0002-0002-000000000002', '2026-04-29',
    'Fixed data pipeline null handling bug',
    'Implementing weather feature integration in Airflow DAG',
    'OpenWeather API key approval pending from IT', 3
  ),
  (
    '72970106-d98b-46e1-9c82-49765f94a6c8',
    'aaaaaaaa-0004-0004-0004-000000000004', '2026-04-28',
    'LightGBM baseline model training complete — 11.2% MAPE',
    'Hyperparameter search with Optuna',
    NULL, 5
  ),
  (
    'c66c2ad9-2493-457d-ae88-14455368feb3',
    'aaaaaaaa-0006-0006-0006-000000000006', '2026-04-29',
    'Completed Discovery phase deliverables',
    'Starting core component design — buttons, inputs, typography',
    NULL, 4
  )
ON CONFLICT (user_id, date) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
INSERT INTO notifications (id, user_id, type, title, message, is_read)
VALUES
  (
    '7db8885f-d9df-4174-b6d5-b2c6f57fceb7',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'review_requested',
    'Rate Limiter PR needs your review',
    'Arjun submitted the rate limiter implementation for CEO review. Due tomorrow.',
    FALSE
  ),
  (
    '6dcded04-d8c9-4b23-985a-3b1785eb1a36',
    'aaaaaaaa-0001-0001-0001-000000000001',
    'leave_request',
    'Leave request from Sneha',
    'Sneha has requested personal leave on Apr 23. Pending your approval.',
    FALSE
  ),
  (
    '4064c9aa-a7ed-4842-8d04-1a64d111288d',
    'aaaaaaaa-0003-0003-0003-000000000003',
    'task_comment',
    'Vikram commented on your routing engine task',
    'Vikram: ''The round-robin implementation looks good. Small suggestion on the connection pooling logic.''',
    FALSE
  ),
  (
    '62035b37-2795-442c-a04e-4174f1f204e8',
    'aaaaaaaa-0002-0002-0002-000000000002',
    'ai_insight',
    'AI: Weather feature could improve your model',
    'Weather forecast API has 0.71 correlation with demand in similar models. Consider adding as a leading indicator.',
    TRUE
  ),
  (
    'd8ac871b-c89b-44e5-8481-242560587ebe',
    'aaaaaaaa-0005-0005-0005-000000000005',
    'deadline_approaching',
    'Health check implementation due in 2 days',
    'The routing engine health check step has an approaching deadline. Current status: in progress.',
    FALSE
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
