"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Check,
  X,
  Code2,
  BrainCircuit,
  ChevronDown,
  Plus,
  Building2,
  Briefcase,
  Settings2,
} from "lucide-react";
import { users as usersApi, type User } from "@/lib/api-client";

const AVATAR_COLORS = [
  "#3b82f6",
  "#a855f7",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

function countByDepartment(members: User[]) {
  const engineering = members.filter((m) =>
    /engineer|developer|full.?stack|backend|frontend|devops/i.test(m.role ?? "")
  ).length;
  const dsml = members.filter((m) =>
    /data.?scien|ml|machine.?learn|ai|analyst/i.test(m.role ?? "")
  ).length;
  return { engineering, dsml };
}

// ── Searchable Dropdown Component ──
function SearchableDropdown({
  label,
  options,
  value,
  onChange,
  placeholder,
  onAddNew,
}: {
  label: string;
  options: string[];
  value: string;
  onChange: (val: string) => void;
  placeholder: string;
  onAddNew?: (val: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [showAddNew, setShowAddNew] = useState(false);
  const [newValue, setNewValue] = useState("");

  const filtered = options.filter((o) =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setSearch(""); }}
        className="flex items-center justify-between w-full h-9 px-3 rounded-md border border-input bg-background text-sm hover:bg-gray-50 transition-colors"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || placeholder}
        </span>
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border border-border bg-white shadow-lg max-h-60 overflow-hidden">
          <div className="p-1.5 border-b border-border">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${label.toLowerCase()}...`}
              className="h-7 text-xs"
              autoFocus
            />
          </div>
          <div className="max-h-44 overflow-y-auto p-1">
            {filtered.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => { onChange(option); setOpen(false); }}
                className={`flex items-center w-full px-2 py-1.5 rounded text-xs text-left hover:bg-gray-100 transition-colors ${
                  value === option ? "bg-blue-50 text-blue-700 font-medium" : ""
                }`}
              >
                {value === option && <Check className="h-3 w-3 mr-1.5 shrink-0" />}
                <span className={value === option ? "" : "ml-[18px]"}>{option}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No matches</p>
            )}
          </div>
          {onAddNew && (
            <div className="border-t border-border p-1.5">
              {!showAddNew ? (
                <button
                  type="button"
                  onClick={() => setShowAddNew(true)}
                  className="flex items-center gap-1.5 w-full px-2 py-1.5 rounded text-xs text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  <Plus className="h-3 w-3" /> Add new {label.toLowerCase()}
                </button>
              ) : (
                <div className="flex gap-1.5">
                  <Input
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder={`New ${label.toLowerCase()}...`}
                    className="h-7 text-xs flex-1"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    className="h-7 text-xs px-2"
                    disabled={!newValue.trim()}
                    onClick={() => {
                      onAddNew(newValue.trim());
                      onChange(newValue.trim());
                      setNewValue("");
                      setShowAddNew(false);
                      setOpen(false);
                    }}
                  >
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs px-2"
                    onClick={() => { setShowAddNew(false); setNewValue(""); }}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ManageTeamPage() {
  const [members, setMembers] = useState<User[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: "", role: "", department: "", email: "" });
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    usersApi.list().then(r => {
      setMembers(r.users);
      setRoles([...new Set(r.users.map(u => u.role).filter(Boolean))]);
      setDepartments([...new Set(r.users.map(u => u.department).filter(Boolean))]);
    }).catch(() => {});
  }, []);

  // New member form state
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newDepartment, setNewDepartment] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newColor, setNewColor] = useState(AVATAR_COLORS[0]);

  // Master list management
  const [showMasters, setShowMasters] = useState(false);

  const teamMembers = members;
  const { engineering, dsml } = countByDepartment(teamMembers);

  // Group by department
  const deptCounts: Record<string, number> = {};
  teamMembers.forEach((m) => {
    deptCounts[m.department] = (deptCounts[m.department] || 0) + 1;
  });

  // --- Edit handlers ---
  function startEditing(user: User) {
    setEditingId(user.id);
    setEditForm({ name: user.name, role: user.role ?? "", department: user.department ?? "", email: user.email });
  }

  function cancelEditing() {
    setEditingId(null);
  }

  function saveEditing(id: string) {
    usersApi.update(id, { name: editForm.name, role: editForm.role, department: editForm.department, email: editForm.email }).catch(() => {});
    setMembers((prev) =>
      prev.map((m) =>
        m.id === id
          ? { ...m, name: editForm.name, role: editForm.role, department: editForm.department, email: editForm.email }
          : m
      )
    );
    setEditingId(null);
  }

  // --- Remove handler ---
  async function handleRemove(user: User) {
    const confirmed = confirm(`Remove ${user.name}? This will deactivate their account.`);
    if (confirmed) {
      try {
        await usersApi.delete(user.id);
        setMembers((prev) => prev.filter((m) => m.id !== user.id));
      } catch (e: unknown) {
        alert(`Failed to remove member: ${e instanceof Error ? e.message : "Unknown error"}`);
      }
    }
  }

  // --- Add handler ---
  async function handleAdd() {
    if (!newName.trim() || !newRole.trim() || !newEmail.trim() || !newDepartment.trim() || !newPassword.trim()) {
      alert("Please fill in all fields including password.");
      return;
    }
    try {
      const r = await usersApi.create({
        name: newName.trim(),
        email: newEmail.trim(),
        password: newPassword.trim(),
        role: newRole.trim(),
        role_type: "member",
        department: newDepartment.trim(),
        avatar_color: newColor,
      });
      setMembers((prev) => [...prev, r.user]);
      setRoles((prev) => [...new Set([...prev, r.user.role])]);
      setDepartments((prev) => [...new Set([...prev, r.user.department])]);
      setNewName("");
      setNewRole("");
      setNewDepartment("");
      setNewEmail("");
      setNewPassword("");
      setNewColor(AVATAR_COLORS[0]);
    } catch (e: unknown) {
      alert(`Failed to add member: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/team"
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Team
          </Link>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-purple-600" />
            Manage Team
          </h1>
          <p className="text-muted-foreground mt-1">
            Add, edit, or remove team members. Manage roles &amp; departments.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={() => setShowMasters(!showMasters)}
        >
          <Settings2 className="h-3.5 w-3.5" />
          {showMasters ? "Hide" : "Manage"} Roles &amp; Depts
        </Button>
      </div>

      {/* ── Master Lists Management ── */}
      {showMasters && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Roles Master */}
          <Card className="border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-600" />
                Roles ({roles.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {roles.map((role) => {
                  const inUse = members.some((m) => m.role === role);
                  return (
                    <div key={role} className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${inUse ? "bg-blue-50 text-blue-700 border-blue-200" : "bg-gray-50 text-gray-600"}`}
                      >
                        {role}
                      </Badge>
                      {!inUse && (
                        <button
                          onClick={() => { setRoles(prev => prev.filter(r => r !== role)); forceUpdate((p) => p + 1); }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Remove role"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1.5 pt-1">
                <Input
                  placeholder="Add new role..."
                  className="h-7 text-xs flex-1"
                  id="new-role-master"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const input = e.currentTarget;
                      if (input.value.trim()) {
                        setRoles(prev => [...new Set([...prev, input.value.trim()])]);
                        input.value = "";
                        forceUpdate((p) => p + 1);
                      }
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2"
                  onClick={() => {
                    const input = document.getElementById("new-role-master") as HTMLInputElement;
                    if (input?.value.trim()) {
                      setRoles(prev => [...new Set([...prev, input.value.trim()])]);
                      input.value = "";
                      forceUpdate((p) => p + 1);
                    }
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Departments Master */}
          <Card className="border-purple-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-600" />
                Departments ({departments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {departments.map((dept) => {
                  const inUse = members.some((m) => m.department === dept);
                  const count = deptCounts[dept] || 0;
                  return (
                    <div key={dept} className="flex items-center gap-1">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${inUse ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-gray-50 text-gray-600"}`}
                      >
                        {dept}
                        {count > 0 && (
                          <span className="ml-1 text-[8px] font-bold bg-purple-200 text-purple-800 rounded-full px-1">
                            {count}
                          </span>
                        )}
                      </Badge>
                      {!inUse && (
                        <button
                          onClick={() => { setDepartments(prev => prev.filter(d => d !== dept)); forceUpdate((p) => p + 1); }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                          title="Remove department"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-1.5 pt-1">
                <Input
                  placeholder="Add new department..."
                  className="h-7 text-xs flex-1"
                  id="new-dept-master"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const input = e.currentTarget;
                      if (input.value.trim()) {
                        setDepartments(prev => [...new Set([...prev, input.value.trim()])]);
                        input.value = "";
                        forceUpdate((p) => p + 1);
                      }
                    }
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs px-2"
                  onClick={() => {
                    const input = document.getElementById("new-dept-master") as HTMLInputElement;
                    if (input?.value.trim()) {
                      setDepartments(prev => [...new Set([...prev, input.value.trim()])]);
                      input.value = "";
                      forceUpdate((p) => p + 1);
                    }
                  }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{teamMembers.length}</p>
              <p className="text-xs text-muted-foreground">Total Members</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Code2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{engineering}</p>
              <p className="text-xs text-muted-foreground">Engineering</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <BrainCircuit className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{dsml}</p>
              <p className="text-xs text-muted-foreground">DS / ML</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Current Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Current Team Members</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {teamMembers.map((user) => {
            const isEditing = editingId === user.id;

            return (
              <div
                key={user.id}
                className="flex items-center gap-4 p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                {/* Avatar */}
                <div
                  className="h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                  style={{ backgroundColor: user.avatar_color }}
                >
                  {user.name[0]}
                </div>

                {isEditing ? (
                  /* Inline edit mode */
                  <div className="flex-1 space-y-2">
                    <div className="grid grid-cols-4 gap-2">
                      <Input
                        value={editForm.name}
                        onChange={(e) =>
                          setEditForm({ ...editForm, name: e.target.value })
                        }
                        placeholder="Name"
                        className="h-8 text-sm"
                      />
                      <SearchableDropdown
                        label="Role"
                        options={roles}
                        value={editForm.role}
                        onChange={(val) => setEditForm({ ...editForm, role: val })}
                        placeholder="Select role"
                        onAddNew={(val) => { setRoles(prev => [...new Set([...prev, val])]); forceUpdate((p) => p + 1); }}
                      />
                      <SearchableDropdown
                        label="Department"
                        options={departments}
                        value={editForm.department}
                        onChange={(val) => setEditForm({ ...editForm, department: val })}
                        placeholder="Select dept"
                        onAddNew={(val) => { setDepartments(prev => [...new Set([...prev, val])]); forceUpdate((p) => p + 1); }}
                      />
                      <Input
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm({ ...editForm, email: e.target.value })
                        }
                        placeholder="Email"
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>
                ) : (
                  /* Display mode */
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{user.name}</p>
                      <Badge variant="outline" className="text-[10px]">
                        {user.role}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                        {user.department}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex items-center gap-1 shrink-0">
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => saveEditing(user.id)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        onClick={cancelEditing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                        onClick={() => startEditing(user)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50"
                        onClick={() => handleRemove(user)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {teamMembers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              No team members found.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Add New Member Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-green-600" />
            Add New Member
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-name">Name</Label>
              <Input
                id="new-name"
                placeholder="e.g. Deepa"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-email">Email</Label>
              <Input
                id="new-email"
                placeholder="e.g. deepa@company.dev"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Temp Password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="Initial password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Role</Label>
              <SearchableDropdown
                label="Role"
                options={roles}
                value={newRole}
                onChange={setNewRole}
                placeholder="Select a role..."
                onAddNew={(val) => { setRoles(prev => [...new Set([...prev, val])]); forceUpdate((p) => p + 1); }}
              />
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <SearchableDropdown
                label="Department"
                options={departments}
                value={newDepartment}
                onChange={setNewDepartment}
                placeholder="Select a department..."
                onAddNew={(val) => { setDepartments(prev => [...new Set([...prev, val])]); forceUpdate((p) => p + 1); }}
              />
            </div>
          </div>

          {/* Color Picker */}
          <div className="space-y-2">
            <Label>Avatar Color</Label>
            <div className="flex items-center gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setNewColor(color)}
                  className="h-8 w-8 rounded-full transition-all flex items-center justify-center"
                  style={{
                    backgroundColor: color,
                    outline: newColor === color ? "2px solid white" : "none",
                    outlineOffset: "2px",
                  }}
                >
                  {newColor === color && (
                    <Check className="h-4 w-4 text-white" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleAdd} className="w-full md:w-auto">
            <UserPlus className="h-4 w-4 mr-2" />
            Add Member
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
