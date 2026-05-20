"use client";

import * as React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmTone = "default" | "danger" | "warning";

export interface ConfirmOptions {
  title?: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

type ConfirmFn = (opts?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

interface PendingState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = React.useState<PendingState | null>(null);

  const confirm = React.useCallback<ConfirmFn>((opts) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...opts, resolve });
    });
  }, []);

  const respond = React.useCallback((value: boolean) => {
    setPending((curr) => {
      curr?.resolve(value);
      return null;
    });
  }, []);

  const tone = pending?.tone ?? "default";
  const isDanger = tone === "danger";
  const isWarning = tone === "warning";

  const Icon = isDanger ? Trash2 : isWarning ? AlertTriangle : null;
  const iconWrap =
    isDanger
      ? "bg-red-50 text-red-600 ring-1 ring-red-100"
      : isWarning
      ? "bg-amber-50 text-amber-600 ring-1 ring-amber-100"
      : "";

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={!!pending}
        onOpenChange={(open) => {
          if (!open) respond(false);
        }}
      >
        {pending && (
          <DialogContent className="sm:max-w-md" showCloseButton={false}>
            <DialogHeader>
              <div className="flex items-start gap-3">
                {Icon && (
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${iconWrap}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                )}
                <div className="flex-1 space-y-1.5">
                  <DialogTitle>{pending.title ?? "Are you sure?"}</DialogTitle>
                  {pending.description && (
                    <DialogDescription>{pending.description}</DialogDescription>
                  )}
                </div>
              </div>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => respond(false)}>
                {pending.cancelLabel ?? "Cancel"}
              </Button>
              <Button
                variant={isDanger ? "destructive" : "default"}
                onClick={() => respond(true)}
                autoFocus
              >
                {pending.confirmLabel ?? (isDanger ? "Delete" : "Confirm")}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>");
  }
  return ctx;
}
