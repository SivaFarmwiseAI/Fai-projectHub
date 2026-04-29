"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Activity, CheckCircle2, AlertCircle, AlertTriangle, Smile,
  SmilePlus, Meh, Frown, Send, Plus, Calendar,
  TrendingUp, Users, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { standup as standupApi, projects as projectsApi } from "@/lib/api-client";
import type { StandupEntry, Project } from "@/lib/api-client";

type StandupMood = "great" | "good" | "okay" | "struggling";

const moodConfig: Record<StandupMood, { icon: React.ReactNode; label: string; color: string; bg: string }> = {
  great:      { icon: <SmilePlus className="h-5 w-5" />,   label: "Great",      color: "#22c55e", bg: "#f0fdf4" },
  good:       { icon: <Smile className="h-5 w-5" />,       label: "Good",       color: "#3b82f6", bg: "#eff6ff" },
  okay:       { icon: <Meh className="h-5 w-5" />,         label: "Okay",       color: "#f59e0b", bg: "#fffbeb" },
  struggling: { icon: <Frown className="h-5 w-5" />,       label: "Struggling", color: "#ef4444", bg: "#fef2f2" },
};

export default function StandupPage() {
  const { user, isCEO, isLead, isAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState<"team" | "my" | "submit">(
    isCEO || isLead || isAdmin ? "team" : "submit"
  );
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const [teamEntries, setTeamEntries] = useState<StandupEntry[]>([]);
  const [myEntries, setMyEntries] = useState<StandupEntry[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);
  const [loadingMy, setLoadingMy] = useState(false);

  const [form, setForm] = useState({
    yesterday: "",
    today: "",
    blockers: "",
    mood: 3,
  });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    projectsApi.list({ limit: 20 }).then(r => setProjectList(r.projects)).catch(() => {});
  }, []);

  useEffect(() => {
    if (activeTab === "team" || isCEO || isLead || isAdmin) {
      setLoadingTeam(true);
      standupApi.today(selectedDate).then(r => setTeamEntries(r.entries)).catch(() => {}).finally(() => setLoadingTeam(false));
    }
  }, [activeTab, selectedDate, isCEO, isLead, isAdmin]);

  useEffect(() => {
    if (activeTab === "my" && user) {
      setLoadingMy(true);
      standupApi.history(user.id, 30).then(r => setMyEntries(r.entries)).catch(() => {}).finally(() => setLoadingMy(false));
    }
  }, [activeTab, user]);

  const onTrack  = teamEntries.length;
  const avgMood  = teamEntries.length
    ? Math.round(teamEntries.reduce((a, b) => a + (b.mood ?? 3), 0) / teamEntries.length)
    : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.yesterday || !form.today) return;
    setSubmitting(true);
    try {
      await standupApi.submit({ yesterday: form.yesterday, today: form.today, blockers: form.blockers, mood: form.mood });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  function StandupCard({ entry, index = 0 }: { entry: StandupEntry; index?: number }) {
    return (
      <div
        className="bg-white rounded-2xl border shadow-card overflow-hidden animate-fade-in-up"
        style={{ borderColor: "rgba(0,0,0,0.06)", animationDelay: `${index * 60}ms` }}
      >
        <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #3b82f6, #6366f1)" }} />
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
              style={{ backgroundColor: "#3b82f6" }}
            >
              {(entry.name ?? "?")[0]}
            </div>
            <div className="flex-1 min-w-0">
              <span className="font-bold text-sm text-slate-900">{entry.name ?? entry.user_id}</span>
              {entry.department && (
                <p className="text-[11px] text-slate-400">{entry.department}</p>
              )}
            </div>
            {entry.mood != null && (
              <div className="text-right shrink-0 text-xs text-slate-500">
                Mood: {entry.mood}/5
              </div>
            )}
          </div>
          <div className="space-y-2.5 ml-12">
            {entry.yesterday && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">Yesterday</p>
                <p className="text-sm text-slate-600 leading-relaxed">{entry.yesterday}</p>
              </div>
            )}
            {entry.today && (
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">Today</p>
                <p className="text-sm text-slate-600 leading-relaxed">{entry.today}</p>
              </div>
            )}
            {entry.blockers && (
              <div className="p-3 rounded-xl" style={{ background: "#fef2f2", border: "1px solid #fecaca" }}>
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-red-400 mb-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> Blockers
                </p>
                <p className="text-sm text-red-700 leading-relaxed">{entry.blockers}</p>
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-3 pt-3 ml-12" style={{ borderTop: "1px solid rgba(0,0,0,0.04)" }}>
            <Clock className="h-3 w-3" />
            {format(new Date(entry.created_at), "h:mm a")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6 max-w-4xl">
      {/* Header */}
      <div className="animate-fade-in-up">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #3b82f6, #6366f1)", boxShadow: "0 4px 16px rgba(99,102,241,0.3)" }}
          >
            <Activity className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-display text-slate-900">Daily Standup</h1>
            <p className="text-sm font-medium text-slate-500">{format(new Date(), "EEEE, MMMM d, yyyy")}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-gray-100/80 w-fit animate-fade-in-up stagger-1">
        {(isCEO || isLead || isAdmin) && (
          <button
            onClick={() => setActiveTab("team")}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
              activeTab === "team" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Users className="h-4 w-4" />
            Team Feed
            {teamEntries.length > 0 && (
              <span className="h-5 min-w-[20px] rounded-full bg-blue-500 text-white text-[10px] font-bold flex items-center justify-center px-1.5">
                {teamEntries.length}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab("my")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
            activeTab === "my" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <TrendingUp className="h-4 w-4" />
          My History
        </button>
        <button
          onClick={() => setActiveTab("submit")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2",
            activeTab === "submit" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
          )}
        >
          <Plus className="h-4 w-4" />
          Post Update
        </button>
      </div>

      {/* TEAM TAB */}
      {activeTab === "team" && (isCEO || isLead || isAdmin) && (
        <div className="space-y-5 animate-fade-in-up">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Updates Today", value: onTrack,   color: "#22c55e", bg: "#f0fdf4" },
              { label: "Avg Mood",      value: avgMood,   color: "#3b82f6", bg: "#eff6ff" },
            ].map(stat => (
              <div
                key={stat.label}
                className="rounded-2xl p-4 text-center border"
                style={{ background: stat.bg, borderColor: `${stat.color}30` }}
              >
                <p className="text-2xl font-extrabold stat-number" style={{ color: stat.color }}>{stat.value}</p>
                <p className="text-[11px] font-semibold text-slate-500 mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm font-semibold text-slate-600 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-blue-500" />
              Date
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-gray-200 text-sm font-medium text-slate-700 bg-white outline-none"
            />
            <span className="text-sm text-slate-400">{teamEntries.length} updates</span>
          </div>

          {loadingTeam ? (
            <div className="text-center py-10 text-slate-400">Loading…</div>
          ) : teamEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50">
              <Activity className="h-10 w-10 text-gray-300 mb-3" />
              <p className="font-semibold text-gray-600">No standups posted yet</p>
              <p className="text-sm text-gray-400 mt-1">Check back after 9 AM</p>
            </div>
          ) : (
            <div className="space-y-4">
              {teamEntries.map((entry, i) => (
                <StandupCard key={entry.id} entry={entry} index={i} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* MY HISTORY TAB */}
      {activeTab === "my" && (
        <div className="space-y-4 animate-fade-in-up">
          {loadingMy ? (
            <div className="text-center py-10 text-slate-400">Loading…</div>
          ) : myEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50">
              <TrendingUp className="h-10 w-10 text-gray-300 mb-3" />
              <p className="font-semibold text-gray-600">No updates posted yet</p>
              <button
                onClick={() => setActiveTab("submit")}
                className="mt-3 text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                Post your first standup →
              </button>
            </div>
          ) : (
            myEntries.map((entry, i) => (
              <div key={entry.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 60}ms` }}>
                <p className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(entry.date), "EEEE, MMMM d")}
                </p>
                <StandupCard entry={entry} />
              </div>
            ))
          )}
        </div>
      )}

      {/* SUBMIT TAB */}
      {activeTab === "submit" && (
        <div className="animate-fade-in-up">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-emerald-200 bg-emerald-50/50 animate-scale-in">
              <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="text-xl font-bold text-emerald-800">Standup posted!</p>
              <p className="text-sm text-emerald-600 mt-1">Your team is in the loop.</p>
              <button
                onClick={() => setActiveTab("my")}
                className="mt-4 text-sm font-medium text-emerald-700 hover:underline"
              >
                View your history →
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div
                className="bg-white rounded-2xl border shadow-card p-5 sm:p-6 space-y-5"
                style={{ borderColor: "rgba(0,0,0,0.06)" }}
              >
                <div className="flex items-center gap-3 pb-4" style={{ borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                  <div
                    className="h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: user?.avatarColor ?? "#3b82f6" }}
                  >
                    {user?.initials ?? "?"}
                  </div>
                  <div>
                    <p className="font-bold text-slate-900">{user?.name}</p>
                    <p className="text-xs text-slate-400">{format(new Date(), "EEEE, MMMM d")}</p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-[10px] font-bold">✓</span>
                    What did you do yesterday?
                  </label>
                  <textarea
                    required
                    value={form.yesterday}
                    onChange={e => setForm(f => ({ ...f, yesterday: e.target.value }))}
                    placeholder="Describe what you accomplished..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-none transition-colors focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-[10px] font-bold">→</span>
                    What will you do today?
                  </label>
                  <textarea
                    required
                    value={form.today}
                    onChange={e => setForm(f => ({ ...f, today: e.target.value }))}
                    placeholder="Describe your plan for today..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-none transition-colors focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <span className="h-5 w-5 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-[10px] font-bold">!</span>
                    Any blockers?
                  </label>
                  <textarea
                    value={form.blockers}
                    onChange={e => setForm(f => ({ ...f, blockers: e.target.value }))}
                    placeholder="None, or describe what's blocking you..."
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-sm text-slate-900 placeholder:text-slate-400 outline-none resize-none transition-colors focus:bg-white"
                  />
                </div>

                {/* Mood */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700">How are you feeling?</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(Object.entries(moodConfig) as [StandupMood, typeof moodConfig.good][]).map(([key, cfg], idx) => {
                      const moodNum = idx + 1;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setForm(f => ({ ...f, mood: moodNum }))}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm font-semibold transition-all",
                            form.mood === moodNum
                              ? "border-current shadow-sm scale-[1.02]"
                              : "border-gray-200 text-slate-500 hover:border-gray-300"
                          )}
                          style={form.mood === moodNum ? { color: cfg.color, background: cfg.bg, borderColor: cfg.color } : {}}
                        >
                          <span style={form.mood === moodNum ? { color: cfg.color } : { color: "#94a3b8" }}>{cfg.icon}</span>
                          {cfg.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !form.yesterday || !form.today}
                className="w-full py-3 px-4 rounded-xl text-white text-sm font-semibold btn-gradient flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Posting…
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    Post Standup
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
