"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Receipt, X } from "lucide-react";

type Props = {
  createExpense: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
};

export function CreateExpenseModal({ createExpense }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) previousActiveRef.current = document.activeElement as HTMLElement | null;
  }, [open]);

  const handleClose = () => {
    setReceiptBase64(null);
    previousActiveRef.current?.focus();
    setOpen(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setReceiptBase64(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setReceiptBase64(result.includes(",") ? result.split(",")[1]! : result);
    };
    reader.readAsDataURL(file);
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
    const result = await createExpense(formData);
    if (result?.success) {
      handleClose();
      form.reset();
      setReceiptBase64(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.push("/expenses?success=" + encodeURIComponent("Expense logged"));
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
        <Receipt className="h-4 w-4" />
        Add Expense
      </button>

      {open && (
        <div
          ref={dialogRef}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-expense-title"
        >
          <div className="absolute inset-0 bg-zinc-900/60 dark:bg-zinc-950/70" onClick={handleClose} aria-hidden />
          <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                  <Receipt className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <h2 id="create-expense-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Log Expense
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
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
                <input name="description" required className="input w-full px-3 py-2 text-sm" placeholder="e.g. Fuel, repairs" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Amount (R)</label>
                <input name="amount" type="number" step="0.01" required className="input w-full px-3 py-2 text-sm" placeholder="0.00" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Receipt image (optional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFileChange}
                  className="input w-full px-3 py-2 text-sm file:mr-2 file:rounded file:border-0 file:bg-teal-50 file:px-3 file:py-1 file:text-teal-700 dark:file:bg-teal-900/30 dark:file:text-teal-300"
                />
                {receiptBase64 && (
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Image attached (base64). It will be sent with the form.</p>
                )}
                {receiptBase64 && <input type="hidden" name="receiptImage" value={receiptBase64} />}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleClose} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1">
                  Log Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

