
#!/usr/bin/env python3
"""
ProjectHub — Production Seed Script
Connects to PostgreSQL and inserts all reference data.
Run: python seed.py
"""

import os
import json
import uuid
from datetime import datetime, timedelta, date
import psycopg2
from psycopg2.extras import execute_values
import bcrypt

# ──────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────
DATABASE_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/projecthub"
)

# ──────────────────────────────────────────────────────────────
# HELPERS
# ──────────────────────────────────────────────────────────────
def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(12)).decode()

def days_ago(n: float) -> datetime:
    return datetime.utcnow() - timedelta(days=n)

def days_from_now(n: float) -> datetime:
    return datetime.utcnow() + timedelta(days=n)

def date_ago(n: int) -> date:
    return date.today() - timedelta(days=n)

def date_from_now(n: int) -> date:
    return date.today() + timedelta(days=n)

# ──────────────────────────────────────────────────────────────
# FIXED IDs  (match frontend mock data)
# ──────────────────────────────────────────────────────────────
U = {
    "u1": "aaaaaaaa-0001-0001-0001-000000000001",  # Rahul  – CEO
    "u2": "aaaaaaaa-0002-0002-0002-000000000002",  # Priya  – Senior Data Scientist
    "u3": "aaaaaaaa-0003-0003-0003-000000000003",  # Arjun  – Full-Stack Engineer
    "u4": "aaaaaaaa-0004-0004-0004-000000000004",  # Meera  – ML Engineer
    "u5": "aaaaaaaa-0005-0005-0005-000000000005",  # Vikram – Backend Engineer
    "u6": "aaaaaaaa-0006-0006-0006-000000000006",  # Sneha  – Product Designer
    "u7": "aaaaaaaa-0007-0007-0007-000000000007",  # Karthik– Marketing Lead
    "u8": "aaaaaaaa-0008-0008-0008-000000000008",  # Ananya – Strategy Analyst
    "admin": "aaaaaaaa-0009-0009-0009-000000000009",
}

P = {
    "p1": "bbbbbbbb-0001-0001-0001-000000000001",  # API Gateway
    "p2": "bbbbbbbb-0002-0002-0002-000000000002",  # ML Demand Forecasting
    "p3": "bbbbbbbb-0003-0003-0003-000000000003",  # Design System
    "p4": "bbbbbbbb-0004-0004-0004-000000000004",  # Market Expansion Strategy
    "p5": "bbbbbbbb-0005-0005-0005-000000000005",  # HR Onboarding Automation
}

PH = {
    # Project 1 phases
    "ph1_1": "cccccccc-0101-0101-0101-000000000101",
    "ph1_2": "cccccccc-0102-0102-0102-000000000102",
    "ph1_3": "cccccccc-0103-0103-0103-000000000103",
    "ph1_4": "cccccccc-0104-0104-0104-000000000104",
    "ph1_5": "cccccccc-0105-0105-0105-000000000105",
    "ph1_6": "cccccccc-0106-0106-0106-000000000106",
    # Project 2 phases
    "ph2_1": "cccccccc-0201-0201-0201-000000000201",
    "ph2_2": "cccccccc-0202-0202-0202-000000000202",
    "ph2_3": "cccccccc-0203-0203-0203-000000000203",
    "ph2_4": "cccccccc-0204-0204-0204-000000000204",
    "ph2_5": "cccccccc-0205-0205-0205-000000000205",
    "ph2_6": "cccccccc-0206-0206-0206-000000000206",
    # Project 3 phases
    "ph3_1": "cccccccc-0301-0301-0301-000000000301",
    "ph3_2": "cccccccc-0302-0302-0302-000000000302",
    "ph3_3": "cccccccc-0303-0303-0303-000000000303",
    "ph3_4": "cccccccc-0304-0304-0304-000000000304",
}

T = {
    "t1": "dddddddd-0001-0001-0001-000000000001",
    "t2": "dddddddd-0002-0002-0002-000000000002",
    "t3": "dddddddd-0003-0003-0003-000000000003",
    "t4": "dddddddd-0004-0004-0004-000000000004",
    "t5": "dddddddd-0005-0005-0005-000000000005",
    "t6": "dddddddd-0006-0006-0006-000000000006",
    "t7": "dddddddd-0007-0007-0007-000000000007",
    "t8": "dddddddd-0008-0008-0008-000000000008",
}

# ──────────────────────────────────────────────────────────────
# SEED DATA
# ──────────────────────────────────────────────────────────────

