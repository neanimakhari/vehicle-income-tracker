"use client";

import { useRef, useEffect } from "react";
import { X, Download, Users, Car, FileText, DollarSign } from "lucide-react";

type UsageItem = {
  id: string;
  name: string;
  slug: string;
  drivers: number;
  incomes: number;
  vehicles: number;
  totalIncome: number;
};

type TenantBillingModalProps = {
  tenantName: string;
  tenantSlug: string;
  usage: UsageItem | null;
  onClose: () => void;
};

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function TenantBillingModal({
  tenantName,
  tenantSlug,
  usage,
  onClose,
}: TenantBillingModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);
  const titleId = "tenant-billing-modal-title";

  useEffect(() => {
    if (usage) previousActiveRef.current = document.activeElement as HTMLElement | null;
  }, [usage?.id]);

  const handleClose = () => {
    previousActiveRef.current?.focus();
    onClose();
  };

  useEffect(() => {
    if (!usage || !dialogRef.current) return;
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
  }, [usage?.id]);

  const exportOneTenantCsv = () => {
    const headers = [
      "Tenant",
      "Slug",
      "Drivers",
      "Vehicles",
      "Income records",
      "Total income",
    ];
    const row = [
      escapeCsv(tenantName),
      escapeCsv(tenantSlug),
      String(usage?.drivers ?? 0),
      String(usage?.vehicles ?? 0),
      String(usage?.incomes ?? 0),
      String(usage?.totalIncome ?? 0),
    ].join(",");
    const csv = [headers.join(","), row].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tenant-usage-${tenantSlug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={dialogRef}>
      <div
        className="absolute inset-0 bg-zinc-900/60 dark:bg-zinc-950/70"
        onClick={handleClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Usage &amp; Billing
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">{tenantName}</span>
          <span className="ml-1">({tenantSlug})</span>
        </p>
        {usage ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Drivers</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{usage.drivers}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <Car className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Vehicles</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{usage.vehicles}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
              <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              <div>
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Income records</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{usage.incomes}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-900/30">
              <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">Total income (logged)</p>
                <p className="text-lg font-semibold text-emerald-900 dark:text-emerald-100">
                  {Number(usage.totalIncome).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">No usage data for this tenant.</p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Close
          </button>
          {usage && (
            <button
              type="button"
              onClick={exportOneTenantCsv}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
            >
              <Download className="h-4 w-4" />
              Export CSV (billing)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
