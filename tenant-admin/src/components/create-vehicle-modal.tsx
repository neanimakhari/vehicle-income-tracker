"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Car, X } from "lucide-react";

type CreateVehicleResult = { success?: boolean; error?: string } | void;

type Props = {
  createVehicle: (formData: FormData) => Promise<CreateVehicleResult>;
};

export function CreateVehicleModal({ createVehicle }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) previousActiveRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  const handleClose = () => {
    if (isPending) return;
    previousActiveRef.current?.focus();
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) handleClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [open, isPending]);

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
    const label = String(formData.get("label") ?? "").trim();
    const registrationNumber = String(formData.get("registrationNumber") ?? "").trim();
    if (!label || !registrationNumber) {
      setError("Label and registration number are required.");
      return;
    }
    startTransition(async () => {
      const result = await createVehicle(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      if (result?.success) {
        previousActiveRef.current?.focus();
        setOpen(false);
        form.reset();
        router.push("/vehicles?success=" + encodeURIComponent("Vehicle added"));
        router.refresh();
      }
    });
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
        <Car className="h-4 w-4" />
        Add Vehicle
      </button>

      {open && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-vehicle-title"
        >
          <div
            className="absolute inset-0 bg-zinc-900/60 dark:bg-zinc-950/70"
            onClick={handleClose}
            aria-hidden
          />
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                  <Car className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <h2 id="create-vehicle-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Add Vehicle
                </h2>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
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
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Label</label>
                <input
                  className="input px-3 py-2 text-sm w-full"
                  placeholder="e.g. Truck A, Van 1"
                  name="label"
                  required
                  disabled={isPending}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Registration number</label>
                <input
                  className="input px-3 py-2 text-sm w-full"
                  placeholder="e.g. ABC 123 GP"
                  name="registrationNumber"
                  required
                  disabled={isPending}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="btn btn-secondary flex-1"
                  disabled={isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                  disabled={isPending}
                >
                  {isPending ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Adding…
                    </>
                  ) : (
                    <>
                      <Car className="h-4 w-4" />
                      Add Vehicle
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