USERS = [
    (U["u1"],  "Rahul",   "rahul@company.dev",   hash_pw("farmwise2024"), "CEO",                    "CEO",      "Leadership",  "#3b82f6"),
    (U["u2"],  "Priya",   "priya@company.dev",   hash_pw("member2024"),  "Senior Data Scientist",  "Member",   "Data Science","#a855f7"),
    (U["u3"],  "Arjun",   "arjun@company.dev",   hash_pw("lead2024"),    "Full-Stack Engineer",    "Team Lead","Engineering", "#10b981"),
    (U["u4"],  "Meera",   "meera@company.dev",   hash_pw("member2024"),  "ML Engineer",            "Member",   "Data Science","#f59e0b"),
    (U["u5"],  "Vikram",  "vikram@company.dev",  hash_pw("member2024"),  "Backend Engineer",       "Member",   "Engineering", "#ef4444"),
    (U["u6"],  "Sneha",   "sneha@company.dev",   hash_pw("member2024"),  "Product Designer",       "Member",   "Design",      "#ec4899"),
    (U["u7"],  "Karthik", "karthik@company.dev", hash_pw("lead2024"),    "Marketing Lead",         "Team Lead","Marketing",   "#8b5cf6"),
    (U["u8"],  "Ananya",  "ananya@company.dev",  hash_pw("member2024"),  "Strategy Analyst",       "Member",   "Strategy",    "#06b6d4"),
    (U["admin"],"Admin",  "admin@farmwise.ai",   hash_pw("admin2024"),   "System Administrator",   "Admin",    "General",     "#64748b"),
]

# Engineering phase template
ENG_PHASES = [
    ("Requirements & Planning", 0, '["Define scope","Write requirement doc","Get CEO sign-off"]', True,  "3 days"),
    ("Architecture & Design",   1, '["Create system design","Review with team","Document API contracts"]', True, "4 days"),
    ("Development",             2, '["Implement core features","Write unit tests","Code review"]', False, "7 days"),
    ("Testing & QA",            3, '["Integration tests","Load testing","Bug fixes"]', False, "3 days"),
    ("Deployment",              4, '["Deploy to staging","Smoke tests","Production deploy"]', True,  "2 days"),
    ("Done",                    5, '["Retrospective","Documentation","Handover"]', False, "1 day"),
]

# Research phase template
RES_PHASES = [
    ("Hypothesis",  0, '["Define research question","Literature review","Hypothesis statement"]', True,  "2 days"),
    ("Exploration", 1, '["Data gathering","Exploratory analysis","Key findings"]', False, "4 days"),
    ("Experiment",  2, '["Design experiments","Run models","Track metrics"]', False, "5 days"),
    ("Evaluation",  3, '["Analyse results","Peer review","Iterate"]', True, "3 days"),
    ("Report",      4, '["Write report","Visualisations","Recommendations"]', True, "3 days"),
    ("Done",        5, '["Present findings","Archive data","Close project"]', False, "1 day"),
]

# Design phase template
DESIGN_PHASES = [
    ("Discovery",  0, '["User research","Competitor analysis","Brief alignment"]', True,  "2 days"),
    ("Wireframes", 1, '["Lo-fi wireframes","Information architecture","Stakeholder review"]', False, "3 days"),
    ("Design",     2, '["High-fidelity designs","Component library","Design tokens"]', False, "5 days"),
    ("Handoff",    3, '["Dev handoff","Design specs","Asset export"]', True, "2 days"),
]

def insert_users(cur):
    print("  → users")
    execute_values(cur, """
        INSERT INTO users (id, name, email, password_hash, role, role_type, department, avatar_color)
        VALUES %s
        ON CONFLICT (email) DO NOTHING
    """, [(u[0], u[1], u[2], u[3], u[4], u[5], u[6], u[7]) for u in USERS])


