"use client";

import { BrandLoader } from "@/components/brand-loader";

/**
 * Shared branded loading state for every Performance Assessment view
 * (My Assessment, My Reviews, My Team, Analysis, Cycles, Org Tree) so the
 * loading experience is consistent across the whole feature.
 */
export function PerfLoader({ label = "Loading…" }: { label?: string }) {
  return <BrandLoader label={label} />;
}
