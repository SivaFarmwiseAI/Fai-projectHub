"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, UserPlus, UserMinus, Loader2, X, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  projects as projectsApi,
  users as usersApi,
  type User,
  type Project,
} from "@/lib/api-client";
import { showToast } from "@/lib/toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
  onChanged?: (updated: Project) => void;
};

export function ManageTeamDialog({ open, onOpenChange, project, onChanged }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [coOwnerIds, setCoOwnerIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setAssigneeIds(project.assignees?.map(u => u.id) ?? []);
    setCoOwnerIds(project.co_owners?.map(u => u.id) ?? []);
    usersApi.list().then(r => setUsers(r.users)).catch(() => setUsers([]));
  }, [open, project]);

  async function refreshProject() {
    try {
      const { project: updated } = await projectsApi.get(project.id);
      setAssigneeIds(updated.assignees?.map(u => u.id) ?? []);
      setCoOwnerIds(updated.co_owners?.map(u => u.id) ?? []);
      onChanged?.(updated);
    } catch {
      /* no-op */
    }
  }

  async function handleAdd(userId: string, role: "assignee" | "co_owner") {
    setPendingId(userId);
    try {
      if (role === "assignee") {
        await projectsApi.addAssignee(project.id, userId);
      } else {
        await projectsApi.addCoOwner(project.id, userId);
      }
      await refreshProject();
      showToast.success(role === "assignee" ? "Member added" : "Co-owner added");
    } catch (e) {
      showToast.error("Failed to add", e instanceof Error ? e.message : "Try again");
    } finally {
      setPendingId(null);
    }
  }

  async function handleRemove(userId: string, role: "assignee" | "co_owner") {
    setPendingId(userId);
    try {
      if (role === "assignee") {
        await projectsApi.removeAssignee(project.id, userId);
      } else {
        await projectsApi.removeCoOwner(project.id, userId);
      }
      await refreshProject();
      showToast.success("Removed from project");
    } catch (e) {
      showToast.error("Failed to remove", e instanceof Error ? e.message : "Try again");
    } finally {
      setPendingId(null);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter(u => u.is_active !== false)
      .filter(u => !q || u.name.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) || u.department?.toLowerCase().includes(q));
  }, [users, query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Manage Team — {project.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto pr-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="h-9 text-sm pl-9"
              placeholder="Search by name, role, or department…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>

          <div className="rounded-lg border divide-y">
            {filteredUsers.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No matching users.
              </div>
            ) : filteredUsers.map(u => {
              const isOwner   = u.id === project.owner_id;
              const isCoOwner = coOwnerIds.includes(u.id);
              const isAssignee = assigneeIds.includes(u.id);
              const isPending = pendingId === u.id;

              return (
                <div key={u.id} className="flex items-center gap-3 p-2.5">
                  <div
                    className="h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ backgroundColor: u.avatar_color }}
                  >
                    {u.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      {isOwner && (
                        <Badge variant="outline" className="text-[10px] bg-blue-50 border-blue-200 text-blue-700">
                          Owner
                        </Badge>
                      )}
                      {isCoOwner && (
                        <Badge variant="outline" className="text-[10px] bg-purple-50 border-purple-200 text-purple-700">
                          Co-owner
                        </Badge>
                      )}
                      {isAssignee && !isOwner && !isCoOwner && (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 border-emerald-200 text-emerald-700">
                          Member
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {u.role}{u.department ? ` · ${u.department}` : ""}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {isOwner ? (
                      <span className="text-[11px] text-muted-foreground italic px-2">Owner — cannot remove</span>
                    ) : isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        {/* Assignee toggle */}
                        {isAssignee ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleRemove(u.id, "assignee")}
                          >
                            <UserMinus className="h-3.5 w-3.5" /> Remove
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs gap-1 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => handleAdd(u.id, "assignee")}
                          >
                            <UserPlus className="h-3.5 w-3.5" /> Add
                          </Button>
                        )}
                        {/* Co-owner toggle */}
                        {isCoOwner ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-purple-600 hover:bg-purple-50"
                            onClick={() => handleRemove(u.id, "co_owner")}
                            title="Remove as co-owner"
                          >
                            <X className="h-3.5 w-3.5" /> Co-owner
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-purple-600 hover:bg-purple-50"
                            onClick={() => handleAdd(u.id, "co_owner")}
                            title="Promote to co-owner"
                          >
                            + Co-owner
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end pt-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Done</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