def insert_projects(cur):
    print("  → projects")
    now = datetime.utcnow()
    projects = [
        # id, title, type, requirement, objective, outcome_type, outcome_desc, status, priority, owner_id, current_phase, timebox_days, start_date, tech_stack, ai_plan
        (
            P["p1"], "API Gateway & Rate Limiting Service", "engineering",
            "Build a centralized API gateway that handles authentication, rate limiting, and request routing for all our microservices. Should support JWT validation, per-client rate limits, and circuit breaker patterns. Must handle 10k+ requests/second.",
            "Build a high-performance centralized API gateway for all microservices",
            "api_service", "Production-ready API gateway with rate limiting, auth, and circuit breaker",
            "active", "high", U["u3"], "Development", 21,
            date_ago(8),
            json.dumps(["Go", "Redis", "Docker", "Kubernetes", "Prometheus", "gRPC"]),
            json.dumps({
                "summary": "Build a Go-based API gateway with Redis-backed token bucket rate limiting and gRPC internal communication",
                "risks": [
                    {"risk": "Redis single point of failure", "mitigation": "Redis Sentinel with 3-node cluster", "severity": "high"},
                    {"risk": "JWT secret rotation downtime", "mitigation": "Dual-key rotation strategy", "severity": "medium"},
                ],
                "killCriteria": ["Cannot achieve 10k req/s on 4-core instance", "Memory leak under sustained load"]
            })
        ),
        (
            P["p2"], "ML-Driven Demand Forecasting Model", "data_science",
            "Build a demand forecasting ML model for our agri-supply chain using historical sales data, weather patterns, and seasonal trends. Target: <8% MAPE on 30-day horizon.",
            "Reduce inventory waste by 25% through accurate demand prediction",
            "ml_model", "Production ML model with <8% MAPE on 30-day forecast horizon",
            "active", "high", U["u2"], "Experiment", 30,
            date_ago(12),
            json.dumps(["Python", "XGBoost", "LightGBM", "MLflow", "Apache Airflow", "AWS SageMaker", "Pandas"]),
            json.dumps({
                "summary": "Ensemble model combining LightGBM for trend and LSTM for seasonality with automated retraining pipeline",
                "risks": [
                    {"risk": "Data quality issues in historical records", "mitigation": "Data validation pipeline + anomaly detection", "severity": "high"},
                    {"risk": "Distribution shift in production", "mitigation": "Weekly retraining + drift detection alerts", "severity": "medium"},
                ],
                "killCriteria": ["MAPE > 15% after 3 iterations", "Retraining cost > $500/month"]
            })
        ),
        (
            P["p3"], "FarmConnect Design System v2", "design",
            "Redesign and document the full FarmConnect component library. Create Figma component library, design tokens, usage guidelines, and handoff specs for engineering team.",
            "Single source of truth for all UI components reducing design inconsistencies",
            "design_system", "Figma component library with 60+ components and design tokens",
            "active", "medium", U["u6"], "Design", 25,
            date_ago(5),
            json.dumps(["Figma", "Storybook", "Tailwind CSS", "Radix UI"]),
            json.dumps({
                "summary": "Audit existing components, define design tokens, build Figma library, export to Storybook",
                "risks": [
                    {"risk": "Inconsistent token naming between Figma and code", "mitigation": "Shared token spec agreed upfront", "severity": "medium"},
                ],
                "killCriteria": ["Engineering team rejects handoff format after 2 revisions"]
            })
        ),
        (
            P["p4"], "SEA Market Expansion Strategy", "strategy",
            "Analyse South-East Asian markets (Vietnam, Thailand, Indonesia) for FarmConnect expansion. Provide go/no-go recommendation with 3-year financial model.",
            "Identify best-fit SEA market for 2027 launch with validated business case",
            "strategy_document", "Executive strategy document with market analysis and financial model",
            "active", "medium", U["u8"], "Exploration", 45,
            date_ago(3),
            json.dumps([]),
            json.dumps({
                "summary": "Primary + secondary research across 3 SEA markets with Porter's Five Forces and financial modelling",
                "risks": [
                    {"risk": "Limited local market data availability", "mitigation": "Partner with local research firms", "severity": "medium"},
                ],
                "killCriteria": ["All 3 markets show negative NPV at realistic penetration rates"]
            })
        ),
        (
            P["p5"], "HR Onboarding Automation", "operations",
            "Automate the new-hire onboarding workflow: document collection, system provisioning, buddy assignment, and 30/60/90-day check-ins using internal tools.",
            "Reduce onboarding time from 5 days to 1 day through automation",
            "automation", "Automated onboarding workflow handling 10+ concurrent new hires",
            "active", "low", U["u7"], "Requirements & Planning", 20,
            date_ago(1),
            json.dumps(["Zapier", "Notion", "Slack API", "Google Workspace"]),
            json.dumps({
                "summary": "No-code automation using Zapier + Slack for provisioning triggers and Notion for documentation",
                "risks": [
                    {"risk": "IT provisioning API instability", "mitigation": "Manual fallback checklist with notifications", "severity": "low"},
                ],
                "killCriteria": ["Automation error rate > 10% in first month"]
            })
        ),
    ]
    execute_values(cur, """
        INSERT INTO projects
          (id, title, type, requirement, objective, outcome_type, outcome_description,
           status, priority, owner_id, current_phase, timebox_days, start_date,
           tech_stack, ai_plan)
        VALUES %s
        ON CONFLICT (id) DO NOTHING
    """, projects)


def insert_project_assignees(cur):
    print("  → project assignees")
    rows = [
        (P["p1"], U["u3"]), (P["p1"], U["u5"]),
        (P["p2"], U["u2"]), (P["p2"], U["u4"]),
        (P["p3"], U["u6"]),
        (P["p4"], U["u8"]), (P["p4"], U["u1"]),
        (P["p5"], U["u7"]),
    ]
    execute_values(cur, """
        INSERT INTO project_assignees (project_id, user_id)
        VALUES %s ON CONFLICT DO NOTHING
    """, rows)
    # Co-owners
    co_owners = [
        (P["p1"], U["u5"]),
        (P["p2"], U["u4"]),
    ]
    execute_values(cur, """
        INSERT INTO project_co_owners (project_id, user_id)
        VALUES %s ON CONFLICT DO NOTHING
    """, co_owners)


