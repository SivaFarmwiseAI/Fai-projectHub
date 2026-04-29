"use client";

import { use } from "react";
import { KanbanClient } from "@/components/kanban-client";

export default function KanbanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <KanbanClient projectId={id} />;
}
