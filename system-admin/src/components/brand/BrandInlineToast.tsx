"use client";

import { useEffect } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

export type BrandToast = { type: "success" | "error"; message: string };

export function BrandInlineToast({
  toast,
  onDismiss,
}: {
  toast: BrandToast | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const ok = toast.type === "success";
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-sm ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100"
          : "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100"
      }`}
      role="status"
      aria-live="polite"
    >
      {ok ? (
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <XCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
      )}
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded p-1 hover:opacity-80"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export const MAX_BRAND_UPLOAD_BYTES = 2_000_000;

export function validateBrandImageFile(file: File): string | null {
  const okType = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
  if (!okType) return "Image must be png, jpeg, or webp";
  if (file.size > MAX_BRAND_UPLOAD_BYTES) return "Image must be 2MB or smaller";
  return null;
}