def insert_phases(cur):
    print("  → phases")
    rows = []
    # Project 1 – Engineering phases
    for phase_name, order, checklist, sign_off, est_dur in ENG_PHASES:
        pid = list(PH.values())[order]   # ph1_1 .. ph1_6
        status = "completed" if order < 2 else ("active" if order == 2 else "pending")
        started = days_ago(8 - order) if order <= 2 else None
        completed = days_ago(8 - order + 1) if order < 2 else None
        rows.append((
            pid, P["p1"], phase_name, status, checklist, order,
            sign_off, est_dur, started, completed
        ))

    # Project 2 – Research phases
    res_phase_keys = ["ph2_1","ph2_2","ph2_3","ph2_4","ph2_5","ph2_6"]
    for i, (phase_name, order, checklist, sign_off, est_dur) in enumerate(RES_PHASES):
        status = "completed" if order < 2 else ("active" if order == 2 else "pending")
        started = days_ago(12 - order) if order <= 2 else None
        completed = days_ago(12 - order + 1) if order < 2 else None
        rows.append((
            PH[res_phase_keys[i]], P["p2"], phase_name, status, checklist, order,
            sign_off, est_dur, started, completed
        ))

    # Project 3 – Design phases
    design_phase_keys = ["ph3_1","ph3_2","ph3_3","ph3_4"]
    for i, (phase_name, order, checklist, sign_off, est_dur) in enumerate(DESIGN_PHASES):
        status = "completed" if order < 1 else ("active" if order == 2 else "pending")
        started = days_ago(5 - order) if order <= 2 else None
        completed = days_ago(5 - order + 1) if order < 1 else None
        rows.append((
            PH[design_phase_keys[i]], P["p3"], phase_name, status, checklist, order,
            sign_off, est_dur, started, completed
        ))

    execute_values(cur, """
        INSERT INTO phases
          (id, project_id, phase_name, status, checklist, order_index,
           sign_off_required, estimated_duration, started_at, completed_at)
        VALUES %s ON CONFLICT (id) DO NOTHING
    """, rows)


def insert_tasks(cur):
    print("  → tasks")
    tasks = [
        # id, project_id, phase_id, title, description, assignee_id, status, priority,
        # estimated_hours, approach, plan_status, success_criteria, kill_criteria, order_index
        (
            T["t1"], P["p1"], PH["ph1_3"],
            "Architecture & System Design",
            "Complete system architecture, API contracts, data flow diagrams, and tech stack justification.",
            U["u3"], "completed", "high", 16.0,
            "Research existing gateway patterns, benchmark Go stdlib vs NGINX, produce architecture doc.",
            "finalized",
            json.dumps(["Architecture doc approved", "API contracts defined", "Tech stack justified"]),
            json.dumps([]),
            0
        ),
        (
            T["t2"], P["p1"], PH["ph1_3"],
            "Core Routing Engine",
            "Implement request routing engine with path-based routing, load balancing, and health checks.",
            U["u5"], "in_progress", "high", 24.0,
            "Use Go net/http with custom mux. Implement consistent hashing for upstream selection.",
            "finalized",
            json.dumps(["Routes 10k+ req/s on single core", "Health check failover < 100ms", "Zero memory leaks under 1hr load test"]),
            json.dumps(["Cannot achieve 8k req/s after optimization"]),
            1
        ),
        (
            T["t3"], P["p1"], PH["ph1_3"],
            "Rate Limiter Implementation",
            "Build token-bucket rate limiter with Redis backend. Support per-client, per-route, and global limits.",
            U["u3"], "in_progress", "high", 20.0,
            "Token bucket with Redis atomic operations (Lua script). Client ID extracted from JWT sub claim.",
            "finalized",
            json.dumps(["Accurate rate limiting at 10k req/s", "Redis failure graceful degradation", "Per-client limits configurable via API"]),
            json.dumps(["Redis read latency > 2ms at p99"]),
            2
        ),
        (
            T["t4"], P["p2"], PH["ph2_3"],
            "Feature Engineering Pipeline",
            "Build automated feature engineering pipeline transforming raw sales + weather data into ML-ready features.",
            U["u2"], "in_progress", "high", 32.0,
            "Apache Airflow DAG with pandas transforms. Features: lag variables, rolling stats, weather correlations.",
            "finalized",
            json.dumps(["Pipeline runs end-to-end without errors", "All 47 features documented", "< 2hr daily refresh time"]),
            json.dumps(["Data coverage < 80% for target SKUs"]),
            0
        ),
        (
            T["t5"], P["p2"], PH["ph2_3"],
            "LightGBM Baseline Model",
            "Train and evaluate LightGBM baseline model. Establish MAPE benchmark for comparison.",
            U["u4"], "completed", "high", 20.0,
            "LightGBM with Optuna hyperparameter search. Walk-forward cross-validation on 2 years data.",
            "finalized",
            json.dumps(["MAPE < 12% on validation set", "Model reproducible with fixed seed", "Feature importance documented"]),
            json.dumps(["MAPE > 20% after tuning — revisit feature set"]),
            1
        ),
        (
            T["t6"], P["p3"], PH["ph3_3"],
            "Core Component Library",
            "Design and document 60+ reusable components in Figma with variants, states, and usage guidelines.",
            U["u6"], "in_progress", "medium", 40.0,
            "Audit existing screens, identify patterns, build atomic components first (atoms → molecules → organisms).",
            "finalized",
            json.dumps(["60+ components with all states", "Design tokens exported", "Every component has usage doc"]),
            json.dumps(["Engineering team requests format change after 80% completion"]),
            0
        ),
        (
            T["t7"], P["p4"], PH["ph2_2"],
            "Market Sizing & Competitive Analysis",
            "TAM/SAM/SOM analysis for Vietnam, Thailand, Indonesia. Competitive landscape with 5 local players each.",
            U["u8"], "in_progress", "medium", 24.0,
            "Secondary research via Statista, World Bank data. Primary: 10 farmer interviews per market.",
            "finalized",
            json.dumps(["Market size validated from 3+ sources", "Top 5 competitors per market profiled", "Pricing benchmarks established"]),
            json.dumps(["Market data unavailable for 2/3 target markets"]),
            0
        ),
        (
            T["t8"], P["p5"], PH["ph1_1"],
            "Process Mapping & Tool Audit",
            "Document current manual onboarding steps. Audit existing tools (Slack, Notion, G-Suite) for automation hooks.",
            U["u7"], "planning", "medium", 8.0,
            "Interview HR + IT teams. Map current state with swim-lane diagram. Identify automation touchpoints.",
            "ai_generated",
            json.dumps(["Current process fully documented", "All tools inventoried with API capabilities", "Bottlenecks identified and prioritised"]),
            json.dumps([]),
            0
        ),
    ]
    execute_values(cur, """
        INSERT INTO tasks
          (id, project_id, phase_id, title, description, assignee_id, status, priority,
           estimated_hours, approach, plan_status, success_criteria, kill_criteria, order_index)
        VALUES %s ON CONFLICT (id) DO NOTHING
    """, tasks)


