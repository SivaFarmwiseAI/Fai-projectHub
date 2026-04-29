"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] p-8">
      <div className="max-w-md w-full text-center space-y-6 animate-fade-in-up">
        <div className="flex justify-center">
          <div className="h-16 w-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
          <p className="text-sm text-slate-500 leading-relaxed">
            An unexpected error occurred. You can retry, or return to the home screen.
          </p>
          {error.message && (
            <pre className="mt-3 text-xs text-left bg-slate-50 border border-slate-200 rounded-xl p-3 overflow-auto text-red-600 max-h-28">
              {error.message}
            </pre>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 active:scale-95 transition-all"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
          <a
            href="/"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 active:scale-95 transition-all"
          >
            <Home className="h-4 w-4" />
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}
