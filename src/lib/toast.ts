/**
 * Central toast helpers — import `showToast` everywhere instead of `toast`
 * so we have one place to tweak wording or swap libraries.
 */
import { toast } from "sonner";

export const showToast = {
  success: (message: string, description?: string) =>
    toast.success(message, { description }),

  error: (message: string, description?: string) =>
    toast.error(message, { description }),

  info: (message: string, description?: string) =>
    toast.info(message, { description }),

  warning: (message: string, description?: string) =>
    toast.warning(message, { description }),

  loading: (message: string) => toast.loading(message),

  dismiss: (id?: string | number) => toast.dismiss(id),

  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string }
  ) =>
    toast.promise(promise, messages),

  // Semantic helpers
  saved: () => toast.success("Changes saved"),
  deleted: () => toast.success("Deleted successfully"),
  copied: () => toast.success("Copied to clipboard"),

  authError: (msg = "Session expired. Please log in again.") =>
    toast.error(msg),
};
