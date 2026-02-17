"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

type Tenant = { id: string; name: string; slug: string };

type TenantAdmin = {
  id: string;
  email: string;
  tenantId: string;
  tenantName?: string;
  isActive: boolean;
  createdAt: string;
};

type EditTenantAdminModalProps = {
  admin: TenantAdmin | null;
  tenants: Tenant[];
  onClose: () => void;
  updateTenantAdmin: (id: string, data: { email?: string; tenantSlug?: string; isActive?: boolean }) => Promise<{ success: boolean; error?: string }>;
};

export function EditTenantAdminModal({
  admin,
  tenants,
  onClose,
  updateTenantAdmin,
}: EditTenantAdminModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const titleId = "edit-tenant-admin-modal-title";

  useEffect(() => {
    if (admin) previousActiveRef.current = document.activeElement as HTMLElement | null;
  }, [admin?.id]);

  const handleClose = () => {
    previousActiveRef.current?.focus();
    onClose();
  };

  useEffect(() => {
    if (!admin || !dialogRef.current) return;
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
  }, [admin?.id]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!admin) return;
    setError(null);
    const form = e.currentTarget;
    const email = (form.querySelector('[name="email"]') as HTMLInputElement)?.value?.trim();
    const tenantSlug = (form.querySelector('[name="tenantSlug"]') as HTMLSelectElement)?.value;
    const isActive = (form.querySelector('[name="isActive"]') as HTMLInputElement)?.checked;
    const result = await updateTenantAdmin(admin.id, { email, tenantSlug, isActive });
    if (result?.success) {
      handleClose();
      router.push("/tenant-admins?success=" + encodeURIComponent("Tenant admin updated"));
      router.refresh();
    } else if (result?.error) {
      setError(result.error);
    }
  }

  if (!admin) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
      <div className="absolute inset-0 bg-zinc-900/60 dark:bg-zinc-950/70" onClick={handleClose} aria-hidden />
      <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Edit tenant admin</h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
            <input name="email" type="email" required defaultValue={admin.email} className="input w-full px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tenant</label>
            <select name="tenantSlug" required defaultValue={admin.tenantId} className="input w-full px-3 py-2 text-sm">
              {tenants.map((t) => (
                <option key={t.id} value={t.slug}>
                  {t.name} ({t.slug})
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                id="edit-tenant-admin-active"
                defaultChecked={admin.isActive}
                className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <label htmlFor="edit-tenant-admin-active" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Active
              </label>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
              If inactive, this admin cannot sign in to the tenant admin app. Drivers for this tenant can still sign in and log income.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose} className="btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button type="submit" className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

