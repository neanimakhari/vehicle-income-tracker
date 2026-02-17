"use client";

import { useState, useMemo } from "react";
import { Bell, Building2, AlertCircle, Info, AlertTriangle } from "lucide-react";
import Link from "next/link";

const PAGE_SIZE = 10;
const ALERT_TYPES = [
  { value: "all", label: "All types" },
  { value: "new_tenant", label: "New tenant" },
  { value: "tenant_updated", label: "Tenant updated" },
  { value: "failed_login_spike", label: "Failed login spike" },
  { value: "tenant_near_limit", label: "Tenant near limit" },
] as const;

type AlertItem = {
  type: string;
  at: string;
  message: string;
  metadata?: Record<string, unknown>;
};

export function AlertsClient({ alerts }: { alerts: AlertItem[] }) {
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (typeFilter === "all") return alerts;
    return alerts.filter((a) => a.type === typeFilter);
  }, [alerts, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const typeLabel = (type: string) => type.replace(/_/g, " ");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
          Platform Alerts
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Recent tenant creation, updates, and platform-level events. Optional email digest can be enabled later.
        </p>
      </div>

      <div className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-900/30">
              <Bell className="h-6 w-6 text-amber-600 dark:text-amber-400" aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent alerts (last 7 days)</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">New tenants, tenant updates</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="alerts-type-filter" className="sr-only">Filter by type</label>
            <select
              id="alerts-type-filter"
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
              aria-label="Filter alerts by type"
            >
              {ALERT_TYPES.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No alerts match the current filter.</p>
        ) : (
          <>
            <ul className="space-y-3" role="list">
              {pageItems.map((alert, i) => (
                <li
                  key={`${alert.at}-${start + i}`}
                  className="flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 p-4"
                >
                  {alert.type === "new_tenant" ? (
                    <Building2 className="h-5 w-5 shrink-0 text-teal-600 dark:text-teal-400" aria-hidden />
                  ) : alert.type === "failed_login_spike" || alert.type === "tenant_near_limit" ? (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
                  ) : (
                    <Info className="h-5 w-5 shrink-0 text-zinc-500 dark:text-zinc-400" aria-hidden />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">{alert.message}</p>
                    <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {new Date(alert.at).toLocaleString()} · {typeLabel(alert.type)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-zinc-200 dark:border-zinc-800 pt-4">
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
          <AlertCircle className="h-3.5 w-3.5" aria-hidden />
          Failed-login and limit alerts can be added when audit logging for those events is enabled. Email digest: coming later.
        </p>
      </div>

      <Link href="/tenants" className="inline-flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:underline">
        View all tenants →
      </Link>
    </div>
  );
}

