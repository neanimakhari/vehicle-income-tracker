"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X, Eye, EyeOff } from "lucide-react";

type Tenant = { id: string; name: string; slug: string };

type CreateTenantAdminModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tenants: Tenant[];
  createTenantAdmin: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
};

export function CreateTenantAdminModal({
  isOpen,
  onClose,
  tenants,
  createTenantAdmin,
}: CreateTenantAdminModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await createTenantAdmin(formData);
    if (result?.success) {
      handleClose();
      router.push("/tenant-admins?success=" + encodeURIComponent("Tenant admin created"));
      router.refresh();
    } else if (result?.error) {
      setError(result.error);
    }
  }

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const titleId = "create-tenant-admin-modal-title";

  useEffect(() => {
    if (isOpen) previousActiveRef.current = document.activeElement as HTMLElement | null;
  }, [isOpen]);

  const handleClose = () => {
    previousActiveRef.current?.focus();
    onClose();
  };

  useEffect(() => {
    if (!isOpen || !dialogRef.current) return;
    const dialog = dialogRef.current;
    const focusables = dialog.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    first?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
      <div className="absolute inset-0 bg-zinc-900/60 dark:bg-zinc-950/70" onClick={handleClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Add tenant admin</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <form action={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
            <input name="email" type="email" required className="input w-full px-3 py-2 text-sm" placeholder="admin@example.com" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Password (min 12 chars)</label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={12}
                className="input w-full px-3 py-2 pr-10 text-sm"
                placeholder="••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tenant</label>
            <select name="tenantSlug" required className="input w-full px-3 py-2 text-sm">
              <option value="">Select tenant</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose} className="btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600">
              Create admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