def insert_task_steps(cur):
    print("  → task steps")
    steps = [
        # t1 – Architecture steps
        (str(uuid.uuid4()), T["t1"], "Research gateway patterns (Envoy, Kong, custom)",
         "Comparison doc with pros/cons", "research", "completed", 0, 4.0, 3.5, U["u3"]),
        (str(uuid.uuid4()), T["t1"], "Draft system architecture document",
         "Architecture doc with component diagrams and data flow", "design", "completed", 1, 6.0, 7.0, U["u3"]),
        (str(uuid.uuid4()), T["t1"], "Define API contracts and OpenAPI specs",
         "OpenAPI 3.0 spec for all gateway endpoints", "design", "completed", 2, 4.0, 4.0, U["u3"]),
        (str(uuid.uuid4()), T["t1"], "Peer review and sign-off",
         "Signed-off architecture doc", "review", "completed", 3, 2.0, 2.5, U["u3"]),
        # t2 – Routing Engine steps
        (str(uuid.uuid4()), T["t2"], "Implement HTTP mux with path-based routing",
         "Working router handling 100+ path patterns", "development", "completed", 0, 8.0, 9.0, U["u5"]),
        (str(uuid.uuid4()), T["t2"], "Add upstream health checking",
         "Health check loop with configurable intervals and thresholds", "development", "in_progress", 1, 6.0, None, U["u5"]),
        (str(uuid.uuid4()), T["t2"], "Implement load balancing strategies",
         "Round-robin + consistent-hash balancers with hot-swap", "development", "pending", 2, 6.0, None, U["u5"]),
        (str(uuid.uuid4()), T["t2"], "Benchmark and optimise",
         "Benchmark report showing 10k+ req/s", "testing", "pending", 3, 4.0, None, U["u5"]),
        # t4 – Feature engineering steps
        (str(uuid.uuid4()), T["t4"], "Define feature schema and data contract",
         "Documented feature schema with types and null policies", "design", "completed", 0, 4.0, 4.5, U["u2"]),
        (str(uuid.uuid4()), T["t4"], "Implement lag and rolling window features",
         "47 lag/rolling features passing unit tests", "development", "in_progress", 1, 12.0, None, U["u2"]),
        (str(uuid.uuid4()), T["t4"], "Add weather correlation features",
         "Weather features with 0.6+ correlation to demand", "development", "pending", 2, 8.0, None, U["u4"]),
        (str(uuid.uuid4()), T["t4"], "Airflow DAG and scheduling",
         "DAG running on schedule with alerting on failure", "deployment", "pending", 3, 8.0, None, U["u2"]),
    ]
    execute_values(cur, """
        INSERT INTO task_steps
          (id, task_id, description, expected_outcome, category, status,
           order_index, estimated_hours, actual_hours, assignee_id)
        VALUES %s ON CONFLICT (id) DO NOTHING
    """, steps)


