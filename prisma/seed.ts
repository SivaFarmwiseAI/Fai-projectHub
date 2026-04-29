// @ts-nocheck
import { PrismaClient } from "../src/generated/prisma/client.js";

const ENGINEERING_PHASES = [
  { name: "Requirements", checklist: ["Problem statement defined", "Success criteria documented", "Stakeholders identified", "Scope boundaries set"] },
  { name: "Design", checklist: ["Architecture diagram provided", "Tech stack justified", "API contracts defined", "Data models designed"] },
  { name: "Development", checklist: ["Core features implemented", "Unit tests written", "Code reviewed", "Integration tests passing"] },
  { name: "Review", checklist: ["Code review complete", "Performance benchmarks met", "Security review done", "Documentation updated"] },
  { name: "Deploy", checklist: ["Staging deployment successful", "QA sign-off received", "Rollback plan documented", "Monitoring configured"] },
  { name: "Done", checklist: ["Post-mortem completed", "Metrics baseline established"] },
];

const RESEARCH_PHASES = [
  { name: "Hypothesis", checklist: ["Research question defined", "Hypothesis stated", "Success metrics identified", "Literature review done"] },
  { name: "Exploration", checklist: ["Data sources identified", "Data quality assessed", "EDA completed", "Feature candidates listed"] },
  { name: "Experiment", checklist: ["Baseline model established", "Experiments tracked", "Hyperparameter tuning done", "Results reproducible"] },
  { name: "Evaluation", checklist: ["Model performance evaluated", "Compared against baseline", "Error analysis complete", "Business impact estimated"] },
  { name: "Report", checklist: ["Findings documented", "Recommendations made", "Presentation prepared", "Next steps outlined"] },
  { name: "Done", checklist: ["Knowledge transferred", "Artifacts archived"] },
];

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.feedback.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.checkpoint.deleteMany();
  await prisma.phase.deleteMany();
  await prisma.projectAssignee.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();

  // Create team members
  const rahul = await prisma.user.create({
    data: {
      name: "Rahul",
      role: "CEO",
      email: "rahul@projecthub.dev",
      avatarColor: "#3b82f6",
    },
  });

  const priya = await prisma.user.create({
    data: {
      name: "Priya",
      role: "Senior Data Scientist",
      email: "priya@projecthub.dev",
      avatarColor: "#a855f7",
    },
  });

  const arjun = await prisma.user.create({
    data: {
      name: "Arjun",
      role: "Full-Stack Engineer",
      email: "arjun@projecthub.dev",
      avatarColor: "#10b981",
    },
  });

  const meera = await prisma.user.create({
    data: {
      name: "Meera",
      role: "ML Engineer",
      email: "meera@projecthub.dev",
      avatarColor: "#f59e0b",
    },
  });

  const vikram = await prisma.user.create({
    data: {
      name: "Vikram",
      role: "Backend Engineer",
      email: "vikram@projecthub.dev",
      avatarColor: "#ef4444",
    },
  });

  // Engineering Project: API Gateway
  const engPhases = ENGINEERING_PHASES;
  const engProject = await prisma.project.create({
    data: {
      title: "API Gateway & Rate Limiting Service",
      type: "engineering",
      requirement:
        "Build a centralized API gateway that handles authentication, rate limiting, and request routing for all our microservices. Should support JWT validation, per-client rate limits, and circuit breaker patterns. Must handle 10k+ requests/second.",
      status: "active",
      priority: "high",
      currentPhase: "Development",
      timeboxDays: 21,
      startDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // started 8 days ago
      techStack: JSON.stringify([
        "Go",
        "Redis",
        "Docker",
        "Kubernetes",
        "Prometheus",
        "gRPC",
      ]),
      aiPlan: JSON.stringify({
        summary:
          "Build a high-performance API gateway with rate limiting, auth, and circuit breaker capabilities",
        milestones: [
          {
            name: "Architecture Finalized",
            description: "Gateway architecture and tech decisions locked",
            targetDay: 4,
          },
          {
            name: "Core Gateway Live",
            description: "Request routing and JWT auth working",
            targetDay: 12,
          },
          {
            name: "Production Ready",
            description:
              "Rate limiting, circuit breaker, monitoring all integrated",
            targetDay: 21,
          },
        ],
        techStack: ["Go", "Redis", "Docker", "Kubernetes", "Prometheus", "gRPC"],
        risks: [
          {
            risk: "Performance bottleneck at scale",
            mitigation: "Load test early with k6, profile hot paths",
            severity: "high",
          },
          {
            risk: "Redis single point of failure",
            mitigation: "Use Redis Sentinel or Cluster mode",
            severity: "medium",
          },
        ],
        killCriteria: [
          "Cannot achieve 5k req/s after optimization",
          "Security audit reveals fundamental design flaw",
          "Team blocked for 5+ consecutive days",
        ],
      }),
      assignees: {
        create: [{ userId: arjun.id }, { userId: vikram.id }],
      },
      phases: {
        create: engPhases.map((phase, index) => ({
          phaseName: phase.name,
          status:
            index < 2 ? "completed" : index === 2 ? "active" : "pending",
          checklist: JSON.stringify(phase.checklist),
          order: index,
        })),
      },
    },
    include: { phases: true },
  });

  // Add submissions to the engineering project
  const engDesignPhase = engProject.phases.find(
    (p) => p.phaseName === "Design"
  )!;
  const engDevPhase = engProject.phases.find(
    (p) => p.phaseName === "Development"
  )!;

  const archSubmission = await prisma.submission.create({
    data: {
      phaseId: engDesignPhase.id,
      projectId: engProject.id,
      userId: arjun.id,
      title: "API Gateway Architecture Document",
      type: "architecture",
      description:
        "Detailed architecture for the gateway including request flow diagrams, component interactions, and deployment topology. Covers JWT validation flow, rate limiter design using token bucket algorithm, and circuit breaker state machine.",
      link: "",
    },
  });

  await prisma.feedback.create({
    data: {
      submissionId: archSubmission.id,
      fromUserId: rahul.id,
      text: "Solid architecture. The token bucket approach for rate limiting is the right call. One concern: we should document the failover behavior when Redis is unavailable. Also, add a section on observability — what metrics do we expose from the gateway?",
      isAi: false,
    },
  });

  const prSubmission = await prisma.submission.create({
    data: {
      phaseId: engDevPhase.id,
      projectId: engProject.id,
      userId: vikram.id,
      title: "Core routing and JWT middleware PR",
      type: "code",
      description:
        "Implements the core request routing engine and JWT validation middleware. Includes unit tests for all auth flows. Benchmark shows ~15k req/s on M1 Mac for authenticated routes.",
    },
  });

  // This submission has no feedback yet — will show in review queue
  await prisma.submission.create({
    data: {
      phaseId: engDevPhase.id,
      projectId: engProject.id,
      userId: arjun.id,
      title: "Rate limiter implementation with Redis backend",
      type: "code",
      description:
        "Token bucket rate limiter with sliding window counters. Supports per-client and per-endpoint limits. Falls back to in-memory limiter if Redis is down. Includes integration tests with testcontainers.",
    },
  });

  // Add a checkpoint
  await prisma.checkpoint.create({
    data: {
      projectId: engProject.id,
      decision: "continue",
      notes:
        "Day 8 check-in: Requirements and Design phases completed on schedule. Core routing is implemented and performing well (15k req/s exceeds our target). Rate limiter PR is in review. Main risk is the Redis failover scenario — team is addressing this in the current sprint. On track for the Day 12 milestone.",
      createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
    },
  });

  // Research Project: Churn Prediction
  const resPhases = RESEARCH_PHASES;
  const resProject = await prisma.project.create({
    data: {
      title: "Customer Churn Prediction Model",
      type: "research",
      requirement:
        "Build a machine learning model to predict customer churn for our SaaS product. We have 18 months of customer data including usage patterns, support tickets, billing history, and feature adoption. Goal is to identify at-risk customers 30 days before churn with >80% precision.",
      status: "active",
      priority: "critical",
      currentPhase: "Experiment",
      timeboxDays: 28,
      startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // started 14 days ago
      techStack: JSON.stringify([
        "Python",
        "Pandas",
        "XGBoost",
        "Scikit-learn",
        "Jupyter",
        "MLflow",
        "SHAP",
      ]),
      aiPlan: JSON.stringify({
        summary:
          "Develop a churn prediction model using customer behavioral data with focus on actionable early warning signals",
        milestones: [
          {
            name: "Data Understanding",
            description: "EDA complete, features identified",
            targetDay: 7,
          },
          {
            name: "Model Baseline",
            description: "First model trained, baseline metrics established",
            targetDay: 18,
          },
          {
            name: "Production Model",
            description: "Final model with >80% precision, report delivered",
            targetDay: 28,
          },
        ],
        techStack: [
          "Python",
          "Pandas",
          "XGBoost",
          "Scikit-learn",
          "Jupyter",
          "MLflow",
          "SHAP",
        ],
        risks: [
          {
            risk: "Data quality issues in legacy records",
            mitigation: "Early data audit, define imputation strategy",
            severity: "high",
          },
          {
            risk: "Class imbalance — churn events may be rare",
            mitigation: "Use SMOTE, class weights, and appropriate metrics",
            severity: "medium",
          },
          {
            risk: "Feature leakage from post-churn data",
            mitigation: "Strict temporal train/test split, feature audit",
            severity: "high",
          },
        ],
        killCriteria: [
          "Cannot achieve 60% precision after full experiment cycle",
          "Data quality too poor for reliable predictions (>30% missing key fields)",
          "Churn definition cannot be agreed upon by stakeholders",
        ],
      }),
      assignees: {
        create: [{ userId: priya.id }, { userId: meera.id }],
      },
      phases: {
        create: resPhases.map((phase, index) => ({
          phaseName: phase.name,
          status:
            index < 2 ? "completed" : index === 2 ? "active" : "pending",
          checklist: JSON.stringify(phase.checklist),
          order: index,
        })),
      },
    },
    include: { phases: true },
  });

  const resExplorationPhase = resProject.phases.find(
    (p) => p.phaseName === "Exploration"
  )!;
  const resExperimentPhase = resProject.phases.find(
    (p) => p.phaseName === "Experiment"
  )!;

  const edaSubmission = await prisma.submission.create({
    data: {
      phaseId: resExplorationPhase.id,
      projectId: resProject.id,
      userId: priya.id,
      title: "EDA Notebook — Customer Behavioral Patterns",
      type: "notebook",
      description:
        "Comprehensive EDA covering 18 months of customer data. Key findings: (1) Usage drop-off 2 weeks before churn is strongest signal, (2) Support ticket frequency correlates with churn (r=0.42), (3) Customers who don't adopt key features in first 30 days have 3x churn rate. Data quality is good — only 4% missing values in critical fields.",
    },
  });

  await prisma.feedback.create({
    data: {
      submissionId: edaSubmission.id,
      fromUserId: rahul.id,
      text: "Excellent EDA. The finding about feature adoption in the first 30 days is very actionable — we should flag this for the product team regardless of model outcome. One question: did you check for seasonal patterns in churn? Our Q4 renewals might skew the data.",
      isAi: false,
    },
  });

  // Pending review submission
  await prisma.submission.create({
    data: {
      phaseId: resExperimentPhase.id,
      projectId: resProject.id,
      userId: meera.id,
      title: "Baseline Model Results — Logistic Regression vs XGBoost",
      type: "notebook",
      description:
        "Trained baseline models on temporal train/test split. Logistic Regression: 72% precision, 65% recall. XGBoost: 78% precision, 71% recall. Feature importance shows usage_drop_14d, support_tickets_30d, and days_since_key_feature_adoption as top 3 predictors. Next step: hyperparameter tuning and SHAP analysis.",
    },
  });

  // Third project — completed
  await prisma.project.create({
    data: {
      title: "Internal Dashboard Redesign",
      type: "engineering",
      requirement:
        "Redesign the internal analytics dashboard to improve load time and add real-time data streaming. Current dashboard takes 12s to load and data is 15 minutes stale.",
      status: "completed",
      priority: "medium",
      currentPhase: "Done",
      timeboxDays: 14,
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      techStack: JSON.stringify([
        "React",
        "TypeScript",
        "WebSocket",
        "D3.js",
        "Redis",
      ]),
      aiPlan: JSON.stringify({
        summary:
          "Rebuild internal dashboard with real-time streaming and optimized queries",
      }),
      assignees: {
        create: [{ userId: arjun.id }],
      },
      phases: {
        create: engPhases.map((phase, index) => ({
          phaseName: phase.name,
          status: "completed",
          checklist: JSON.stringify(phase.checklist),
          order: index,
        })),
      },
    },
  });

  console.log("Seeded database successfully!");
  console.log(`  - 5 team members`);
  console.log(`  - 3 projects (2 active, 1 completed)`);
  console.log(`  - Submissions and feedback included`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
