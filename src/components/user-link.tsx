"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * UserLink — wraps a person's name (and/or avatar) in a link to their
 * individual dashboard at `/team/{id}`.
 *
 * - When `userId` is missing, it renders the children as plain, non-interactive
 *   text so callers can pass it unconditionally.
 * - `stopPropagation` on click keeps it from triggering a parent card/row's
 *   own onClick (e.g. kanban cards, task rows) while still navigating.
 */
export function UserLink({
  userId,
  className,
  title,
  children,
}: {
  userId?: string | null;
  className?: string;
  title?: string;
  children: React.ReactNode;
}) {
  if (!userId) {
    return <span className={className}>{children}</span>;
  }
  return (
    <Link
      href={`/team/${userId}`}
      title={title}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        "hover:text-blue-600 hover:underline underline-offset-2 transition-colors cursor-pointer",
        className,
      )}
    >
      {children}
    </Link>
  );
}
