import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createHash } from 'crypto';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

function hashPassword(password: string): string {
  return createHash('sha256').update(password + 'projecthub_salt_2024').digest('hex');
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '..', 'dev.db');

// Set the DATABASE_URL that prisma config reads
process.env.DATABASE_URL = `file:${dbPath}`;

const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });

const mod = await import('../src/generated/prisma/client.ts');
const PrismaClient = mod.PrismaClient;
const prisma = new PrismaClient({ adapter });

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

await prisma.feedback.deleteMany();
await prisma.submission.deleteMany();
await prisma.checkpoint.deleteMany();
await prisma.phase.deleteMany();
await prisma.projectAssignee.deleteMany();
await prisma.project.deleteMany();
await prisma.user.deleteMany();

// Admin user — full system access
await prisma.user.create({
  data: {
    name: "Admin", role: "System Administrator", email: "admin@farmwise.ai",
    avatarColor: "#ea580c", department: "Administration", roleType: "Admin",
    passwordHash: hashPassword("admin2024"),
  },
});

const rahul = await prisma.user.create({
  data: {
    name: "Rahul", role: "CEO", email: "rahul@farmwise.ai",
    avatarColor: "#3b82f6", department: "Leadership", roleType: "CEO",
    passwordHash: hashPassword("farmwise2024"),
  },
});
const priya = await prisma.user.create({
  data: {
    name: "Priya", role: "Senior Data Scientist", email: "priya@farmwise.ai",
    avatarColor: "#a855f7", department: "Data Science", roleType: "Member",
    passwordHash: hashPassword("member2024"),
  },
});
const arjun = await prisma.user.create({
  data: {
    name: "Arjun", role: "Full-Stack Engineer", email: "arjun@farmwise.ai",
    avatarColor: "#10b981", department: "Engineering", roleType: "Team Lead",
    passwordHash: hashPassword("lead2024"),
  },
});
const meera = await prisma.user.create({
  data: {
    name: "Meera", role: "ML Engineer", email: "meera@farmwise.ai",
    avatarColor: "#f59e0b", department: "Data Science", roleType: "Member",
    passwordHash: hashPassword("member2024"),
  },
});
const vikram = await prisma.user.create({
  data: {
    name: "Vikram", role: "Backend Engineer", email: "vikram@farmwise.ai",
    avatarColor: "#ef4444", department: "Engineering", roleType: "Member",
    passwordHash: hashPassword("member2024"),
  },
});
const sneha = await prisma.user.create({
  data: {
    name: "Sneha", role: "Product Designer", email: "sneha@farmwise.ai",
    avatarColor: "#ec4899", department: "Design", roleType: "Member",
    passwordHash: hashPassword("member2024"),
  },
});

const engProject = await prisma.project.create({
  data: {
    title: "API Gateway & Rate Limiting Service",
    type: "engineering",
    requirement: "Build a centralized API gateway that handles authentication, rate limiting, and request routing for all our microservices. Must handle 10k+ requests/second.",
    status: "active",
    priority: "high",
    currentPhase: "Development",
    timeboxDays: 21,
    startDate: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    techStack: JSON.stringify(["Go", "Redis", "Docker", "Kubernetes", "Prometheus", "gRPC"]),
    aiPlan: JSON.stringify({
      summary: "Build a high-performance API gateway with rate limiting, auth, and circuit breaker capabilities",
      milestones: [
        { name: "Architecture Finalized", description: "Gateway architecture and tech decisions locked", targetDay: 4 },
        { name: "Core Gateway Live", description: "Request routing and JWT auth working", targetDay: 12 },
        { name: "Production Ready", description: "Rate limiting, circuit breaker, monitoring all integrated", targetDay: 21 },
      ],
      risks: [
        { risk: "Performance bottleneck at scale", mitigation: "Load test early with k6", severity: "high" },
        { risk: "Redis single point of failure", mitigation: "Use Redis Sentinel", severity: "medium" },
      ],
      killCriteria: ["Cannot achieve 5k req/s after optimization", "Security audit reveals fundamental design flaw"],
    }),
    assignees: { create: [{ userId: arjun.id }, { userId: vikram.id }] },
    phases: {
      create: ENGINEERING_PHASES.map((phase, index) => ({
        phaseName: phase.name,
        status: index < 2 ? "completed" : index === 2 ? "active" : "pending",
        checklist: JSON.stringify(phase.checklist),
        order: index,
      })),
    },
  },
  include: { phases: true },
});

const engDesignPhase = engProject.phases.find((p: any) => p.phaseName === "Design")!;
const engDevPhase = engProject.phases.find((p: any) => p.phaseName === "Development")!;

