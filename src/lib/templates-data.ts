/**
 * Project template library. Each template pre-fills the new-project wizard
 * with a category, outcome type, suggested phases, tasks, and timebox.
 */
export type TemplatePhase = {
  name: string;
  description: string;
  estimatedDuration: string;
  checklist: string[];
};

export type TemplateTask = {
  title: string;
  description: string;
  estimatedHours: number;
  category: string;
};

export type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  outcomeType: string;
  timeboxDays: number;
  icon: string;          // emoji
  color: string;         // hex
  tags: string[];
  phases: TemplatePhase[];
  sampleTasks: TemplateTask[];
  aiPromptHint: string;  // Prefills the requirement field
  usedBy: number;        // mock usage count for display
};

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  // ── Engineering ──────────────────────────────────────────────
  {
    id: "tmpl-api-service",
    name: "REST API Service",
    description: "Full lifecycle for designing, building, and deploying a production-grade REST API with auth, docs, and monitoring.",
    category: "engineering",
    outcomeType: "api_service",
    timeboxDays: 21,
    icon: "⚡",
    color: "#3b82f6",
    tags: ["backend", "api", "production"],
    phases: [
      { name: "Requirements", description: "Define endpoints, contracts, and auth model", estimatedDuration: "2d", checklist: ["Endpoint list finalized", "Auth strategy chosen", "Rate limiting requirements set", "Error contract documented"] },
      { name: "Design", description: "API design, data models, DB schema", estimatedDuration: "3d", checklist: ["OpenAPI spec written", "DB schema designed", "Sequence diagrams done", "Tech stack justified"] },
      { name: "Development", description: "Core implementation with tests", estimatedDuration: "10d", checklist: ["CRUD endpoints implemented", "Auth middleware added", "Unit tests ≥ 80% coverage", "Integration tests passing"] },
      { name: "Review & Deploy", description: "Code review, staging, production", estimatedDuration: "3d", checklist: ["Code review complete", "Staging deployment verified", "Docs published", "Monitoring configured"] },
      { name: "Done", description: "Post-launch monitoring", estimatedDuration: "3d", checklist: ["Error rate < 0.1%", "Latency p99 < 200ms", "Runbook documented"] },
    ],
    sampleTasks: [
      { title: "Design API contracts & OpenAPI spec", description: "Define all endpoints, request/response shapes, error codes", estimatedHours: 8, category: "design" },
      { title: "Implement core CRUD endpoints", description: "Build main resource endpoints with validation", estimatedHours: 24, category: "development" },
      { title: "Add JWT auth middleware", description: "Token validation, refresh flow, role guards", estimatedHours: 8, category: "development" },
      { title: "Write integration test suite", description: "End-to-end tests for all happy paths and error cases", estimatedHours: 12, category: "testing" },
      { title: "Deploy to staging + load test", description: "Verify performance under expected load", estimatedHours: 6, category: "deployment" },
    ],
    aiPromptHint: "Build a production-ready REST API with JWT authentication, rate limiting, and OpenAPI documentation.",
    usedBy: 14,
  },
  {
    id: "tmpl-frontend-app",
    name: "Web Application",
    description: "React/Next.js web app from wireframes to production, including design system, API integration, and CI/CD.",
    category: "engineering",
    outcomeType: "web_app",
    timeboxDays: 28,
    icon: "🌐",
    color: "#6366f1",
    tags: ["frontend", "react", "nextjs"],
    phases: [
      { name: "Design", description: "Wireframes, component design, UX review", estimatedDuration: "5d", checklist: ["User flows mapped", "Wireframes approved", "Component library chosen", "Responsive breakpoints defined"] },
      { name: "Foundation", description: "Project setup, routing, auth", estimatedDuration: "3d", checklist: ["Next.js project bootstrapped", "Auth wired", "Layout components built", "CI pipeline configured"] },
      { name: "Features", description: "Core feature development", estimatedDuration: "14d", checklist: ["All pages implemented", "API integration complete", "Error states handled", "Loading states added"] },
      { name: "Polish", description: "Animations, accessibility, performance", estimatedDuration: "4d", checklist: ["Lighthouse score ≥ 90", "A11y audit done", "Core Web Vitals green", "Cross-browser tested"] },
      { name: "Deploy", description: "Production deploy", estimatedDuration: "2d", checklist: ["CDN configured", "Domain set up", "Analytics added", "Error tracking live"] },
    ],
    sampleTasks: [
      { title: "Set up project & design system", description: "Configure Next.js, Tailwind, component library", estimatedHours: 6, category: "development" },
      { title: "Build layout & navigation", description: "Sidebar, navbar, routing, mobile responsiveness", estimatedHours: 10, category: "development" },
      { title: "Implement core pages", description: "Build all primary user-facing pages", estimatedHours: 30, category: "development" },
      { title: "API integration layer", description: "Wire frontend to backend APIs with error handling", estimatedHours: 12, category: "integration" },
      { title: "Performance & a11y audit", description: "Lighthouse, axe-core, WCAG compliance", estimatedHours: 8, category: "review" },
    ],
    aiPromptHint: "Build a responsive web application with authentication, API integration, and modern UX.",
    usedBy: 9,
  },

  // ── Data Science ─────────────────────────────────────────────
  {
    id: "tmpl-ml-model",
    name: "ML Model Development",
    description: "End-to-end ML project: EDA, feature engineering, model training, evaluation, and deployment with MLflow tracking.",
    category: "data_science",
    outcomeType: "ml_model",
    timeboxDays: 30,
    icon: "🧠",
    color: "#8b5cf6",
    tags: ["ml", "python", "mlflow"],
    phases: [
      { name: "Problem Definition", description: "Hypothesis, success criteria, data audit", estimatedDuration: "3d", checklist: ["Research question defined", "Success metric agreed", "Data sources identified", "Baseline established"] },
      { name: "EDA", description: "Exploratory data analysis and data quality", estimatedDuration: "5d", checklist: ["Data quality assessed", "Missing values handled", "Key distributions charted", "Feature correlations explored"] },
      { name: "Feature Engineering", description: "Feature creation, selection, and pipeline", estimatedDuration: "5d", checklist: ["Feature candidates shortlisted", "Encoding strategy chosen", "Pipeline built", "Train/val/test split done"] },
      { name: "Modeling", description: "Train, tune, and compare models", estimatedDuration: "10d", checklist: ["Baseline model trained", "≥3 algorithms compared", "Hyperparameters tuned", "Cross-validation done"] },
      { name: "Evaluation & Report", description: "Final assessment and stakeholder presentation", estimatedDuration: "5d", checklist: ["Business metric calculated", "Error analysis complete", "Fairness/bias checked", "Report & slides ready"] },
      { name: "Deployment", description: "Model serving and monitoring", estimatedDuration: "2d", checklist: ["Inference API live", "MLflow model registered", "Drift monitoring set up"] },
    ],
    sampleTasks: [
      { title: "Data ingestion & EDA notebook", description: "Load data, profile quality, key visualizations", estimatedHours: 16, category: "research" },
      { title: "Feature engineering pipeline", description: "Preprocessing, encoding, train/val split", estimatedHours: 12, category: "development" },
      { title: "Model training & comparison", description: "Train baseline + candidate models, log to MLflow", estimatedHours: 20, category: "development" },
      { title: "Hyperparameter tuning", description: "Grid/random search with cross-validation", estimatedHours: 10, category: "research" },
      { title: "Evaluation & stakeholder report", description: "Business metrics, error analysis, presentation", estimatedHours: 12, category: "documentation" },
    ],
    aiPromptHint: "Develop an ML model from raw data to production deployment, including EDA, feature engineering, and model evaluation.",
    usedBy: 11,
  },
  {
    id: "tmpl-data-pipeline",
    name: "Data Pipeline",
    description: "Design and build a robust ETL/ELT data pipeline with scheduling, monitoring, and data quality checks.",
    category: "data_science",
    outcomeType: "data_pipeline",
    timeboxDays: 18,
    icon: "🔄",
    color: "#06b6d4",
    tags: ["etl", "data-engineering", "pipeline"],
    phases: [
      { name: "Design", description: "Source/destination mapping, schema design", estimatedDuration: "3d", checklist: ["Source systems listed", "Schema defined", "SLA agreed", "Tooling chosen"] },
      { name: "Ingestion", description: "Source connectors and raw layer", estimatedDuration: "5d", checklist: ["Connectors built", "Raw data landing", "Incremental load working", "Idempotency verified"] },
      { name: "Transformation", description: "Business logic and data quality", estimatedDuration: "5d", checklist: ["Transformations implemented", "dbt models tested", "Data quality checks running", "Null/duplicate handling done"] },
      { name: "Orchestration & Monitoring", description: "Scheduling, alerting, lineage", estimatedDuration: "3d", checklist: ["DAG scheduled", "Failure alerts configured", "Lineage documented", "SLA monitoring live"] },
      { name: "Done", description: "Handoff and runbook", estimatedDuration: "2d", checklist: ["Runbook written", "On-call docs updated", "Stakeholder demo done"] },
    ],
    sampleTasks: [
      { title: "Source connector development", description: "Build ingestion from all source systems", estimatedHours: 14, category: "development" },
      { title: "Transformation layer (dbt)", description: "Staging, intermediate, and mart models", estimatedHours: 16, category: "development" },
      { title: "Data quality checks", description: "Great Expectations or dbt tests for critical fields", estimatedHours: 8, category: "testing" },
      { title: "Orchestration setup", description: "Airflow/Prefect DAGs with retry and alerting", estimatedHours: 8, category: "deployment" },
    ],
    aiPromptHint: "Build an automated data pipeline that ingests from multiple sources, transforms data, and loads to the data warehouse with quality checks.",
    usedBy: 7,
  },

  // ── Design ───────────────────────────────────────────────────
  {
    id: "tmpl-design-system",
    name: "Design System",
    description: "Create a scalable component library with tokens, documentation, and Figma-to-code workflow.",
    category: "design",
    outcomeType: "design_system",
    timeboxDays: 21,
    icon: "🎨",
    color: "#ec4899",
    tags: ["design", "figma", "components"],
    phases: [
      { name: "Audit & Tokens", description: "Audit existing UI, define design tokens", estimatedDuration: "4d", checklist: ["UI audit complete", "Color palette finalized", "Typography scale defined", "Spacing system documented"] },
      { name: "Core Components", description: "Build foundational components", estimatedDuration: "8d", checklist: ["Button variants done", "Form components done", "Navigation patterns done", "Data display components done"] },
      { name: "Documentation", description: "Storybook, usage guidelines", estimatedDuration: "5d", checklist: ["Storybook deployed", "Usage examples written", "Do/don't guidelines added", "Accessibility notes included"] },
      { name: "Adoption", description: "Roll out to teams, collect feedback", estimatedDuration: "4d", checklist: ["Team demo done", "Migration guide written", "Feedback loop set up", "Version 1.0 tagged"] },
    ],
    sampleTasks: [
      { title: "Design token system", description: "Colors, spacing, typography, shadows in Figma", estimatedHours: 10, category: "design" },
      { title: "Core component library", description: "Buttons, inputs, cards, modals in code", estimatedHours: 24, category: "development" },
      { title: "Storybook setup & docs", description: "Story per component with all variants", estimatedHours: 12, category: "documentation" },
      { title: "Accessibility audit", description: "WCAG 2.1 AA compliance check", estimatedHours: 6, category: "review" },
    ],
    aiPromptHint: "Build a comprehensive design system with design tokens, reusable components, and documentation.",
    usedBy: 5,
  },

  // ── Research ─────────────────────────────────────────────────
  {
    id: "tmpl-market-research",
    name: "Market Research",
    description: "Structured market analysis covering competitive landscape, customer segments, and strategic opportunity identification.",
    category: "research",
    outcomeType: "market_analysis",
    timeboxDays: 14,
    icon: "🔍",
    color: "#10b981",
    tags: ["research", "strategy", "market"],
    phases: [
      { name: "Scoping", description: "Define research questions and methodology", estimatedDuration: "2d", checklist: ["Research questions listed", "Methodology chosen", "Data sources identified", "Deliverable format agreed"] },
      { name: "Data Collection", description: "Primary and secondary research", estimatedDuration: "5d", checklist: ["Competitor analysis done", "Customer interviews scheduled", "Surveys designed", "Desk research complete"] },
      { name: "Analysis", description: "Synthesize findings into insights", estimatedDuration: "4d", checklist: ["Themes identified", "Opportunity gaps mapped", "SWOT done", "Key insights drafted"] },
      { name: "Report", description: "Findings deck and executive summary", estimatedDuration: "3d", checklist: ["Deck reviewed", "Executive summary written", "Recommendations prioritized", "Presented to stakeholders"] },
    ],
    sampleTasks: [
      { title: "Competitive landscape analysis", description: "Map 5-10 competitors across key dimensions", estimatedHours: 12, category: "research" },
      { title: "Customer interview synthesis", description: "Conduct and analyze 5+ user interviews", estimatedHours: 10, category: "research" },
      { title: "Market sizing (TAM/SAM/SOM)", description: "Bottom-up and top-down market size estimate", estimatedHours: 8, category: "research" },
      { title: "Strategic recommendations deck", description: "Slide deck with findings and next steps", estimatedHours: 8, category: "documentation" },
    ],
    aiPromptHint: "Conduct a comprehensive market research study including competitive analysis, customer interviews, and strategic recommendations.",
    usedBy: 8,
  },

  // ── Strategy ─────────────────────────────────────────────────
  {
    id: "tmpl-strategy-doc",
    name: "Strategy Document",
    description: "Develop a structured strategy document with problem framing, options analysis, recommendation, and OKR mapping.",
    category: "strategy",
    outcomeType: "strategy_document",
    timeboxDays: 10,
    icon: "🏆",
    color: "#f59e0b",
    tags: ["strategy", "okrs", "planning"],
    phases: [
      { name: "Problem Framing", description: "Define the strategic question clearly", estimatedDuration: "2d", checklist: ["Problem statement agreed", "Success criteria defined", "Constraints listed", "Stakeholders mapped"] },
      { name: "Options Analysis", description: "Develop and evaluate strategic options", estimatedDuration: "4d", checklist: ["≥3 options developed", "Pros/cons documented", "Risk assessment done", "Financial impact estimated"] },
      { name: "Recommendation", description: "Write recommendation with rationale", estimatedDuration: "2d", checklist: ["Recommendation clear", "Rationale documented", "Risks acknowledged", "OKRs mapped"] },
      { name: "Review & Sign-off", description: "Stakeholder review and approval", estimatedDuration: "2d", checklist: ["CEO reviewed", "Feedback incorporated", "Final version approved", "Next steps assigned"] },
    ],
    sampleTasks: [
      { title: "Problem framing workshop", description: "Facilitate session to align on the strategic question", estimatedHours: 6, category: "research" },
      { title: "Options development", description: "Research and structure 3+ strategic options", estimatedHours: 10, category: "research" },
      { title: "Strategy document draft", description: "Write full strategy doc with analysis and recommendation", estimatedHours: 12, category: "documentation" },
      { title: "Executive presentation", description: "Slide deck for stakeholder review", estimatedHours: 6, category: "documentation" },
    ],
    aiPromptHint: "Develop a strategic document that frames the problem, evaluates options, and delivers a clear recommendation with OKR alignment.",
    usedBy: 6,
  },

  // ── Marketing ────────────────────────────────────────────────
  {
    id: "tmpl-product-launch",
    name: "Product Launch",
    description: "Go-to-market plan for a product launch: messaging, content, campaigns, and post-launch measurement.",
    category: "marketing",
    outcomeType: "campaign",
    timeboxDays: 21,
    icon: "🚀",
    color: "#f97316",
    tags: ["marketing", "gtm", "launch"],
    phases: [
      { name: "Positioning", description: "Messaging, ICP, value proposition", estimatedDuration: "4d", checklist: ["ICP defined", "Value prop written", "Competitive differentiation clear", "Messaging tested"] },
      { name: "Content", description: "Landing page, blog, social assets", estimatedDuration: "7d", checklist: ["Landing page live", "Blog posts scheduled", "Social graphics done", "Email sequence written"] },
      { name: "Campaigns", description: "Paid, organic, partnership activation", estimatedDuration: "5d", checklist: ["Paid campaigns set up", "SEO content published", "Partner co-marketing activated", "PR outreach done"] },
      { name: "Launch Day", description: "Launch execution and monitoring", estimatedDuration: "2d", checklist: ["All channels live", "Analytics tracking verified", "War room briefed", "Real-time dashboard shared"] },
      { name: "Post-launch", description: "Retro and next iteration", estimatedDuration: "3d", checklist: ["KPIs measured vs targets", "Retro done", "Learnings documented", "Next campaign planned"] },
    ],
    sampleTasks: [
      { title: "Positioning & messaging framework", description: "Value prop, tagline, ICP, messaging pillars", estimatedHours: 10, category: "design" },
      { title: "Landing page copywriting & design", description: "Hero, features, social proof, CTA", estimatedHours: 12, category: "design" },
      { title: "Content calendar (6 weeks)", description: "Blog, social, email content plan", estimatedHours: 8, category: "documentation" },
      { title: "Launch campaign setup", description: "Paid ads, email sequences, PR outreach", estimatedHours: 14, category: "development" },
    ],
    aiPromptHint: "Plan and execute a product launch campaign including positioning, content creation, and multi-channel activation.",
    usedBy: 10,
  },
];

export function getTemplateById(id: string): ProjectTemplate | undefined {
  return PROJECT_TEMPLATES.find(t => t.id === id);
}

export function getTemplatesByCategory(category: string): ProjectTemplate[] {
  if (category === "all") return PROJECT_TEMPLATES;
  return PROJECT_TEMPLATES.filter(t => t.category === category);
}
