"use client";

import { useEffect, useState } from "react";
import { scheduleRequests as api, type ScheduleRequestRow } from "./api-client";

// Module-backed, API-fetched store of CEO approval requests.
//
// Each call site can read synchronously via `getStatus()` / `getRequest()` /
// `isVisibleOnCalendar()` — those return whatever has been fetched so far.
// A React component should mount `useScheduleRequestsTick()` once at the top
// of its tree to trigger a background fetch and to re-render when the store
// changes (after accept/reject or a manual refresh).

export type ScheduleEntityType =
  | "meeting"
  | "review"
  | "commitment"
  | "discussion"
  | "follow_up"
  | "leave";

export type ScheduleStatus = "pending" | "accepted" | "rejected";

export type ScheduleRequest = {
  requestId: string;             // backend uuid
  type: ScheduleEntityType;
  id: string;                    // underlying entity id
  status: ScheduleStatus;
  requestedAt: string;
  requestedBy?: string;
  requestedByName?: string;
  proposedDateTime?: string;
  rescheduledTo?: string;
  ceoNote?: string;
  decidedAt?: string;
  decidedBy?: string;
  decidedByName?: string;
  title?: string;
  description?: string;
  projectId?: string;
  projectTitle?: string;
};

// ── Internal store ──────────────────────────────────────────────────────────
let _store = new Map<string, ScheduleRequest>();
let _loaded = false;
let _loadPromise: Promise<void> | null = null;
const _listeners = new Set<() => void>();

const k = (t: ScheduleEntityType, id: string) => `${t}:${id}`;

function notify() { _listeners.forEach((l) => l()); }

function normalize(row: ScheduleRequestRow): ScheduleRequest {
  return {
    requestId: row.id,
    type: row.entity_type,
    id: row.entity_id,
    status: row.status,
    requestedAt: row.created_at,
    requestedBy: row.requested_by,
    requestedByName: row.requested_by_name,
    proposedDateTime: row.proposed_at,
    rescheduledTo: row.rescheduled_to,
    ceoNote: row.ceo_note,
    decidedAt: row.decided_at,
    decidedBy: row.decided_by,
    decidedByName: row.decided_by_name,
    title: row.title,
    description: row.description,
    projectId: row.project_id,
    projectTitle: row.project_title,
  };
}

export async function refreshScheduleRequests(force = false): Promise<void> {
  if (!force && _loadPromise) return _loadPromise;
  if (!force && _loaded) return;
  _loadPromise = (async () => {
    try {
      const { requests } = await api.list();
      const next = new Map<string, ScheduleRequest>();
      for (const row of requests) {
        const r = normalize(row);
        next.set(k(r.type, r.id), r);
      }
      _store = next;
      _loaded = true;
      notify();
    } catch (e) {
      // Keep whatever we had; surface in console only.
      console.error("[scheduling-requests] refresh failed:", e);
    } finally {
      _loadPromise = null;
    }
  })();
  return _loadPromise;
}

// ── Synchronous readers (read whatever was last fetched) ────────────────────
export function getRequest(type: ScheduleEntityType, id: string): ScheduleRequest | undefined {
  return _store.get(k(type, id));
}

// Items without a request record are "legacy" — created before the approval
// flow existed. Calendar treats them as visible to avoid hiding existing data.
export function getStatus(type: ScheduleEntityType, id: string): ScheduleStatus | "legacy" {
  return _store.get(k(type, id))?.status ?? "legacy";
}

export function isVisibleOnCalendar(type: ScheduleEntityType, id: string): boolean {
  const s = getStatus(type, id);
  return s === "accepted" || s === "legacy";
}

export function listAll(): ScheduleRequest[] {
  return Array.from(_store.values()).sort((a, b) =>
    a.requestedAt > b.requestedAt ? -1 : 1,
  );
}

export function listPending(): ScheduleRequest[] {
  return listAll().filter((r) => r.status === "pending");
}

// ── Mutations (call API, then refresh) ──────────────────────────────────────
export async function acceptRequest(
  type: ScheduleEntityType,
  id: string,
  opts?: { rescheduledTo?: string; ceoNote?: string },
): Promise<ScheduleRequest | undefined> {
  const existing = _store.get(k(type, id));
  if (!existing) return undefined;
  await api.accept(existing.requestId, {
    rescheduled_to: opts?.rescheduledTo,
    ceo_note: opts?.ceoNote,
  });
  await refreshScheduleRequests(true);
  return _store.get(k(type, id));
}

export async function rejectRequest(
  type: ScheduleEntityType,
  id: string,
  opts?: { ceoNote?: string },
): Promise<ScheduleRequest | undefined> {
  const existing = _store.get(k(type, id));
  if (!existing) return undefined;
  await api.reject(existing.requestId, { ceo_note: opts?.ceoNote });
  await refreshScheduleRequests(true);
  return _store.get(k(type, id));
}

// ── React subscription hook ─────────────────────────────────────────────────
// Mount this in any component that reads from the store; it triggers a lazy
// fetch and forces a re-render on every store update.
export function useScheduleRequestsTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const handler = () => setTick((t) => t + 1);
    _listeners.add(handler);
    // Lazy first-load
    void refreshScheduleRequests();
    return () => {
      _listeners.delete(handler);
    };
  }, []);
  return tick;
}
