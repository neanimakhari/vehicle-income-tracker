"use client";

import { useMemo, useState } from "react";
import { Filter, Download, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TablePagination } from "@/components/table-pagination";

type AuditEntry = {
  id: string;
  action: string;
  actorUserId: string | null;
  actorRole: string | null;
  targetType: string | null;
  targetId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

type SortKey = "date" | "action" | "actor" | "target";
type SortDir = "asc" | "desc";

function SortIcon({ current, dir }: { current: boolean; dir: SortDir | null }) {
  if (!current) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
  return dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
}

export function AuditLogTable({ initialLogs }: { initialLogs: AuditEntry[] }) {
  const [actionFilter, setActionFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const actions = useMemo(() => {
    const set = new Set(initialLogs.map((l) => l.action).filter(Boolean));
    return Array.from(set).sort();
  }, [initialLogs]);

  const filtered = useMemo(() => {
    let list = initialLogs;
    if (actionFilter) {
      list = list.filter((l) => l.action === actionFilter);
    }
    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter((l) => new Date((l as { created_at?: string }).created_at ?? l.createdAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      list = list.filter((l) => new Date((l as { created_at?: string }).created_at ?? l.createdAt) <= to);
    }
    return list;
  }, [initialLogs, actionFilter, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    const getCreated = (l: AuditEntry) => new Date((l as { created_at?: string }).created_at ?? l.createdAt).getTime();
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = getCreated(a) - getCreated(b);
          break;
        case "action":
          cmp = a.action.localeCompare(b.action);
          break;
        case "actor":
          cmp = (a.actorUserId ?? "").localeCompare(b.actorUserId ?? "");
          break;
        case "target":
          cmp = (a.targetType ?? "").localeCompare(b.targetType ?? "");
          break;
        default:
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const paginated = useMemo(() => {
    const start = pageIndex * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, pageIndex, pageSize]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "date" ? "desc" : "asc");
    }
    setPageIndex(0);
  };

  const th = (key: SortKey, label: string) => (
    <th
      className="py-3 px-4 text-left text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-700/50"
      onClick={() => toggleSort(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon current={sortKey === key} dir={sortKey === key ? sortDir : null} />
      </div>
    </th>
  );

  function exportCsv() {
    const rows = sorted.map((l) => {
      const created = (l as { created_at?: string }).created_at ?? l.createdAt;
      return [
        new Date(created).toISOString(),
        l.action,
        l.actorUserId ?? "",
        l.actorRole ?? "",
        l.targetType ?? "",
        l.targetId ?? "",
        JSON.stringify(l.metadata ?? {}),
      ];
    });
    const header = "Date,Action,Actor User ID,Actor Role,Target Type,Target ID,Metadata\n";
    const csv = header + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `audit-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 p-4 border-b border-zinc-200 dark:border-zinc-700">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <select
          className="input w-auto min-w-[160px] py-2 text-sm"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPageIndex(0);
          }}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="input w-auto py-2 text-sm"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPageIndex(0);
          }}
          placeholder="From"
        />
        <input
          type="date"
          className="input w-auto py-2 text-sm"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPageIndex(0);
          }}
          placeholder="To"
        />
        <button
          type="button"
          onClick={exportCsv}
          className="ml-auto btn btn-secondary flex items-center gap-2 text-sm"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-800/50">
            <tr>
              {th("date", "Date")}
              {th("action", "Action")}
              {th("actor", "Actor")}
              {th("target", "Target")}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                  No audit entries match the filters.
                </td>
              </tr>
            ) : (
              paginated.map((log) => {
                const created = (log as { created_at?: string }).created_at ?? log.createdAt;
                return (
                  <tr key={log.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/30">
                    <td className="py-3 px-4 text-sm text-zinc-900 dark:text-zinc-100 whitespace-nowrap">
                      {new Date(created).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm font-medium text-zinc-900 dark:text-zinc-100">{log.action}</td>
                    <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {log.actorUserId ?? "—"} {log.actorRole ? `(${log.actorRole})` : ""}
                    </td>
                    <td className="py-3 px-4 text-sm text-zinc-600 dark:text-zinc-400">
                      {log.targetType ?? "—"} {log.targetId ? `#${log.targetId}` : ""}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {sorted.length > 0 && (
        <TablePagination
          totalItems={sorted.length}
          pageSize={pageSize}
          pageIndex={pageIndex}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPageIndex(0);
          }}
          onPageChange={setPageIndex}
        />
      )}
    </div>
  );
}