def insert_submissions(cur):
    print("  → submissions")
    subs = [
        (str(uuid.uuid4()), PH["ph1_1"], P["p1"], U["u3"],
         "Architecture Design Document", "document",
         "System architecture with component diagrams and data flow",
         "https://docs.google.com/document/d/arch-v1", "approved",
         U["u1"], days_ago(7), True),
        (str(uuid.uuid4()), PH["ph1_2"], P["p1"], U["u5"],
         "Routing Engine Benchmark Results", "data",
         "Performance benchmarks showing 15k req/s on single instance",
         "https://grafana.internal/d/routing-bench", "approved",
         U["u1"], days_ago(4), True),
        (str(uuid.uuid4()), PH["ph1_3"], P["p1"], U["u3"],
         "Rate Limiter PR", "code",
         "Token bucket implementation with Redis backend",
         "https://github.com/farmwise/api-gateway/pull/42", "submitted",
         None, None, False),
        (str(uuid.uuid4()), PH["ph2_1"], P["p2"], U["u2"],
         "Research Hypothesis Document", "document",
         "Demand forecasting hypothesis with success metrics and data requirements",
         "https://notion.so/demand-forecast-hypothesis", "approved",
         U["u1"], days_ago(10), True),
        (str(uuid.uuid4()), PH["ph2_3"], P["p2"], U["u4"],
         "LightGBM Baseline Notebook", "notebook",
         "LightGBM baseline achieving 11.2% MAPE on validation set",
         "https://sagemaker.console.aws/notebooks/lgbm-baseline", "approved",
         U["u2"], days_ago(2), True),
    ]
    execute_values(cur, """
        INSERT INTO submissions
          (id, phase_id, project_id, user_id, title, type, description,
           link, status, reviewed_by, reviewed_at, is_key_milestone)
        VALUES %s ON CONFLICT (id) DO NOTHING
    """, subs)
    return [s[0] for s in subs]


def insert_feedback(cur, submission_ids):
    print("  → feedback")
    fb = [
        (str(uuid.uuid4()), submission_ids[0], U["u1"],
         "Solid architecture. Token bucket approach for rate limiting is the right call. Approve to proceed.", False),
        (str(uuid.uuid4()), submission_ids[0], U["u5"],
         "Good coverage of failure modes. Suggest adding a section on Redis eviction policy impact.", False),
        (str(uuid.uuid4()), submission_ids[1], U["u1"],
         "15k req/s headroom gives us confidence. Move to Development phase.", False),
        (str(uuid.uuid4()), submission_ids[3], U["u1"],
         "Hypothesis is well-scoped. 8% MAPE target is aggressive but achievable. Approve.", False),
        (str(uuid.uuid4()), submission_ids[4], U["u2"],
         "11.2% MAPE is a solid baseline. Focus on ensemble with LSTM for seasonality next.", False),
        (str(uuid.uuid4()), submission_ids[4], None,
         "Based on the feature importance analysis, consider adding 7-day weather forecast as a leading indicator. Historical weather correlation with demand is 0.71 in similar models.",
         True),  # AI feedback
    ]
    execute_values(cur, """
        INSERT INTO feedback (id, submission_id, from_user_id, text, is_ai)
        VALUES %s ON CONFLICT (id) DO NOTHING
    """, fb)


def insert_checkpoints(cur):
    print("  → checkpoints")
    rows = [
        (str(uuid.uuid4()), P["p1"], "continue",
         "Architecture validated, routing engine on track. Rate limiter PR under review. On schedule for 21-day timebox.",
         U["u1"]),
        (str(uuid.uuid4()), P["p2"], "continue",
         "Baseline MAPE 11.2% — within striking distance of 8% target. Feature engineering pipeline 60% complete. Approved to proceed to ensemble modelling.",
         U["u1"]),
    ]
    execute_values(cur, """
        INSERT INTO checkpoints (id, project_id, decision, notes, decided_by)
        VALUES %s ON CONFLICT (id) DO NOTHING
    """, rows)


def insert_leave_requests(cur):
    print("  → leave requests")
    rows = [
        (str(uuid.uuid4()), U["u3"], "planned",
         date_from_now(14), date_from_now(18), 5,
         "Annual family vacation — booked 6 months in advance.",
         "approved", U["u1"], days_ago(30).date(),
         U["u5"], "Vikram covers API gateway dev tasks", True),
        (str(uuid.uuid4()), U["u2"], "sick",
         date_ago(2), date_ago(1), 2,
         "Fever and rest recommended by doctor.",
         "approved", U["u1"], days_ago(2).date(),
         U["u4"], "Meera monitors Airflow DAG runs", False),
        (str(uuid.uuid4()), U["u4"], "planned",
         date_from_now(7), date_from_now(9), 3,
         "Attending NeurIPS 2026 workshop.",
         "approved", U["u1"], days_ago(20).date(),
         U["u2"], "Priya handles model review", True),
        (str(uuid.uuid4()), U["u6"], "personal",
         date_from_now(3), date_from_now(3), 1,
         "Family commitment.",
         "pending", None, None,
         None, None, True),
        (str(uuid.uuid4()), U["u7"], "wfh",
         date.today(), date.today(), 1,
         "Working from home for plumber visit.",
         "approved", U["u1"], date.today(),
         None, "Available on Slack throughout day", True),
    ]
    execute_values(cur, """
        INSERT INTO leave_requests
          (id, user_id, type, start_date, end_date, days, reason,
           status, approved_by, approved_at, cover_person_id,
           coverage_plan, is_planned)
        VALUES %s ON CONFLICT (id) DO NOTHING
    """, rows)


