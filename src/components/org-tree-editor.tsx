"use client";

/**
 * "Org Tree" — HR / leadership define each person's reporting manager. This tree
 * is what scopes a Team Lead's visibility (their direct + indirect reports).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Network, Loader2, Search, Check } from "lucide-react";
import { performanceAssessments, type OrgTreeNode } from "@/lib/api-client";

export function OrgTreeEditor() {
  const [tree, setTree] = useState<OrgTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(() => {
    performanceAssessments.orgTree().then((r) => setTree(r.tree || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let alive = true;
    performanceAssessments.orgTree().then((r) => { if (alive) setTree(r.tree || []); }).catch(() => {}).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const setManager = async (userId: string, managerId: string) => {
    setSaving(userId);
    try {
      await performanceAssessments.setManager(userId, managerId || null);
      setTree((prev) => prev.map((u) => u.id === userId
        ? { ...u, manager_id: managerId || null, manager_name: tree.find((m) => m.id === managerId)?.name ?? null }
        : u));
      setSaved(userId);
      setTimeout(() => setSaved((s) => (s === userId ? null : s)), 1500);
    } catch {
      load();
    } finally { setSaving(null); }
  };

  const filtered = useMemo(
    () => tree.filter((u) => u.name.toLowerCase().includes(search.toLowerCase())),
    [tree, search],
  );

  if (loading) {
    return <div className="space-y-2 animate-pulse">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="h-14 bg-slate-100 rounded-xl" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Network className="h-4 w-4 text-blue-500" />
          <h3 className="text-sm font-bold text-slate-900">Reporting tree</h3>
          <span className="text-xs text-slate-400 font-medium">· {tree.length} people</span>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…"
            className="h-9 rounded-xl border border-slate-200 pl-8 pr-3 text-sm w-56 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border shadow-card overflow-hidden divide-y divide-slate-100" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        {filtered.map((u) => (
          <div key={u.id} className="px-4 py-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ring-2 ring-white shadow-sm"
              style={{ backgroundColor: u.avatar_color || "#3b82f6" }}>
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 truncate">{u.name}</p>
              <p className="text-[11px] text-slate-400 font-medium truncate">{u.role || u.role_type}{u.department ? ` · ${u.department}` : ""}</p>
            </div>
            <label className="text-[11px] text-slate-400 font-medium hidden sm:block">Reports to</label>
            <div className="relative flex items-center gap-2 shrink-0">
              <select
                value={u.manager_id || ""}
                onChange={(e) => setManager(u.id, e.target.value)}
                disabled={saving === u.id}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm w-44 sm:w-52 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                <option value="">— No manager —</option>
                {tree.filter((m) => m.id !== u.id).map((m) => (
                  <option key={m.id} value={m.id}>{m.name}{m.role_type ? ` (${m.role_type})` : ""}</option>
                ))}
              </select>
              {saving === u.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                : saved === u.id ? <Check className="h-4 w-4 text-emerald-500" />
                : <span className="w-4" />}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <div className="px-4 py-8 text-center text-sm text-slate-400">No people match “{search}”.</div>}
      </div>
    </div>
  );
}
