"use client";

/**
 * "Org Tree" — HR / leadership define each person's reporting manager. This tree
 * is what scopes a Team Lead's visibility (their direct + indirect reports).
 *
 * Two views of the same data:
 *   • List — an editable table; pick each person's manager from a dropdown.
 *   • Tree — the read-only reporting hierarchy, expandable, built from manager_id.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Network, Loader2, Search, Check, List, GitFork, ChevronRight, ChevronDown, Users, RefreshCw, AlertTriangle } from "lucide-react";
import { performanceAssessments, type OrgTreeNode } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { PerfLoader } from "@/components/performance-loader";

type Mode = "list" | "tree";

// Only these roles are eligible to be a reporting manager — Members are excluded.
const MANAGER_ROLES = new Set(["CEO", "Admin", "Team Lead"]);

export function OrgTreeEditor() {
  const [tree, setTree] = useState<OrgTreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [mode, setMode] = useState<Mode>("tree");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, setPending] = useState<
    { userId: string; managerId: string; userName: string; managerName: string } | null
  >(null);

  const load = useCallback(() => {
    setError(false);
    performanceAssessments.orgTree().then((r) => setTree(r.tree || [])).catch(() => setError(true)).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let alive = true;
    performanceAssessments.orgTree().then((r) => { if (alive) setTree(r.tree || []); }).catch(() => { if (alive) setError(true); }).finally(() => { if (alive) setLoading(false); });
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

  // Build the hierarchy: children grouped by manager; roots = no/unknown manager.
  const { roots, childrenOf } = useMemo(() => {
    const ids = new Set(tree.map((u) => u.id));
    const byMgr = new Map<string, OrgTreeNode[]>();
    const top: OrgTreeNode[] = [];
    for (const u of tree) {
      if (u.manager_id && ids.has(u.manager_id)) {
        const arr = byMgr.get(u.manager_id) ?? [];
        arr.push(u);
        byMgr.set(u.manager_id, arr);
      } else {
        top.push(u);
      }
    }
    const byName = (a: OrgTreeNode, b: OrgTreeNode) => a.name.localeCompare(b.name);
    top.sort(byName);
    byMgr.forEach((arr) => arr.sort(byName));
    return { roots: top, childrenOf: byMgr };
  }, [tree]);

  const filtered = useMemo(
    () =>
      tree.filter(
        (u) =>
          // The CEO is the top of the org and reports to no one — omit from the
          // editable list (they still appear as a root in the Tree view).
          u.role_type !== "CEO" &&
          u.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [tree, search],
  );

  if (loading) {
    return <PerfLoader label="Loading the org tree…" />;
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border p-10 shadow-card text-center" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
        <div className="h-12 w-12 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3 ring-1 ring-amber-100"><AlertTriangle className="h-6 w-6 text-amber-500" /></div>
        <h3 className="text-base font-bold text-slate-900">Couldn&apos;t load the reporting tree</h3>
        <p className="text-sm text-slate-500 mt-1.5 max-w-md mx-auto">The service is unreachable — the backend may not be deployed yet, or your session expired.</p>
        <button onClick={() => { setLoading(true); load(); }} className="mt-5 inline-flex items-center gap-1.5 rounded-xl btn-gradient text-white px-4 py-2 text-sm font-semibold shadow-glow-blue">
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Network className="h-5 w-5 text-blue-500" />
          <h3 className="text-base font-bold text-slate-900">Reporting tree</h3>
          <span className="text-sm text-slate-400 font-medium">· {tree.length} people</span>
        </div>
        <div className="flex items-center gap-2">
          {mode === "list" && (
            <div className="relative">
              <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search people…"
                className="h-9 rounded-xl border border-slate-200 pl-8 pr-3 text-sm w-48 sm:w-56 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            </div>
          )}
          {/* List / Tree toggle */}
          <div className="inline-flex items-center gap-1 rounded-xl bg-slate-100 p-1">
            {([["tree", "Tree", GitFork], ["list", "List", List]] as const).map(([key, label, Icon]) => (
              <button key={key} onClick={() => setMode(key)}
                className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition-all",
                  mode === key ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {mode === "list" ? (
        <div className="bg-white rounded-2xl border shadow-card overflow-hidden divide-y divide-slate-100" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          {filtered.map((u) => (
            <div key={u.id} className="px-4 py-3 flex items-center gap-3">
              <Avatar node={u} />
              <div className="min-w-0 flex-1">
                <p className="text-base font-semibold text-slate-900 truncate">{u.name}</p>
                <p className="text-[13px] text-slate-500 font-medium truncate">{u.role || u.role_type}{u.department ? ` · ${u.department}` : ""}</p>
              </div>
              <label className="text-[13px] text-slate-500 font-medium hidden sm:block">Reports to</label>
              <div className="flex items-center gap-2 shrink-0">
                <div className="relative">
                  <select
                    value={u.manager_id || ""}
                    onChange={(e) => {
                      const managerId = e.target.value;
                      setPending({
                        userId: u.id,
                        managerId,
                        userName: u.name,
                        managerName: managerId
                          ? (tree.find((m) => m.id === managerId)?.name ?? "")
                          : "",
                      });
                    }}
                    disabled={saving === u.id}
                    className="h-9 rounded-lg border border-slate-200 bg-white pl-2.5 pr-8 text-sm w-52 sm:w-64 appearance-none focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 disabled:opacity-60 disabled:cursor-not-allowed">
                    <option value="">— No manager —</option>
                    {tree
                      .filter(
                        (m) =>
                          m.id !== u.id &&
                          // eligible roles, plus the currently-assigned manager so a
                          // pre-existing (e.g. legacy Member) assignment still shows.
                          (MANAGER_ROLES.has(m.role_type) || m.id === u.manager_id),
                      )
                      .map((m) => (
                        <option key={m.id} value={m.id}>{m.name}{m.role_type ? ` (${m.role_type})` : ""}</option>
                      ))}
                  </select>
                  <ChevronDown className="h-4 w-4 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {saving === u.id ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  : saved === u.id ? <Check className="h-4 w-4 text-emerald-500" />
                  : <span className="w-4" />}
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="px-4 py-8 text-center text-sm text-slate-400">No people match “{search}”.</div>}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border shadow-card p-3 sm:p-4" style={{ borderColor: "rgba(0,0,0,0.06)" }}>
          {roots.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">No reporting tree defined yet.</div>
          ) : (
            <div className="space-y-0.5">
              {roots.map((r) => (
                <TreeBranch key={r.id} node={r} childrenOf={childrenOf} visited={new Set()} />
              ))}
            </div>
          )}
          {childrenOf.size === 0 && roots.length > 0 && (
            <p className="text-[13px] text-slate-400 mt-3 px-1">Everyone is a top-level node — set managers in List view to build the hierarchy.</p>
          )}
        </div>
      )}

      {/* Confirm before changing a reporting relationship. */}
      {pending && (
        <div
          className="fixed inset-0 z-[130] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)" }}
          onClick={() => setPending(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">Update reporting manager?</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              {pending.managerId ? (
                <>
                  Set <b className="text-slate-900">{pending.managerName}</b> as{" "}
                  <b className="text-slate-900">{pending.userName}</b>&apos;s reporting
                  manager?
                </>
              ) : (
                <>
                  Remove <b className="text-slate-900">{pending.userName}</b>&apos;s
                  reporting manager?
                </>
              )}
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setPending(null)}
                className="rounded-xl border border-slate-200 text-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setManager(pending.userId, pending.managerId);
                  setPending(null);
                }}
                className="rounded-xl btn-gradient text-white px-4 py-2 text-sm font-semibold shadow-glow-blue"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Recursive tree branch (indentation comes from DOM nesting) ────────────────
