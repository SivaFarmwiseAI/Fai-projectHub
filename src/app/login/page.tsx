"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles, Eye, EyeOff, ArrowRight, Shield,
  Zap, BarChart3, Lock, Mail, Check, TrendingUp,
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { showToast } from "@/lib/toast";

const CACHE_EMAIL_KEY    = "ph_email";
const CACHE_REMEMBER_KEY = "ph_remember";

const features = [
  { icon: BarChart3,  label: "Real-time analytics", desc: "Track every phase from planning to delivery",    color: "#3b82f6" },
  { icon: Zap,        label: "AI insights",          desc: "Claude AI reviews, plans, and flags risks",      color: "#8b5cf6" },
  { icon: Shield,     label: "Team governance",      desc: "Full audit trail with checkpoint decisions",      color: "#06b6d4" },
  { icon: TrendingUp, label: "Progress tracking",    desc: "Milestones and timebox dashboards live",          color: "#10b981" },
];

const demoUsers = [
  { label: "CEO",       name: "Anand V",          email: "anand@farmwise.ai",        password: "FarmwiseAI@2026", color: "#1e40af", initials: "AV" },
  { label: "Team Lead", name: "Siva Vignesh",      email: "siva@farmwise.ai",         password: "FarmwiseAI@2026", color: "#10b981", initials: "SV" },
  { label: "Member",    name: "Mani Bharathi",     email: "manibharathi@farmwise.ai", password: "FarmwiseAI@2026", color: "#059669", initials: "MB" },
  { label: "Data",      name: "Vishwanathan",      email: "vishwanathan@farmwise.ai", password: "FarmwiseAI@2026", color: "#a855f7", initials: "VM" },
];

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();

  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe,   setRememberMe]   = useState(false);
  const [error,        setError]        = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [mounted,      setMounted]      = useState(false);
  const [activeDemo,   setActiveDemo]   = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const remembered = localStorage.getItem(CACHE_REMEMBER_KEY) === "true";
      setRememberMe(remembered);
      if (remembered) setEmail(localStorage.getItem(CACHE_EMAIL_KEY) ?? "");
    } catch {}
  }, []);

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  function handleEmailChange(val: string) {
    setEmail(val);
    setError("");
    if (rememberMe) try { localStorage.setItem(CACHE_EMAIL_KEY, val); } catch {}
  }

  function toggleRememberMe() {
    const next = !rememberMe;
    setRememberMe(next);
    try {
      localStorage.setItem(CACHE_REMEMBER_KEY, String(next));
      if (next) localStorage.setItem(CACHE_EMAIL_KEY, email);
      else      localStorage.removeItem(CACHE_EMAIL_KEY);
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    if (rememberMe) try { localStorage.setItem(CACHE_EMAIL_KEY, email); } catch {}
    const result = await login(email, password);
    if (result.success) {
      showToast.success("Welcome back!", "Redirecting to your command center…");
      router.replace("/");
    } else {
      const msg = result.error ?? "Login failed";
      setError(msg);
      showToast.error("Login failed", msg);
      setSubmitting(false);
    }
  }

  function fillDemo(u: typeof demoUsers[0]) {
    setEmail(u.email);
    setPassword(u.password);
    setError("");
    setActiveDemo(u.label);
    if (rememberMe) try { localStorage.setItem(CACHE_EMAIL_KEY, u.email); } catch {}
  }

  if (!mounted || isLoading) return null;
  if (isAuthenticated) return null;

  return (
    <div className="h-screen w-screen overflow-hidden flex font-sans">

      {/* ═══════════════════════════════════════════════════════════
          LEFT PANEL — desktop only (lg+)
          Dark gradient · logo · hero · 2×2 feature grid · CEO footer
      ═══════════════════════════════════════════════════════════ */}
      <aside
        className="hidden lg:flex lg:w-[52%] h-full flex-col justify-between p-12 relative overflow-hidden shrink-0"
        style={{ background: "linear-gradient(140deg, #080d1a 0%, #111040 45%, #0d2540 100%)" }}
      >
        {/* ── Animated orbs ── */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="animate-blob absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(59,130,246,0.28) 0%, transparent 65%)" }}
          />
          <div
            className="animate-blob-delay-1 absolute top-1/2 -right-24 w-[400px] h-[400px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(139,92,246,0.22) 0%, transparent 65%)" }}
          />
          <div
            className="animate-blob-delay-2 absolute -bottom-28 left-1/3 w-80 h-80 rounded-full"
            style={{ background: "radial-gradient(circle, rgba(6,182,212,0.18) 0%, transparent 65%)" }}
          />
          {/* grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.35) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.35) 1px,transparent 1px)",
              backgroundSize: "52px 52px",
            }}
          />
        </div>

        {/* ── Logo ── */}
        <div
          className="relative z-10 transition-all duration-700"
          style={{ opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(-16px)" }}
        >
          <div className="flex items-center gap-3.5">
            <div className="h-12 w-12 rounded-2xl btn-gradient flex items-center justify-center shadow-glow-blue animate-float-slow">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-white font-extrabold text-xl tracking-tight leading-tight">ProjectHub</h1>
              <p className="text-blue-300/80 text-[10px] font-bold tracking-[0.16em] uppercase leading-tight">FarmwiseAI</p>
            </div>
          </div>
        </div>

        {/* ── Hero ── */}
        <div
          className="relative z-10 transition-all duration-700"
          style={{ transitionDelay: "150ms", opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(24px)" }}
        >
          <div className="mb-9">
            <div
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-6"
              style={{ background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.28)" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-blue-300 text-[11px] font-semibold tracking-wide">CEO Command Center</span>
            </div>

            <h2 className="text-[3.1rem] font-extrabold text-white leading-[1.06] mb-5">
              Run your team
              <br />
              <span className="gradient-text-cool">with clarity.</span>
            </h2>

            <p className="text-slate-400 text-base leading-relaxed max-w-xs">
              AI-powered project management built for FarmwiseAI. Every decision tracked, every deliverable reviewed.
            </p>
          </div>

          {/* 2×2 feature grid */}
          <div className="grid grid-cols-2 gap-3">
            {features.map(({ icon: Icon, label, desc, color }, i) => (
              <div
                key={label}
                className="p-3.5 rounded-xl transition-all duration-500 hover:scale-[1.02]"
                style={{
                  background: `${color}12`,
                  border: `1px solid ${color}28`,
                  transitionDelay: `${300 + i * 70}ms`,
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "none" : "translateY(14px)",
                }}
              >
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center mb-2.5"
                  style={{ background: `${color}22` }}
                >
                  <Icon className="h-3.5 w-3.5" style={{ color }} />
                </div>
                <p className="text-white text-[11px] font-bold leading-tight mb-1">{label}</p>
                <p className="text-slate-500 text-[10px] leading-snug">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── CEO footer ── */}
        <div
          className="relative z-10 transition-all duration-700"
          style={{ transitionDelay: "500ms", opacity: mounted ? 1 : 0 }}
        >
          <div
            className="flex items-center gap-3 p-3 rounded-xl mb-3"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
          >
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-white text-[11px] font-bold shrink-0 shadow-glow-blue"
              style={{ background: "linear-gradient(135deg,#3b82f6,#6366f1)" }}>
              AV
            </div>
            <div className="min-w-0">
              <p className="text-slate-200 text-xs font-semibold truncate">Anand Vetrivel</p>
              <p className="text-slate-500 text-[11px]">CEO · FarmwiseAI</p>
            </div>
            <div className="ml-auto shrink-0 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-emerald-400 text-[10px] font-semibold">Active</span>
            </div>
          </div>
          <p className="text-slate-700 text-[11px]">© 2026 FarmwiseAI · ProjectHub v2.0</p>
        </div>
      </aside>


      {/* ═══════════════════════════════════════════════════════════
          RIGHT PANEL — full width on mobile/tablet, 48% on desktop
          Three zones:
            1. Gradient hero (hidden on lg, shown on < lg)
            2. Form area (fills remaining height)
      ═══════════════════════════════════════════════════════════ */}
      <main className="flex-1 h-full flex flex-col overflow-y-auto relative">

        {/* ── Desktop: white background with subtle pattern ── */}
        <div className="absolute inset-0 hidden lg:block bg-white pointer-events-none">
          <div className="absolute inset-0 bg-dot-pattern opacity-50" />
          <div className="absolute top-0 right-0 w-80 h-80 opacity-[0.06] pointer-events-none"
            style={{ background: "radial-gradient(circle,#3b82f6 0%,transparent 70%)", transform: "translate(35%,-35%)" }} />
          <div className="absolute bottom-0 left-0 w-80 h-80 opacity-[0.05] pointer-events-none"
            style={{ background: "radial-gradient(circle,#8b5cf6 0%,transparent 70%)", transform: "translate(-35%,35%)" }} />
        </div>

        {/* ── Mobile + Tablet: full gradient background ── */}
        <div className="absolute inset-0 lg:hidden pointer-events-none overflow-hidden"
          style={{ background: "linear-gradient(140deg, #080d1a 0%, #111040 45%, #0d2540 100%)" }}>
          <div className="animate-blob absolute -top-32 -right-20 w-[360px] h-[360px] rounded-full"
            style={{ background: "radial-gradient(circle,rgba(59,130,246,0.3) 0%,transparent 65%)" }} />
          <div className="animate-blob-delay-1 absolute top-1/3 -left-16 w-72 h-72 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(139,92,246,0.22) 0%,transparent 65%)" }} />
          <div className="animate-blob-delay-2 absolute bottom-8 right-1/4 w-64 h-64 rounded-full"
            style={{ background: "radial-gradient(circle,rgba(6,182,212,0.18) 0%,transparent 65%)" }} />
          <div className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.35) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.35) 1px,transparent 1px)",
              backgroundSize: "44px 44px",
            }} />
        </div>

        {/* ════════════════════════════════════════════════
            ZONE 1 — Gradient hero  (mobile + tablet only)
        ════════════════════════════════════════════════ */}

        {/* Mobile hero (< sm) */}
        <div
          className="flex sm:hidden shrink-0 relative z-10 flex-col items-center text-center px-6 pt-10 pb-6"
          style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}
        >
          <div className="h-12 w-12 rounded-2xl btn-gradient flex items-center justify-center shadow-glow-blue mb-3 animate-float-slow">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-white font-extrabold text-xl tracking-tight leading-tight">ProjectHub</h1>
          <p className="text-blue-300/80 text-[10px] font-bold tracking-[0.16em] uppercase mt-0.5">FarmwiseAI</p>
          <p className="text-slate-400 text-xs mt-2 max-w-[240px]">
            AI-powered project management for your team
          </p>
        </div>

        {/* Tablet hero (sm → md, hidden on mobile < sm and desktop lg+) */}
        <div
          className="hidden sm:flex lg:hidden shrink-0 relative z-10 flex-col px-10 pt-10 pb-7 md:px-14 md:pt-12"
          style={{ opacity: mounted ? 1 : 0, transition: "opacity 0.6s ease" }}
        >
          {/* Logo row */}
          <div className="flex items-center gap-3 mb-4"
            style={{ transform: mounted ? "none" : "translateY(-12px)", transition: "transform 0.6s ease" }}>
            <div className="h-11 w-11 rounded-2xl btn-gradient flex items-center justify-center shadow-glow-blue animate-float-slow">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-extrabold text-lg tracking-tight leading-tight">ProjectHub</h1>
              <p className="text-blue-300/80 text-[10px] font-bold tracking-[0.16em] uppercase leading-tight">FarmwiseAI</p>
            </div>
          </div>

          <p className="text-slate-300 text-sm md:text-base font-medium mb-4 max-w-lg">
            AI-powered command center — every decision tracked, every deliverable reviewed.
          </p>

          {/* Feature chips */}
          <div className="flex flex-wrap gap-2">
            {features.map(({ icon: Icon, label, color }, i) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all duration-500"
                style={{
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                  color,
                  transitionDelay: `${i * 60}ms`,
                  opacity: mounted ? 1 : 0,
                  transform: mounted ? "none" : "translateY(8px)",
                }}
              >
                <Icon className="h-3 w-3" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            ZONE 2 — Form card  (all sizes)
            · glass card on mobile/tablet (over gradient)
            · clean white form on desktop (over white bg)
        ════════════════════════════════════════════════ */}
        <div className="flex-1 flex items-center justify-center px-4 py-6 sm:px-8 sm:py-10 lg:py-12 relative z-10">

          {/* Outer width constraint */}
          <div className="w-full max-w-[360px] sm:max-w-[440px] lg:max-w-[400px]">

            {/* ── Glass card: mobile + tablet ── */}
            <div
              className="lg:hidden rounded-2xl p-6 sm:p-8 border border-white/10 transition-all duration-700"
              style={{
                background: "rgba(10,15,38,0.55)",
                backdropFilter: "blur(24px) saturate(160%)",
                WebkitBackdropFilter: "blur(24px) saturate(160%)",
                opacity: mounted ? 1 : 0,
                transform: mounted ? "none" : "translateY(20px)",
              }}
            >
              <MobileTabletForm
                email={email}
                password={password}
                showPassword={showPassword}
                rememberMe={rememberMe}
                error={error}
                submitting={submitting}
                activeDemo={activeDemo}
                mounted={mounted}
                onEmail={handleEmailChange}
                onPassword={(v) => { setPassword(v); setError(""); }}
                onTogglePassword={() => setShowPassword((x) => !x)}
                onToggleRemember={toggleRememberMe}
                onSubmit={handleSubmit}
                onFillDemo={fillDemo}
              />
            </div>

            {/* ── Clean form: desktop ── */}
            <div
              className="hidden lg:block transition-all duration-700"
              style={{ opacity: mounted ? 1 : 0, transform: mounted ? "none" : "translateY(20px)", transitionDelay: "100ms" }}
            >
              <DesktopForm
                email={email}
                password={password}
                showPassword={showPassword}
                rememberMe={rememberMe}
                error={error}
                submitting={submitting}
                activeDemo={activeDemo}
                mounted={mounted}
                onEmail={handleEmailChange}
                onPassword={(v) => { setPassword(v); setError(""); }}
                onTogglePassword={() => setShowPassword((x) => !x)}
                onToggleRemember={toggleRememberMe}
                onSubmit={handleSubmit}
                onFillDemo={fillDemo}
              />
            </div>
          </div>
        </div>

        {/* Mobile/tablet page footer */}
        <p className="lg:hidden text-center text-[11px] text-white/25 pb-6 relative z-10">
          © 2026 FarmwiseAI · ProjectHub v2.0
        </p>
      </main>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Shared form props type
───────────────────────────────────────────────────────────────── */
interface FormProps {
  email: string;
  password: string;
  showPassword: boolean;
  rememberMe: boolean;
  error: string;
  submitting: boolean;
  activeDemo: string | null;
  mounted: boolean;
  onEmail: (v: string) => void;
  onPassword: (v: string) => void;
  onTogglePassword: () => void;
  onToggleRemember: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFillDemo: (u: typeof demoUsers[0]) => void;
}

/* ─────────────────────────────────────────────────────────────────
   MOBILE + TABLET form  (dark / glass theme)
───────────────────────────────────────────────────────────────── */
function MobileTabletForm(p: FormProps) {
  return (
    <>
      {/* Heading */}
      <div className="mb-5 sm:mb-6">
        <h2 className="text-[1.65rem] sm:text-[1.9rem] font-extrabold text-white tracking-tight leading-tight">
          Welcome back
        </h2>
        <p className="text-slate-400 mt-1.5 text-sm font-medium">
          Sign in to your FarmwiseAI command center
        </p>
      </div>

      <form onSubmit={p.onSubmit} className="space-y-4">

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest" htmlFor="m-email">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input
              id="m-email"
              type="email"
              autoComplete="email"
              required
              value={p.email}
              onChange={(e) => p.onEmail(e.target.value)}
              placeholder="anand@farmwise.ai"
              className="w-full pl-10 pr-4 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
              onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(99,102,241,0.55)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12)"; }}
              onBlur={(e)  => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.12)"; e.currentTarget.style.boxShadow = "none"; }}
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-widest" htmlFor="m-password">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
            <input
              id="m-password"
              type={p.showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={p.password}
              onChange={(e) => p.onPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full pl-10 pr-11 py-3 rounded-xl text-sm text-white placeholder:text-slate-600 outline-none transition-all"
              style={{
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
              }}
              onFocus={(e) => { e.currentTarget.style.border = "1px solid rgba(99,102,241,0.55)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.12)"; }}
              onBlur={(e)  => { e.currentTarget.style.border = "1px solid rgba(255,255,255,0.12)"; e.currentTarget.style.boxShadow = "none"; }}
            />
            <button type="button" tabIndex={-1}
              onClick={p.onTogglePassword}
              aria-label={p.showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors">
              {p.showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center justify-between pt-0.5">
          <button type="button" onClick={p.onToggleRemember}
            className="flex items-center gap-2 group" aria-pressed={p.rememberMe}>
            <span className={`h-4 w-4 rounded border flex items-center justify-center transition-all
              ${p.rememberMe ? "bg-blue-600 border-blue-600" : "border-white/25 bg-white/5 group-hover:border-blue-400"}`}>
              {p.rememberMe && <Check className="h-2.5 w-2.5 text-white stroke-[3]" />}
            </span>
            <span className="text-sm text-slate-400 select-none">Remember my email</span>
          </button>
          <span className="text-xs text-slate-600">Cached locally</span>
        </div>

        {/* Error */}
        {p.error && (
          <div className="flex items-center gap-2.5 px-3.5 py-3 rounded-xl animate-fade-in-up"
            style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.25)" }}>
            <div className="h-1.5 w-1.5 rounded-full bg-red-400 shrink-0" />
            <p className="text-red-300 text-sm">{p.error}</p>
          </div>
        )}

        {/* Submit */}
        <button type="submit"
          disabled={p.submitting || !p.email || !p.password}
          className="w-full py-3 px-4 rounded-xl text-white text-sm font-semibold btn-gradient flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none mt-1">
          {p.submitting ? (
            <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Signing in…</>
          ) : (
            <>Sign in<ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </form>

      {/* Demo accounts */}
      <DemoPanel activeDemo={p.activeDemo} onFill={p.onFillDemo} dark />
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   DESKTOP form  (light theme)
───────────────────────────────────────────────────────────────── */
function DesktopForm(p: FormProps) {
  return (
    <>
      {/* Heading */}
      <div className="mb-8">
        <h2 className="text-[2rem] font-extrabold text-slate-900 tracking-tight leading-tight">Welcome back</h2>
        <p className="text-slate-500 mt-2 text-sm font-medium">
          Sign in to your FarmwiseAI command center
        </p>
      </div>

      <form onSubmit={p.onSubmit} className="space-y-5">

        {/* Email */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700" htmlFor="d-email">Email address</label>
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="d-email"
              type="email"
              autoComplete="email"
              required
              value={p.email}
              onChange={(e) => p.onEmail(e.target.value)}
              placeholder="anand@farmwise.ai"
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 input-focus-ring outline-none transition-all"
            />
          </div>
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-gray-700" htmlFor="d-password">Password</label>
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            <input
              id="d-password"
              type={p.showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={p.password}
              onChange={(e) => p.onPassword(e.target.value)}
              placeholder="••••••••••"
              className="w-full pl-10 pr-11 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm text-gray-900 placeholder:text-gray-400 input-focus-ring outline-none transition-all"
            />
            <button type="button" tabIndex={-1}
              onClick={p.onTogglePassword}
              aria-label={p.showPassword ? "Hide password" : "Show password"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
              {p.showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Remember me */}
        <div className="flex items-center justify-between">
          <button type="button" onClick={p.onToggleRemember}
            className="flex items-center gap-2 group" aria-pressed={p.rememberMe}>
            <span className={`h-4 w-4 rounded flex items-center justify-center border transition-all
              ${p.rememberMe ? "bg-blue-600 border-blue-600" : "border-gray-300 bg-white group-hover:border-blue-400"}`}>
              {p.rememberMe && <Check className="h-2.5 w-2.5 text-white stroke-[3]" />}
            </span>
            <span className="text-sm text-gray-600 select-none">Remember my email</span>
          </button>
          <span className="text-xs text-gray-400">Cached locally</span>
        </div>

        {/* Error */}
        {p.error && (
          <div className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-red-50 border border-red-200 animate-fade-in-up">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />
            <p className="text-red-600 text-sm">{p.error}</p>
          </div>
        )}

        {/* Submit */}
        <button type="submit"
          disabled={p.submitting || !p.email || !p.password}
          className="w-full py-3 px-4 rounded-xl text-white text-sm font-semibold btn-gradient flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none">
          {p.submitting ? (
            <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />Signing in…</>
          ) : (
            <>Sign in<ArrowRight className="h-4 w-4" /></>
          )}
        </button>
      </form>

      {/* Demo accounts */}
      <DemoPanel activeDemo={p.activeDemo} onFill={p.onFillDemo} dark={false} />

      {/* Desktop footer */}
      <p className="text-center text-[11px] text-gray-400 mt-5">
        © 2026 FarmwiseAI · ProjectHub v2.0
      </p>
    </>
  );
}

/* ─────────────────────────────────────────────────────────────────
   SHARED Demo panel  (dark or light variant)
───────────────────────────────────────────────────────────────── */
function DemoPanel({ activeDemo, onFill, dark }: {
  activeDemo: string | null;
  onFill: (u: typeof demoUsers[0]) => void;
  dark: boolean;
}) {
  return (
    <div
      className="mt-5 p-3.5 rounded-xl"
      style={dark
        ? { background: "rgba(255,255,255,0.04)", border: "1px dashed rgba(59,130,246,0.25)" }
        : { background: "rgba(239,246,255,0.7)", border: "1px dashed rgba(147,197,253,0.6)" }
      }
    >
      <p className={`text-xs font-semibold mb-2.5 flex items-center gap-1.5 ${dark ? "text-blue-300" : "text-blue-700"}`}>
        <Shield className="h-3.5 w-3.5" />
        Try a demo account
      </p>

      <div className="grid grid-cols-2 gap-1.5">
        {demoUsers.map((u) => {
          const active = activeDemo === u.label;
          return (
            <button
              key={u.label}
              type="button"
              onClick={() => onFill(u)}
              title={`${u.email}  ·  password: ${u.password}`}
              className="flex items-center gap-2 p-2 sm:p-2.5 rounded-xl border transition-all text-left hover:scale-[1.02]"
              style={{
                background:  active ? `${u.color}20` : `${u.color}0d`,
                borderColor: active ? `${u.color}60` : "transparent",
              }}
            >
              <div
                className="h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center font-bold text-white shrink-0"
                style={{ backgroundColor: u.color, fontSize: u.initials.length > 1 ? "9px" : "12px" }}
              >
                {u.initials}
              </div>
              <div className="min-w-0">
                <p className="font-bold leading-tight truncate"
                  style={{ color: u.color, fontSize: "10px" }}>
                  {u.name}
                </p>
                <p className={`truncate leading-tight ${dark ? "text-slate-500" : "text-gray-400"}`}
                  style={{ fontSize: "9px" }}>
                  {u.label}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      <p className={`text-center mt-2 ${dark ? "text-slate-600" : "text-gray-400"}`} style={{ fontSize: "10px" }}>
        Click a role to auto-fill · hover for credentials
      </p>
    </div>
  );
}
