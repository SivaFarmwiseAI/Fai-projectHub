"use client";

import { useState } from "react";
import { Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { auth as authApi, ApiError } from "@/lib/api-client";
import { showToast } from "@/lib/toast";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const MIN_LENGTH = 8;

export function ChangePasswordDialog({ open, onOpenChange }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setShow(false);
  }

  function handleOpenChange(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  async function handleSave() {
    if (!current) {
      showToast.error("Enter your current password");
      return;
    }
    if (next.length < MIN_LENGTH) {
      showToast.error(`New password must be at least ${MIN_LENGTH} characters`);
      return;
    }
    if (next !== confirm) {
      showToast.error("New passwords do not match");
      return;
    }
    if (next === current) {
      showToast.error("New password must differ from the current one");
      return;
    }

    setSaving(true);
    try {
      await authApi.changePassword(current, next);
      showToast.success("Password updated", "Use your new password next time you sign in.");
      handleOpenChange(false);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Please try again.";
      showToast.error("Could not change password", msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <KeyRound className="h-4.5 w-4.5 text-slate-600" />
            Change Password
          </DialogTitle>
          <DialogDescription>
            Update the password for your account. You&apos;ll keep using the same email to sign in.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs">Current password</Label>
            <Input
              type={show ? "text" : "password"}
              autoComplete="current-password"
              className="h-9 text-sm mt-1"
              value={current}
              onChange={e => setCurrent(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs">New password</Label>
            <div className="relative">
              <Input
                type={show ? "text" : "password"}
                autoComplete="new-password"
                className="h-9 text-sm mt-1 pr-9"
                value={next}
                onChange={e => setNext(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShow(v => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5 text-slate-400 hover:text-slate-600"
                aria-label={show ? "Hide passwords" : "Show passwords"}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mt-1">At least {MIN_LENGTH} characters.</p>
          </div>

          <div>
            <Label className="text-xs">Confirm new password</Label>
            <Input
              type={show ? "text" : "password"}
              autoComplete="new-password"
              className="h-9 text-sm mt-1"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button size="sm" className="gap-1.5" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-3.5 w-3.5" />}
              Update Password
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
