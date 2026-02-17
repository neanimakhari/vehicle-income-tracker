"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";

type Tenant = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  requireMfa?: boolean;
  requireMfaUsers?: boolean;
  maxDrivers?: number | null;
  maxStorageMb?: number | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  website?: string | null;
  notes?: string | null;
};

type EditTenantModalProps = {
  tenant: Tenant | null;
  onClose: () => void;
  updateTenant: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
};

export function EditTenantModal({ tenant, onClose, updateTenant }: EditTenantModalProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const titleId = "edit-tenant-modal-title";

  useEffect(() => {
    if (tenant) previousActiveRef.current = document.activeElement as HTMLElement | null;
  }, [tenant?.id]);

  const handleClose = () => {
    previousActiveRef.current?.focus();
    onClose();
  };

  useEffect(() => {
    if (!tenant || !dialogRef.current) return;
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
  }, [tenant?.id]);

  if (!tenant) return null;

  const tenantId = tenant.id;

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("id", tenantId);
    const result = await updateTenant(formData);
    if (result?.success) {
      handleClose();
      router.push("/tenants?success=" + encodeURIComponent("Tenant updated"));
      router.refresh();
    } else if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
      <div className="absolute inset-0 bg-zinc-900/60 dark:bg-zinc-950/70" onClick={handleClose} aria-hidden />
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Edit tenant</h2>
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
          <input type="hidden" name="id" value={tenant.id} />
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-500 dark:text-zinc-400">Name</label>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{tenant.name}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-500 dark:text-zinc-400">Slug</label>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{tenant.slug}</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Contact name</label>
            <input
              name="contactName"
              defaultValue={tenant.contactName ?? ""}
              className="input w-full px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Contact email</label>
            <input
              name="contactEmail"
              type="email"
              defaultValue={tenant.contactEmail ?? ""}
              className="input w-full px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Contact phone</label>
            <input
              name="contactPhone"
              defaultValue={tenant.contactPhone ?? ""}
              className="input w-full px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Address</label>
            <textarea
              name="address"
              rows={2}
              defaultValue={tenant.address ?? ""}
              className="input w-full px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Registration number</label>
            <input
              name="registrationNumber"
              defaultValue={tenant.registrationNumber ?? ""}
              className="input w-full px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Tax ID</label>
            <input
              name="taxId"
              defaultValue={tenant.taxId ?? ""}
              className="input w-full px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Website</label>
            <input
              name="website"
              type="url"
              defaultValue={tenant.website ?? ""}
              className="input w-full px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes</label>
            <textarea
              name="notes"
              rows={2}
              defaultValue={tenant.notes ?? ""}
              className="input w-full px-3 py-2 text-sm"
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Max drivers (limit)</label>
              <input
                name="maxDrivers"
                type="number"
                min={0}
                defaultValue={tenant.maxDrivers ?? ""}
                className="input w-full px-3 py-2 text-sm"
                placeholder="Unlimited"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Max storage (MB)</label>
              <input
                name="maxStorageMb"
                type="number"
                min={0}
                defaultValue={tenant.maxStorageMb ?? ""}
                className="input w-full px-3 py-2 text-sm"
                placeholder="Unlimited"
              />
            </div>
          </div>
          <div className="flex items-center gap-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="isActive"
                value="true"
                defaultChecked={tenant.isActive}
                className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Active</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="requireMfa"
                value="true"
                defaultChecked={tenant.requireMfa}
                className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Require admin MFA</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                name="requireMfaUsers"
                value="true"
                defaultChecked={tenant.requireMfaUsers}
                className="h-4 w-4 rounded border-zinc-300 text-teal-600 focus:ring-teal-500 dark:border-zinc-600 dark:bg-zinc-800"
              />
              <span className="text-sm text-zinc-700 dark:text-zinc-300">Require driver MFA</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={handleClose} className="btn-secondary px-4 py-2 text-sm">
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
            >
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
