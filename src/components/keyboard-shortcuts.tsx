"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { X, Keyboard } from "lucide-react";
import { cn } from "@/lib/utils";

type Shortcut = { keys: string[]; description: string };

const SHORTCUT_GROUPS: { group: string; shortcuts: Shortcut[] }[] = [
  {
    group: "Navigation",
    shortcuts: [
      { keys: ["G", "H"], description: "Go to Home / Dashboard" },
      { keys: ["G", "P"], description: "Go to Projects" },
      { keys: ["G", "T"], description: "Go to Team" },
      { keys: ["G", "A"], description: "Go to Analytics" },
      { keys: ["G", "S"], description: "Go to Standup" },
      { keys: ["G", "D"], description: "Go to Discussions" },
    ],
  },
  {
    group: "Actions",
    shortcuts: [
      { keys: ["Ctrl", "K"], description: "Open command palette" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Esc"], description: "Close modal / palette" },
    ],
  },
  {
    group: "Views",
    shortcuts: [
      { keys: ["Ctrl", "B"], description: "Toggle sidebar" },
      { keys: ["Ctrl", "D"], description: "Toggle dark mode" },
      { keys: ["Ctrl", "P"], description: "Print current page" },
    ],
  },
];

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded-md bg-slate-100 border border-slate-300 text-slate-700 font-mono text-[11px] font-bold shadow-sm">
      {children}
    </kbd>
  );
}

const G_ROUTES: Record<string, string> = {
  h: "/", p: "/projects", t: "/team",
  a: "/analytics", s: "/standup", d: "/discussions",
};

export function KeyboardShortcutsOverlay() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pendingG = useRef(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement).tagName);

      if (inInput) { pendingG.current = false; return; }

      // ? key
      if (e.key === "?") { setOpen(v => !v); return; }
      if (e.key === "Escape") { setOpen(false); return; }

      // Ctrl+D — dark mode toggle
      if (e.ctrlKey && e.key === "d") {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("ph:toggle-theme"));
        return;
      }
      // Ctrl+P — print
      if (e.ctrlKey && e.key === "p") {
        e.preventDefault();
        window.print();
        return;
      }

      // G+<key> navigation
      if (!e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "g") {
        pendingG.current = true;
        setTimeout(() => { pendingG.current = false; }, 1000);
        return;
      }
      if (pendingG.current) {
        const route = G_ROUTES[e.key.toLowerCase()];
        if (route) { e.preventDefault(); router.push(route); }
        pendingG.current = false;
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [router]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" />

      {/* Panel */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[80vh] overflow-auto animate-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 sticky top-0 bg-white rounded-t-2xl z-10">
          <div className="h-8 w-8 rounded-xl bg-slate-100 flex items-center justify-center">
            <Keyboard className="h-4 w-4 text-slate-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">Keyboard Shortcuts</h2>
            <p className="text-xs text-slate-400">Press <Kbd>?</Kbd> to toggle</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shortcut groups */}
        <div className="p-5 space-y-6">
          {SHORTCUT_GROUPS.map(({ group, shortcuts }) => (
            <div key={group}>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">{group}</p>
              <div className="space-y-2">
                {shortcuts.map(({ keys, description }) => (
                  <div key={description} className="flex items-center justify-between gap-4">
                    <span className="text-sm font-medium text-slate-700">{description}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {keys.map((k, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <Kbd>{k}</Kbd>
                          {i < keys.length - 1 && <span className="text-slate-400 text-xs font-bold">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 pb-4">
          <p className="text-[11px] text-slate-400 text-center">
            Tip: Use <Kbd>Ctrl</Kbd> + <Kbd>K</Kbd> to search anything instantly
          </p>
        </div>
      </div>
    </div>
  );
}
