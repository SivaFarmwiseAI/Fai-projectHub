"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Loader2, CheckCircle2, Clock, Users,
  Building2, CalendarDays, X, Edit3, ArrowRightCircle,
  Trash2, ListTodo, MessageSquare, Handshake, Video,
  Eye, Milestone, History,
} from "lucide-react";
import { capture as captureApi, projects as projectsApi } from "@/lib/api-client";
import type { CaptureItem, CaptureSession, Project } from "@/lib/api-client";

const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; borderColor: string; icon: React.ElementType }> = {
  todo:            { label: "To-Do",       color: "text-blue-700",   bgColor: "bg-blue-50",   borderColor: "border-blue-200",   icon: ListTodo },
  follow_up:       { label: "Follow-Up",   color: "text-amber-700",  bgColor: "bg-amber-50",  borderColor: "border-amber-200",  icon: Clock },
  commitment:      { label: "Commitment",  color: "text-purple-700", bgColor: "bg-purple-50", borderColor: "border-purple-200", icon: Handshake },
  meeting:         { label: "Meeting",     color: "text-green-700",  bgColor: "bg-green-50",  borderColor: "border-green-200",  icon: Video },
  review_reminder: { label: "Review",      color: "text-red-700",    bgColor: "bg-red-50",    borderColor: "border-red-200",    icon: Eye },
  timeline:        { label: "Timeline",    color: "text-indigo-700", bgColor: "bg-indigo-50", borderColor: "border-indigo-200", icon: Milestone },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-red-100 text-red-700 border-red-200",
  high:     "bg-amber-100 text-amber-700 border-amber-200",
  medium:   "bg-blue-100 text-blue-700 border-blue-200",
  low:      "bg-gray-100 text-gray-600 border-gray-200",
};

const EXAMPLE_TEXT = `Assigned API documentation task to Arjun, need it by Friday.
Meeting with data science team on Monday to review the churn model.
Committed to deliver quarterly report to marketing by end of month.
Need to review Sneha's design mockups before Thursday.
Vikram should set up the staging environment by next week.`;

