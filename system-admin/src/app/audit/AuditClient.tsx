"use client";

import { useState, useEffect, useCallback } from "react";

export type AuditLog = {
  id: string;
  action: string;
  actorUserId: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type FetchAuditParams = {
  action?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: string;
  order?: "ASC" | "DESC";
  page?: number;
  limit?: number;
};

const LIMIT = 20;

type AuditClientProps = {
  fetchAudit: (params: FetchAuditParams) => Promise<{ items: AuditLog[]; total: number }>;
};

export function AuditClient({ fetchAudit: fetchAuditAction }: AuditClientProps) {
  const [items, setItems] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<"action" | "createdAt">("createdAt");
  const [order, setOrder] = useState<"ASC" | "DESC">("DESC");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchAuditAction({
        page,
        limit: LIMIT,
        sort: sort === "createdAt" ? "created_at" : "action",
        order,
        action: actionFilter || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [fetchAuditAction, page, sort, order, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const currentPage = Math.min(page, totalPages);

  const toggleSort = (col: "action" | "createdAt") => {
    if (sort === col) setOrder((o) => (o === "DESC" ? "ASC" : "DESC"));
    else {
      setSort(col);
      setOrder("DESC");
    }
    setPage(1);
  };

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Audit Logs</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Review recent platform actions and security events.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <div>
          <label htmlFor="audit-action" className="sr-only">Action</label>
          <select
            id="audit-action"
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            aria-label="Filter by action"
          >
            <option value="">All actions</option>
            <option value="tenant.create">tenant.create</option>
            <option value="tenant.update">tenant.update</option>
            <option value="tenant.admin.create">tenant.admin.create</option>
            <option value="tenant.admin.update">tenant.admin.update</option>
            <option value="auth.login">auth.login</option>
            <option value="auth.login_failed">auth.login_failed</option>
          </select>
        </div>
        <div>
          <label htmlFor="audit-date-from" className="sr-only">Date from</label>
          <input
            id="audit-date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => {
              setDateFrom(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            aria-label="From date"
          />
        </div>
        <div>
          <label htmlFor="audit-date-to" className="sr-only">Date to</label>
          <input
            id="audit-date-to"
            type="date"
            value={dateTo}
            onChange={(e) => {
              setDateTo(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            aria-label="To date"
          />
        </div>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black/5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      <button
                        type="button"
                        onClick={() => toggleSort("action")}
                        className="inline-flex font-semibold hover:underline"
                        aria-label={sort === "action" ? `Sort by action ${order}` : "Sort by action"}
                      >
                        Action {sort === "action" && (order === "DESC" ? "↓" : "↑")}
                      </button>
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      <button
                        type="button"
                        onClick={() => toggleSort("createdAt")}
                        className="inline-flex font-semibold hover:underline"
                        aria-label={sort === "createdAt" ? `Sort by date ${order}` : "Sort by date"}
                      >
                        Timestamp {sort === "createdAt" && (order === "DESC" ? "↓" : "↑")}
                      </button>
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Scope
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                  {loading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        Loading…
                      </td>
                    </tr>
                  ) : items.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No logs match the current filters.
                      </td>
                    </tr>
                  ) : (
                    items.map((log) => (
                      <tr key={log.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                          {log.action}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                          {new Date(log.createdAt).toLocaleString()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                          Platform
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {total > LIMIT && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Showing {(currentPage - 1) * LIMIT + 1}–{Math.min(currentPage * LIMIT, total)} of {total}
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
    </div>
  );
}