function TreeBranch({ node, childrenOf, visited }: {
  node: OrgTreeNode; childrenOf: Map<string, OrgTreeNode[]>; visited: Set<string>;
}) {
  const [open, setOpen] = useState(true);
  const kids = childrenOf.get(node.id) ?? [];
  // Guard against accidental cycles in manager_id.
  const safeKids = kids.filter((k) => !visited.has(k.id));
  const nextVisited = new Set(visited).add(node.id);

  return (
    <div>
      <div className="flex items-center gap-2.5 py-1.5 rounded-lg hover:bg-slate-50 px-1.5">
        {safeKids.length > 0 ? (
          <button onClick={() => setOpen((o) => !o)} className="h-5 w-5 flex items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-200 shrink-0">
            {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        ) : (
          <span className="h-5 w-5 flex items-center justify-center shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-slate-200" /></span>
        )}
        <Avatar node={node} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-slate-900 truncate">{node.name}</p>
            <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{node.role_type}</span>
          </div>
          <p className="text-[13px] text-slate-500 font-medium truncate">{node.role || ""}{node.department ? ` · ${node.department}` : ""}</p>
        </div>
        {safeKids.length > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full shrink-0">
            <Users className="h-3 w-3" /> {safeKids.length}
          </span>
        )}
      </div>
      {open && safeKids.length > 0 && (
        <div className="border-l border-slate-100 ml-[18px] pl-2">
          {safeKids.map((k) => (
            <TreeBranch key={k.id} node={k} childrenOf={childrenOf} visited={nextVisited} />
          ))}
        </div>
      )}
    </div>
  );
}

function Avatar({ node }: { node: OrgTreeNode }) {
  return (
    <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0 ring-2 ring-white shadow-sm"
      style={{ backgroundColor: node.avatar_color || "#3b82f6" }}>
      {node.name.charAt(0).toUpperCase()}
    </div>
  );
}
