"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  FolderKanban,
  CheckCircle2,
  Clock,
  Mail,
  Loader2,
  Activity,
  AlertCircle,
} from "lucide-react";
import { users as usersApi } from "@/lib/api-client";
import type { User } from "@/lib/api-client";

function getScoreColor(score: number): string {
  if (score >= 90) return "bg-green-500";
  if (score >= 80) return "bg-blue-500";
  if (score >= 70) return "bg-amber-500";
  return "bg-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 80) return "Good";
  if (score >= 70) return "Average";
  return "Needs Improvement";
}

export default function TeamPage() {
  const [teamMembers, setTeamMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    usersApi.list()
      .then(r => setTeamMembers(r.users ?? []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
        <AlertCircle className="h-8 w-8 text-red-400" />
        <p className="text-sm">Failed to load team data. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Users className="h-7 w-7 text-purple-600" />
            Team Performance
          </h1>
          <p className="text-muted-foreground mt-1">
            Overview of team member activity and performance metrics
          </p>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {teamMembers.length} members
        </Badge>
      </div>

      {/* Empty state */}
      {teamMembers.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
          <Users className="h-10 w-10 opacity-30" />
          <p className="text-sm">No team members found.</p>
        </div>
      )}

      {/* Team Member Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {teamMembers.map((user) => {
          const score = Math.round(user.health_score ?? 75);
          const activeTasks = user.active_tasks ?? 0;
          const completedTasks = user.completed_tasks ?? 0;
          const blockedTasks = user.blocked_tasks ?? 0;
          const avgMood = user.avg_mood != null
            ? Math.round(user.avg_mood * 10) / 10
            : null;

          return (
            <Link key={user.id} href={`/team/${user.id}`}>
              <Card className="hover:bg-gray-100 transition-colors cursor-pointer h-full">
                <CardContent className="pt-6 space-y-4">
                  {/* Profile header */}
                  <div className="flex items-center gap-4">
                    <div
                      className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold text-white shrink-0"
                      style={{ backgroundColor: user.avatar_color || "#64748b" }}
                    >
                      {user.name?.[0] ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base">{user.name}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-sm text-muted-foreground truncate">{user.role}</p>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-gray-50 text-gray-600 border-gray-200 shrink-0">
                          {user.department}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{user.email}</span>
                      </p>
                    </div>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div className="p-2 rounded-lg bg-gray-100">
                      <div className="flex items-center justify-center mb-1">
                        <FolderKanban className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <p className="text-lg font-bold">{activeTasks}</p>
                      <p className="text-[10px] text-muted-foreground">Active</p>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-100">
                      <div className="flex items-center justify-center mb-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      </div>
                      <p className="text-lg font-bold">{completedTasks}</p>
                      <p className="text-[10px] text-muted-foreground">Done</p>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-100">
                      <div className="flex items-center justify-center mb-1">
                        <Clock className="h-3.5 w-3.5 text-red-600" />
                      </div>
                      <p className="text-lg font-bold">{blockedTasks}</p>
                      <p className="text-[10px] text-muted-foreground">Blocked</p>
                    </div>
                    <div className="p-2 rounded-lg bg-gray-100">
                      <div className="flex items-center justify-center mb-1">
                        <Activity className="h-3.5 w-3.5 text-purple-600" />
                      </div>
                      <p className="text-lg font-bold">{avgMood ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">Mood</p>
                    </div>
                  </div>

                  {/* Health Score */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Health Score</span>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            score >= 90
                              ? "text-green-700 border-green-200 bg-green-50"
                              : score >= 80
                              ? "text-blue-700 border-blue-200 bg-blue-50"
                              : score >= 70
                              ? "text-amber-700 border-amber-200 bg-amber-50"
                              : "text-red-700 border-red-200 bg-red-50"
                          }`}
                        >
                          {getScoreLabel(score)}
                        </Badge>
                        <span className="text-sm font-bold">{score}%</span>
                      </div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${getScoreColor(score)}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
