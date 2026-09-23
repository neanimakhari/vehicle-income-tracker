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

/** Soft guidance for logo / login-bg uploads (not hard rejects). */
export const LOGO_HINT =
  "Best: square or wide logo, at least 256×256, transparent PNG preferred.";
export const LOGIN_BG_HINT =
  "Best: landscape ~16:9, at least 1280×720. Large files slow logins.";

export function validateBrandImageFile(file: File): string | null {
  const okType = ["image/png", "image/jpeg", "image/webp"].includes(file.type);
  if (!okType) return "Image must be png, jpeg, or webp";
  if (file.size > MAX_BRAND_UPLOAD_BYTES) return "Image must be 2MB or smaller";
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

export type LocalImagePreview = {
  url: string;
  name: string;
  bytes: number;
  width: number;
  height: number;
  aspectLabel: string;
};

export function readLocalImagePreview(file: File): Promise<LocalImagePreview> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const w = img.naturalWidth || 0;
      const h = img.naturalHeight || 0;
      const ratio = h > 0 ? w / h : 0;
      let aspectLabel = `${w}×${h}`;
      if (ratio > 0) {
        if (Math.abs(ratio - 1) < 0.08) aspectLabel += " · ~square";
        else if (Math.abs(ratio - 16 / 9) < 0.12) aspectLabel += " · ~16:9";
        else if (Math.abs(ratio - 4 / 3) < 0.12) aspectLabel += " · ~4:3";
        else if (ratio > 1.2) aspectLabel += " · landscape";
        else if (ratio < 0.85) aspectLabel += " · portrait";
      }
      resolve({
        url,
        name: file.name,
        bytes: file.size,
        width: w,
        height: h,
        aspectLabel,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read image"));
    };
    img.src = url;
  });
}