export default function CapturePage() {
  const [items, setItems] = useState<CaptureItem[]>([]);
  const [projectList, setProjectList] = useState<Project[]>([]);
  const [stats, setStats] = useState({ pending: 0, converted: 0, dismissed: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [processing, setProcessing] = useState(false);
  const [lastSessionItems, setLastSessionItems] = useState<CaptureItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    Promise.all([
      captureApi.list().then(r => setItems(r.items)),
      captureApi.stats().then(r => setStats(r.stats)),
      projectsApi.list({ limit: 30 }).then(r => setProjectList(r.projects)),
    ]).finally(() => setLoading(false));
  }, []);

  async function handleProcess() {
    if (!inputText.trim()) return;
    setProcessing(true);
    try {
      const { items: newItems } = await captureApi.createSession(inputText);
      setLastSessionItems(newItems);
      setInputText("");
      // Refresh full list and stats
      const [listRes, statsRes] = await Promise.all([captureApi.list(), captureApi.stats()]);
      setItems(listRes.items);
      setStats(statsRes.stats);
    } finally {
      setProcessing(false);
    }
  }

  async function handleDismiss(itemId: string) {
    await captureApi.updateItem(itemId, { status: "dismissed" });
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: "dismissed" } : i));
    setLastSessionItems(prev => prev.map(i => i.id === itemId ? { ...i, status: "dismissed" } : i));
    setStats(prev => ({ ...prev, dismissed: prev.dismissed + 1, pending: Math.max(0, prev.pending - 1) }));
  }

  async function handleConvert(itemId: string, taskId?: string) {
    await captureApi.updateItem(itemId, { status: "converted", converted_to_task_id: taskId });
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, status: "converted" } : i));
    setLastSessionItems(prev => prev.map(i => i.id === itemId ? { ...i, status: "converted" } : i));
    setStats(prev => ({ ...prev, converted: prev.converted + 1, pending: Math.max(0, prev.pending - 1) }));
  }

  const pendingItems = useMemo(() => items.filter(i => i.status === "pending"), [items]);
  const displayItems = showHistory ? items : (lastSessionItems.length > 0 ? lastSessionItems : pendingItems);

  const grouped = useMemo(() => {
    const groups: Record<string, CaptureItem[]> = {};
    for (const item of displayItems) {
      if (!groups[item.type]) groups[item.type] = [];
      groups[item.type].push(item);
    }
    return groups;
  }, [displayItems]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-blue-600" />
            AI Capture
          </h1>
          <p className="text-muted-foreground mt-1">Speak or paste anything — AI extracts action items</p>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="text-center">
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{stats.converted}</p>
            <p className="text-xs text-muted-foreground">Converted</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-400">{stats.dismissed}</p>
            <p className="text-xs text-muted-foreground">Dismissed</p>
          </div>
        </div>
      </div>

      {/* Input area */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <Textarea
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            placeholder={EXAMPLE_TEXT}
            rows={6}
            className="font-mono text-sm resize-none"
          />
          <div className="flex items-center gap-3">
            <Button
              onClick={handleProcess}
              disabled={processing || !inputText.trim()}
              className="gap-2"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {processing ? "Processing…" : "Extract Action Items"}
            </Button>
            {items.length > 0 && (
              <button
                onClick={() => setShowHistory(v => !v)}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <History className="h-4 w-4" />
                {showHistory ? "Show Latest" : "Show All History"}
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {Object.keys(grouped).length > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([type, typeItems]) => {
            const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.todo;
            const Icon = cfg.icon;
            return (
              <div key={type}>
                <div className={`flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border ${cfg.bgColor} ${cfg.borderColor}`}>
                  <Icon className={`h-4 w-4 ${cfg.color}`} />
                  <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                  <span className={`text-xs ${cfg.color} opacity-70`}>({typeItems.length})</span>
                </div>
                <div className="space-y-3">
                  {typeItems.map(item => (
                    <Card
                      key={item.id}
                      className={`transition-all ${
                        item.status === "dismissed" ? "opacity-40" :
                        item.status === "converted" ? "border-green-200 bg-green-50/50" : ""
                      }`}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0 space-y-1.5">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className={`text-sm font-medium ${item.status === "converted" ? "line-through text-muted-foreground" : ""}`}>
                                {item.title}
                              </p>
                              <Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[item.priority]}`}>
                                {item.priority}
                              </Badge>
                              {item.status === "converted" && (
                                <Badge variant="outline" className="text-green-700 border-green-200 bg-green-50 text-[10px]">
                                  <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Converted
                                </Badge>
                              )}
                              {item.status === "dismissed" && (
                                <Badge variant="outline" className="text-gray-500 border-gray-200 bg-gray-50 text-[10px]">
                                  Dismissed
                                </Badge>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              {item.assignee_name && (
                                <span className="flex items-center gap-1">
                                  <Users className="h-3 w-3" />{item.assignee_name}
                                </span>
                              )}
                              {item.due_date && (
                                <span className="flex items-center gap-1">
                                  <CalendarDays className="h-3 w-3" />{item.due_date}
                                </span>
                              )}
                              {item.tags?.length > 0 && (
                                <div className="flex gap-1">
                                  {item.tags.map(tag => (
                                    <span key={tag} className="px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px]">#{tag}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {item.status === "pending" && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                onClick={() => handleConvert(item.id)}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-green-700 bg-green-50 border border-green-200 hover:bg-green-100 transition-colors"
                                title="Mark as converted"
                              >
                                <ArrowRightCircle className="h-3.5 w-3.5" />
                                Convert
                              </button>
                              <button
                                onClick={() => handleDismiss(item.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                title="Dismiss"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {Object.keys(grouped).length === 0 && !processing && (
        <div className="text-center py-16 text-muted-foreground">
          <Sparkles className="h-12 w-12 mx-auto mb-4 text-blue-200" />
          <p className="text-lg font-medium">Paste text above to extract action items</p>
          <p className="text-sm mt-1">AI will identify tasks, follow-ups, commitments, and meetings</p>
        </div>
      )}
    </div>
  );
}