def insert_capture_sessions(cur):
    print("  → capture sessions & items")
    sess_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO capture_sessions (id, user_id, raw_text)
        VALUES (%s, %s, %s)
        ON CONFLICT (id) DO NOTHING
    """, (
        sess_id, U["u1"],
        "follow up with arjun about rate limiter PR. Meera to present baseline model results friday. Sneha - need wireframes for dashboard by next tuesday. check redis sentinel config before deploy. commitment: CEO review of API gateway architecture doc by eod wednesday."
    ))

    items = [
        (str(uuid.uuid4()), sess_id, U["u1"], "follow_up",
         "Follow up with Arjun on rate limiter PR",
         "Rate limiter PR is pending review — confirm timeline and blockers.",
         U["u3"], date_from_now(1), "high", "pending"),
        (str(uuid.uuid4()), sess_id, U["u1"], "review_reminder",
         "Meera to present baseline model results",
         "LightGBM baseline presentation on Friday standup.",
         U["u4"], date_from_now(3), "medium", "pending"),
        (str(uuid.uuid4()), sess_id, U["u1"], "todo",
         "Review wireframes for dashboard",
         "Sneha needs wireframe sign-off by next Tuesday.",
         U["u6"], date_from_now(7), "medium", "pending"),
        (str(uuid.uuid4()), sess_id, U["u1"], "todo",
         "Check Redis Sentinel configuration",
         "Validate Redis Sentinel quorum and failover settings before production deploy.",
         None, date_from_now(5), "high", "pending"),
        (str(uuid.uuid4()), sess_id, U["u1"], "commitment",
         "CEO review of API Gateway architecture doc",
         "Committed to reviewing and signing off by EOD Wednesday.",
         U["u1"], date_from_now(2), "high", "converted"),
    ]
    execute_values(cur, """
        INSERT INTO capture_items
          (id, session_id, user_id, type, title, description,
           assignee_id, due_date, priority, status)
        VALUES %s ON CONFLICT (id) DO NOTHING
    """, items)


def insert_review_tasks(cur):
    print("  → review tasks")
    rows = [
        (str(uuid.uuid4()), "Review Rate Limiter PR", "code",
         "Token bucket rate limiter with Redis backend. Check correctness, edge cases, and performance.",
         U["u1"], U["u3"], P["p1"], "pending", "high", date_from_now(1)),
        (str(uuid.uuid4()), "Review LightGBM Notebook", "notebook",
         "Validate baseline model methodology, feature engineering, and cross-validation approach.",
         U["u1"], U["u4"], P["p2"], "in_progress", "high", date_from_now(2)),
        (str(uuid.uuid4()), "Review Market Sizing Methodology", "document",
         "Validate TAM/SAM/SOM calculations and data source credibility for SEA market analysis.",
         U["u1"], U["u8"], P["p4"], "pending", "medium", date_from_now(5)),
        (str(uuid.uuid4()), "Design System Component Review", "document",
         "Review first 20 components for accessibility, consistency with brand guidelines, and dev handoff readiness.",
         U["u3"], U["u6"], P["p3"], "pending", "medium", date_from_now(4)),
    ]
    execute_values(cur, """
        INSERT INTO review_tasks
          (id, title, type, description, assignee_id, requester_id,
           project_id, status, priority, due_date)
        VALUES %s ON CONFLICT (id) DO NOTHING
    """, rows)


def insert_ai_insights(cur):
    print("  → ai insights")
    rows = [
        (str(uuid.uuid4()), P["p1"], None, "risk", "high",
         "Redis single point of failure in rate limiter",
         "Rate limiter depends on single Redis instance. If Redis goes down, rate limiting is disabled — exposing all upstream services to potential overload.",
         json.dumps(["Set up Redis Sentinel with 3-node cluster", "Implement circuit breaker fallback to in-memory rate limiting"]),
         "active"),
        (str(uuid.uuid4()), P["p2"], None, "opportunity", "medium",
         "Weather forecast API integration could reduce MAPE by 2-3%",
         "Leading indicator analysis shows 7-day weather forecast has 0.71 correlation with demand. Adding it as a feature could close the gap to 8% MAPE target.",
         json.dumps(["Integrate OpenWeather API as feature source", "A/B test model with/without forecast features"]),
         "active"),
        (str(uuid.uuid4()), P["p1"], U["u5"], "blocker", "high",
         "Routing engine health check implementation blocked on library decision",
         "Vikram is evaluating 3 health check libraries but decision is delayed 2 days due to benchmarking setup issues.",
         json.dumps(["Assign benchmarking task to second engineer", "Set 24hr decision deadline"]),
         "active"),
        (str(uuid.uuid4()), None, U["u3"], "risk", "medium",
         "Arjun's upcoming leave may impact API Gateway rate limiter milestone",
         "Arjun is on leave from Apr 28. Rate limiter PR is in review. If not merged by Apr 27, Development phase milestone slips by 5 days.",
         json.dumps(["Prioritise rate limiter PR review this week", "Brief Vikram on rate limiter code for potential handoff"]),
         "active"),
    ]
    execute_values(cur, """
        INSERT INTO ai_insights
          (id, project_id, user_id, type, severity, title, description, action_items, status)
        VALUES %s ON CONFLICT (id) DO NOTHING
    """, rows)


def insert_discussions(cur):
    print("  → discussions")
    disc_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO discussions (id, project_id, phase_id, title, author_id, is_resolved)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO NOTHING
    """, (disc_id, P["p1"], PH["ph1_3"],
          "Rate limiting strategy: token bucket vs leaky bucket", U["u5"], False))

    msgs = [
        (str(uuid.uuid4()), disc_id, U["u5"],
         "I'm leaning towards token bucket — it allows burst traffic which is friendlier for API clients. Leaky bucket would smooth everything out but could hurt p99 latency. Thoughts?",
         None),
        (str(uuid.uuid4()), disc_id, U["u3"],
         "Agree. Token bucket is industry standard for API rate limiting (AWS API Gateway, Stripe both use it). The burst allowance is a feature not a bug.", None),
        (str(uuid.uuid4()), disc_id, U["u1"],
         "Token bucket approved. Make sure the burst size is configurable per client tier — free tier gets smaller burst headroom.", None),
    ]
    execute_values(cur, """
        INSERT INTO discussion_messages (id, discussion_id, author_id, content, parent_id)
        VALUES %s ON CONFLICT (id) DO NOTHING
    """, msgs)


