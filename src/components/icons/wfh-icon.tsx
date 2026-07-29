import type { SVGProps } from "react";

/**
 * Work-from-home glyph — a house with a person at a laptop underneath.
 * Drawn in the same stroke conventions as lucide-react (24x24 viewBox,
 * round caps/joins, `currentColor`) so it drops in anywhere a lucide icon
 * is used and recolors via the same `text-*` className the caller passes.
 */
export function WfhIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* roof + chimney */}
      <path d="M2.5 11 L12 3 L14.5 5.6 L14.5 3 L17.5 3 L17.5 8.9 L21.5 11" />
      {/* head + hair sweep */}
      <circle cx="12" cy="13.6" r="2.1" />
      <path d="M9.8 12.5 Q12 11 14.2 12.5" />
      {/* shoulders */}
      <path d="M8.2 21 C8.2 17.9 9.9 16.4 12 16.4 C14.1 16.4 15.8 17.9 15.8 21" />
      {/* laptop */}
      <rect x="9.7" y="18.2" width="4.6" height="2.8" rx="0.4" />
      <path d="M8.7 21 L15.3 21" />
    </svg>
  );
}
