"use client";

import { useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";
import {
  Inbox, CheckCircle2, XCircle, Loader2, FolderKanban, Globe2, Clock,
  Hourglass, ClipboardCheck, MessageSquare, Handshake, Plane, CalendarDays,
  Pencil, Send, AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger,
} from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import { showToast } from "@/lib/toast";
import {
  listAll,
  acceptRequest,
  rejectRequest,
  refreshScheduleRequests,
  useScheduleRequestsTick,
  type ScheduleRequest,
  type ScheduleEntityType,
} from "@/lib/scheduling-requests";

const TYPE_META: Record<ScheduleEntityType, { label: string; icon: React.ReactNode; cls: string }> = {
  meeting:    { label: "Meeting",    icon: <CalendarDays className="h-3.5 w-3.5" />,    cls: "text-purple-700 bg-purple-50 border-purple-200" },
  review:     { label: "Review",     icon: <ClipboardCheck className="h-3.5 w-3.5" />,  cls: "text-orange-700 bg-orange-50 border-orange-200" },
  commitment: { label: "Commitment", icon: <Handshake className="h-3.5 w-3.5" />,       cls: "text-teal-700 bg-teal-50 border-teal-200" },
  discussion: { label: "Discussion", icon: <MessageSquare className="h-3.5 w-3.5" />,   cls: "text-indigo-700 bg-indigo-50 border-indigo-200" },
  follow_up:  { label: "Follow-up",  icon: <AlertTriangle className="h-3.5 w-3.5" />,   cls: "text-amber-700 bg-amber-50 border-amber-200" },
  leave:      { label: "Leave",      icon: <Plane className="h-3.5 w-3.5" />,           cls: "text-red-700 bg-red-50 border-red-200" },
};

type Tab = "pending" | "accepted" | "rejected" | "all";

export default function CEORequestsPage() {
  const { isCEO, isAdmin } = useAuth();
  const tick = useScheduleRequestsTick();

  const [tab, setTab] = useState<Tab>("pending");
  const [typeFilter, setTypeFilter] = useState<ScheduleEntityType | "all">("all");
  const [decisionRequest, setDecisionRequest] = useState<ScheduleRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<ScheduleRequest | null>(null);

  // Refresh on mount and after tab changes
  useEffect(() => { void refreshScheduleRequests(true); }, []);

  const allRequests = useMemo(() => listAll(), [tick]);

  const filtered = useMemo(() => {
    return allRequests.filter(r => {
      if (tab !== "all" && r.status !== tab) return false;
      if (typeFilter !== "all" && r.type !== typeFilter) return false;
      return true;
    });
  }, [allRequests, tab, typeFilter]);

  const counts = useMemo(() => ({
    pending: allRequests.filter(r => r.status === "pending").length,
    accepted: allRequests.filter(r => r.status === "accepted").length,
    rejected: allRequests.filter(r => r.status === "rejected").length,
    all: allRequests.length,
  }), [allRequests]);

  if (!isCEO && !isAdmin) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center">
        <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <h2 className="text-lg font-semibold">CEO Inbox</h2>
        <p className="text-sm text-muted-foreground mt-1">
          This page is for the CEO to review scheduling requests. You don&apos;t have access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[1600px]">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Inbox className="h-6 w-6 text-blue-600" /> Schedule Requests
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Approve, reschedule, or reject meetings, reviews, commitments, discussions, follow-ups and leaves.
        </p>
      </div>

      <Tabs value={tab} onValueChange={v => v && setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="pending" className="gap-1.5">
            <Hourglass className="h-3.5 w-3.5" /> Pending
            {counts.pending > 0 && <Badge variant="outline" className="h-5 px-1.5 text-[10px] bg-amber-50 border-amber-200 text-amber-700">{counts.pending}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="accepted" className="gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" /> Accepted
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{counts.accepted}</Badge>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1.5">
            <XCircle className="h-3.5 w-3.5" /> Rejected
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{counts.rejected}</Badge>
          </TabsTrigger>
          <TabsTrigger value="all" className="gap-1.5">
            All <Badge variant="outline" className="h-5 px-1.5 text-[10px]">{counts.all}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Type:</span>
        <Button
          size="sm"
          variant={typeFilter === "all" ? "default" : "outline"}
          onClick={() => setTypeFilter("all")}
          className="h-7 text-[11px]"
        >
          All
        </Button>
        {(Object.keys(TYPE_META) as ScheduleEntityType[]).map(t => (
          <Button
            key={t}
            size="sm"
            variant={typeFilter === t ? "default" : "outline"}
            onClick={() => setTypeFilter(t)}
            className="h-7 text-[11px] gap-1"
          >
            {TYPE_META[t].icon}
            {TYPE_META[t].label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Inbox className="h-10 w-10 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No {tab} requests.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => (
            <RequestRow
              key={r.requestId}
              request={r}
              onAccept={() => setDecisionRequest(r)}
              onReject={() => setRejectingRequest(r)}
            />
          ))}
        </div>
      )}

      <DecisionDialog
        request={decisionRequest}
        onClose={() => setDecisionRequest(null)}
      />

      <RejectDialog
        request={rejectingRequest}
        onClose={() => setRejectingRequest(null)}
      />
    </div>
  );
}

function RequestRow({
  request, onAccept, onReject,
}: {
  request: ScheduleRequest;
  onAccept: () => void;
  onReject: () => void;
}) {
  const meta = TYPE_META[request.type];
  const effectiveWhen = request.rescheduledTo ?? request.proposedDateTime;
  const wasRescheduled = request.rescheduledTo && request.proposedDateTime && request.rescheduledTo !== request.proposedDateTime;

  return (
    <Card className={request.status === "pending" ? "border-amber-200" : ""}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`gap-1 text-[10px] ${meta.cls}`}>
                {meta.icon} {meta.label}
              </Badge>
              <h3 className="font-semibold truncate">{request.title ?? "(Untitled)"}</h3>
              {request.projectId ? (
                <Badge variant="outline" className="gap-1 text-[10px]">
                  <FolderKanban className="h-3 w-3" /> {request.projectTitle ?? "Project"}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 text-[10px] text-slate-500">
                  <Globe2 className="h-3 w-3" /> General
                </Badge>
              )}
              {request.status === "accepted" && (
                <Badge variant="outline" className="gap-1 text-[10px] text-emerald-700 border-emerald-200 bg-emerald-50">
                  <CheckCircle2 className="h-3 w-3" /> Accepted
                </Badge>
              )}
              {request.status === "rejected" && (
                <Badge variant="outline" className="gap-1 text-[10px] text-red-700 border-red-200 bg-red-50">
                  <XCircle className="h-3 w-3" /> Rejected
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {effectiveWhen && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(effectiveWhen), "EEE, MMM d · h:mm a")}
                </span>
              )}
              {wasRescheduled && request.proposedDateTime && (
                <span className="line-through text-amber-600">
                  was {format(new Date(request.proposedDateTime), "MMM d · h:mm a")}
                </span>
              )}
              <span>raised {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}</span>
              {request.requestedByName && <span>· by {request.requestedByName}</span>}
            </div>

            {request.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{request.description}</p>
            )}

            {request.ceoNote && (
              <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-md px-2 py-1">
                CEO: {request.ceoNote}
              </p>
            )}
          </div>

          {request.status === "pending" && (
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" className="gap-1 h-8 text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100" onClick={onAccept}>
                <Pencil className="h-3.5 w-3.5" /> Accept / Reschedule
              </Button>
              <Button size="sm" variant="outline" className="gap-1 h-8 text-red-700 border-red-200 bg-red-50 hover:bg-red-100" onClick={onReject}>
                <XCircle className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Datetime helpers ─────────────────────────────────────────────────────────
function toLocalDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function localToIso(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

// ── Accept / Reschedule Dialog ───────────────────────────────────────────────
function DecisionDialog({
  request, onClose,
}: {
  request: ScheduleRequest | null;
  onClose: () => void;
}) {
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!request) return;
    const seed = request.rescheduledTo ?? request.proposedDateTime;
    setWhen(seed ? toLocalDatetime(new Date(seed)) : "");
    setNote(request.ceoNote ?? "");
  }, [request]);

  if (!request) return null;

  const originalWhen = request.proposedDateTime;
  const isReschedule = !!when && (!originalWhen || localToIso(when) !== originalWhen);

  const submit = async () => {
    setSaving(true);
    try {
      const newIso = localToIso(when);
      await acceptRequest(request.type, request.id, {
        rescheduledTo: newIso,
        ceoNote: note.trim() || undefined,
      });
      showToast.success(isReschedule ? "Accepted with new time" : "Accepted", "Now visible on the calendar.");
      onClose();
    } catch (e) {
      showToast.error("Accept failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Accept &middot; {request.title}</DialogTitle>
          <DialogDescription>
            Pick the final date / time. If you change it, the source record is updated too.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {originalWhen && (
            <p className="text-xs text-muted-foreground">
              Originally proposed for <strong>{format(new Date(originalWhen), "EEE, MMM d · h:mm a")}</strong>
            </p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="dec-when">Date &amp; time</Label>
            <Input
              id="dec-when"
              type="datetime-local"
              value={when}
              onChange={e => setWhen(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dec-note">Note (optional)</Label>
            <Textarea
              id="dec-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g., moved later so engineering can attend"
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {isReschedule ? "Reschedule & Accept" : "Accept"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Reject Dialog ────────────────────────────────────────────────────────────
function RejectDialog({
  request, onClose,
}: {
  request: ScheduleRequest | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setNote(""); }, [request]);

  if (!request) return null;

  const submit = async () => {
    setSaving(true);
    try {
      await rejectRequest(request.type, request.id, { ceoNote: note.trim() || undefined });
      showToast.success("Request rejected");
      onClose();
    } catch (e) {
      showToast.error("Reject failed", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Reject request</DialogTitle>
          <DialogDescription>
            Give the requester a short reason. The source record stays in place, but won&apos;t appear on the calendar.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-1.5">
          <Label htmlFor="rej-note">Reason</Label>
          <Textarea
            id="rej-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Why is this being rejected?"
            className="min-h-[80px]"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="destructive" onClick={submit} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />} Reject
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