def insert_standup_entries(cur):
    print("  → standup entries")
    today = date.today()
    yesterday = date_ago(1)
    rows = [
        (str(uuid.uuid4()), U["u3"], today,
         "Completed routing engine HTTP mux implementation",
         "Working on health check implementation for upstream services",
         "Choosing between 3 health check libraries — decision by EOD", 4),
        (str(uuid.uuid4()), U["u5"], today,
         "Reviewed architecture doc feedback",
         "Starting rate limiter Redis Lua script implementation",
         None, 4),
        (str(uuid.uuid4()), U["u2"], today,
         "Fixed data pipeline null handling bug",
         "Implementing weather feature integration in Airflow DAG",
         "OpenWeather API key approval pending from IT", 3),
        (str(uuid.uuid4()), U["u4"], yesterday,
         "LightGBM baseline model training complete — 11.2% MAPE",
         "Hyperparameter search with Optuna",
         None, 5),
        (str(uuid.uuid4()), U["u6"], today,
         "Completed Discovery phase deliverables",
         "Starting core component design — buttons, inputs, typography",
         None, 4),
    ]
    execute_values(cur, """
        INSERT INTO standup_entries (id, user_id, date, yesterday, today, blockers, mood)
        VALUES %s ON CONFLICT (user_id, date) DO NOTHING
    """, rows)


def insert_notifications(cur):
    print("  → notifications")
    rows = [
        (str(uuid.uuid4()), U["u1"], "review_requested",
         "Rate Limiter PR needs your review",
         "Arjun submitted the rate limiter implementation for CEO review. Due tomorrow.", False),
        (str(uuid.uuid4()), U["u1"], "leave_request",
         "Leave request from Sneha",
         "Sneha has requested personal leave on Apr 23. Pending your approval.", False),
        (str(uuid.uuid4()), U["u3"], "task_comment",
         "Vikram commented on your routing engine task",
         "Vikram: 'The round-robin implementation looks good. Small suggestion on the connection pooling logic.'", False),
        (str(uuid.uuid4()), U["u2"], "ai_insight",
         "AI: Weather feature could improve your model",
         "Weather forecast API has 0.71 correlation with demand in similar models. Consider adding as a leading indicator.", True),
        (str(uuid.uuid4()), U["u5"], "deadline_approaching",
         "Health check implementation due in 2 days",
         "The routing engine health check step has an approaching deadline. Current status: in progress.", False),
    ]
    execute_values(cur, """
        INSERT INTO notifications (id, user_id, type, title, message, is_read)
        VALUES %s ON CONFLICT (id) DO NOTHING
    """, rows)


# ──────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────
def seed():
    print(f"Connecting to: {DATABASE_URL[:40]}...")
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        print("Seeding database…")
        insert_users(cur)
        insert_projects(cur)
        insert_project_assignees(cur)
        insert_phases(cur)
        insert_tasks(cur)
        insert_task_steps(cur)
        sub_ids = insert_submissions(cur)
        insert_feedback(cur, sub_ids)
        insert_checkpoints(cur)
        insert_leave_requests(cur)
        insert_capture_sessions(cur)
        insert_review_tasks(cur)
        insert_ai_insights(cur)
        insert_discussions(cur)
        insert_standup_entries(cur)
        insert_notifications(cur)
        conn.commit()
        print("✓ Seed complete.")
    except Exception as e:
        conn.rollback()
        print(f"✗ Seed failed: {e}")
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    seed()