const archSub = await prisma.submission.create({
  data: {
    phaseId: engDesignPhase.id, projectId: engProject.id, userId: arjun.id,
    title: "API Gateway Architecture Document", type: "architecture",
    description: "Detailed architecture covering request flow, JWT validation, token bucket rate limiter, and circuit breaker state machine.",
  },
});
await prisma.feedback.create({
  data: {
    submissionId: archSub.id, fromUserId: rahul.id, isAi: false,
    text: "Solid architecture. Token bucket approach is the right call. Add failover behavior docs and observability section.",
  },
});
await prisma.submission.create({
  data: {
    phaseId: engDevPhase.id, projectId: engProject.id, userId: vikram.id,
    title: "Core routing and JWT middleware PR", type: "code",
    description: "Core request routing engine and JWT validation middleware. Unit tests included. Benchmarks: ~15k req/s on M1 Mac.",
  },
});
await prisma.submission.create({
  data: {
    phaseId: engDevPhase.id, projectId: engProject.id, userId: arjun.id,
    title: "Rate limiter implementation with Redis backend", type: "code",
    description: "Token bucket rate limiter with sliding window counters. Per-client and per-endpoint limits. In-memory fallback if Redis is down.",
  },
});
await prisma.checkpoint.create({
  data: {
    projectId: engProject.id, decision: "continue",
    notes: "Day 8: Requirements and Design completed on schedule. Core routing performing well (15k req/s). Rate limiter in review. On track.",
    createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
});

const resProject = await prisma.project.create({
  data: {
    title: "Customer Churn Prediction Model",
    type: "research",
    requirement: "Build an ML model to predict customer churn. 18 months of data available. Goal: identify at-risk customers 30 days before churn with >80% precision.",
    status: "active",
    priority: "critical",
    currentPhase: "Experiment",
    timeboxDays: 28,
    startDate: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    techStack: JSON.stringify(["Python", "Pandas", "XGBoost", "Scikit-learn", "Jupyter", "MLflow", "SHAP"]),
    aiPlan: JSON.stringify({
      summary: "Develop churn prediction model using customer behavioral data",
      milestones: [
        { name: "Data Understanding", description: "EDA complete", targetDay: 7 },
        { name: "Model Baseline", description: "First model trained", targetDay: 18 },
        { name: "Production Model", description: "Final model >80% precision", targetDay: 28 },
      ],
      risks: [
        { risk: "Data quality issues", mitigation: "Early data audit", severity: "high" },
        { risk: "Class imbalance", mitigation: "Use SMOTE and class weights", severity: "medium" },
      ],
      killCriteria: ["Cannot achieve 60% precision", "Data quality too poor (>30% missing)"],
    }),
    assignees: { create: [{ userId: priya.id }, { userId: meera.id }] },
    phases: {
      create: RESEARCH_PHASES.map((phase, index) => ({
        phaseName: phase.name,
        status: index < 2 ? "completed" : index === 2 ? "active" : "pending",
        checklist: JSON.stringify(phase.checklist),
        order: index,
      })),
    },
  },
  include: { phases: true },
});

const resExplPhase = resProject.phases.find((p: any) => p.phaseName === "Exploration")!;
const resExpPhase = resProject.phases.find((p: any) => p.phaseName === "Experiment")!;

const edaSub = await prisma.submission.create({
  data: {
    phaseId: resExplPhase.id, projectId: resProject.id, userId: priya.id,
    title: "EDA Notebook — Customer Behavioral Patterns", type: "notebook",
    description: "EDA of 18 months of data. Key findings: usage drop-off 2 weeks before churn, support tickets correlate (r=0.42), non-adopters have 3x churn rate.",
  },
});
await prisma.feedback.create({
  data: {
    submissionId: edaSub.id, fromUserId: rahul.id, isAi: false,
    text: "Excellent EDA. Feature adoption finding is very actionable — flag for product team. Check for seasonal patterns in Q4 renewals.",
  },
});
await prisma.submission.create({
  data: {
    phaseId: resExpPhase.id, projectId: resProject.id, userId: meera.id,
    title: "Baseline Model Results — LR vs XGBoost", type: "notebook",
    description: "LR: 72% precision, 65% recall. XGBoost: 78% precision, 71% recall. Top features: usage_drop_14d, support_tickets_30d, days_since_key_feature_adoption.",
  },
});

await prisma.project.create({
  data: {
    title: "Internal Dashboard Redesign",
    type: "engineering",
    requirement: "Redesign analytics dashboard for faster loads and real-time data streaming.",
    status: "completed",
    priority: "medium",
    currentPhase: "Done",
    timeboxDays: 14,
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    techStack: JSON.stringify(["React", "TypeScript", "WebSocket", "D3.js", "Redis"]),
    aiPlan: JSON.stringify({ summary: "Rebuild dashboard with real-time streaming" }),
    assignees: { create: [{ userId: arjun.id }] },
    phases: {
      create: ENGINEERING_PHASES.map((phase, index) => ({
        phaseName: phase.name, status: "completed",
        checklist: JSON.stringify(phase.checklist), order: index,
      })),
    },
  },
});

console.log("Seeded successfully! 7 users (Admin + 6 team), 3 projects, submissions & feedback.");
await prisma.$disconnect();
