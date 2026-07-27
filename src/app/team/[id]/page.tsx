"use client";

import React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BrandLoader } from "@/components/brand-loader";
import { Button } from "@/components/ui/button";
import { TeamMemberView } from "@/components/team-member/team-member-view";
import type { TeamMemberData } from "@/components/team-member/derive";
import {
  users as usersApi,
  projects as projectsApi,
  type LeaveRequest,
  type Project,
  type Task,
  type User,
} from "@/lib/api-client";

export default function TeamMemberPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = React.use(params);

  const [user, setUser] = React.useState<User | null>(null);
  const [projects, setProjects] = React.useState<Project[]>([]);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [leaves, setLeaves] = React.useState<LeaveRequest[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    Promise.all([
      usersApi.get(id),
      projectsApi.list({ assignee_id: id }),
      usersApi.tasks(id),
      usersApi.leave(id),
    ])
      .then(([u, p, t, l]) => {
        setUser(u.user);
        setProjects(p.projects);
        setTasks(t.tasks);
        setLeaves(l.leave);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const data: TeamMemberData | null = React.useMemo(() => {
    if (!user) return null;
    return {
      user,
      projects,
      projectById: Object.fromEntries(projects.map((proj) => [proj.id, proj])),
      tasks,
      leaves,
    };
  }, [user, projects, tasks, leaves]);

  if (loading) {
    return <BrandLoader label="Loading member profile…" />;
  }

  if (!data) {
    notFound();
  }

  return (
    <div className="w-full space-y-4 pb-12">
      <Link href="/team">
        <Button variant="ghost" size="sm">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Team
        </Button>
      </Link>

      <TeamMemberView data={data} />
    </div>
  );
}
