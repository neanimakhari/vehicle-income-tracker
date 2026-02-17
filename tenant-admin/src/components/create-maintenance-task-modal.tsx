"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Wrench, X, Plus } from "lucide-react";

type Vehicle = { id: string; label: string; registrationNumber: string };

type Props = {
  vehicles: Vehicle[];
  createTask: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
};

export function CreateMaintenanceTaskModal({ vehicles, createTask }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) previousActiveRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  const handleClose = () => {
    previousActiveRef.current?.focus();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open]);

  useEffect(() => {
    if (!open || !dialogRef.current) return;
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
  }, [open]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await createTask(formData);
    if (result?.success) {
      handleClose();
      form.reset();
      router.push("/maintenance?success=" + encodeURIComponent("Task created"));
      router.refresh();
    } else if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setError(null);
        }}
        className="btn btn-primary flex items-center gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Task
      </button>

      {open && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-maintenance-task-title"
        >
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-zinc-950/70" onClick={handleClose} aria-hidden />
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                  <Wrench className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <h2 id="create-maintenance-task-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Create Maintenance Task
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                aria-label="Close modal"
              >
                <X className="h-5 w-5" aria-hidden />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200">
                  {error}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Vehicle</label>
                  <select name="vehicleLabel" required className="input w-full px-3 py-2 text-sm">
                    <option value="">Select Vehicle</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.label}>
                        {v.label} {v.registrationNumber ? `(${v.registrationNumber})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Type</label>
                  <select name="maintenanceType" defaultValue="other" className="input w-full px-3 py-2 text-sm">
                    <option value="oil_change">Oil Change</option>
                    <option value="service">Service</option>
                    <option value="tire_rotation">Tire Rotation</option>
                    <option value="brake_service">Brake Service</option>
                    <option value="filter_replacement">Filter Replacement</option>
                    <option value="battery_check">Battery Check</option>
                    <option value="inspection">Inspection</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Due KM (optional)</label>
                  <input name="dueKm" type="number" className="input w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Due Date (optional)</label>
                  <input name="dueDate" type="date" className="input w-full px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Last Service KM (optional)</label>
                  <input name="lastServiceKm" type="number" className="input w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Last Service Date (optional)</label>
                  <input name="lastServiceDate" type="date" className="input w-full px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Service Interval KM (optional)</label>
                  <input name="serviceIntervalKm" type="number" className="input w-full px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Service Interval Days (optional)</label>
                  <input name="serviceIntervalDays" type="number" className="input w-full px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cost (R) (optional)</label>
                <input name="cost" type="number" step="0.01" className="input w-full px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Notes (optional)</label>
                <input name="notes" className="input w-full px-3 py-2 text-sm" placeholder="Notes" />
              </div>
              <input type="hidden" name="registrationNumber" value="" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1 flex items-center justify-center gap-2">
                  <Plus className="h-4 w-4" />
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

