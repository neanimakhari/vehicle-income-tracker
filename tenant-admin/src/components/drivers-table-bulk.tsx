"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Mail,
  CheckCircle2,
  XCircle,
  Eye,
  Power,
  RotateCcw,
  Send,
  Shield,
  ShieldAlert,
  Download,
  Filter,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { DriverAvatar } from "./driver-avatar";
import { TablePagination } from "@/components/table-pagination";

type Driver = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  mfaEnabled?: boolean;
};

type SortKey = "name" | "email" | "status" | "mfa";
type SortDir = "asc" | "desc";

type Props = {
  drivers: Driver[];
  requiresMfa: boolean;
  onToggle: (formData: FormData) => Promise<void>;
  onResetMfa: (formData: FormData) => Promise<void>;
  onRemindMfa: (formData: FormData) => Promise<void>;
  onBulkToggle: (formData: FormData) => Promise<void>;
  onBulkRemindMfa: (formData: FormData) => Promise<void>;
};

function SortIcon({ current, dir }: { current: boolean; dir: SortDir | null }) {
  if (!current) return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  return dir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
}

export function DriversTableBulk({
  drivers,
  requiresMfa,
  onToggle,
  onResetMfa,
  onRemindMfa,
  onBulkToggle,
  onBulkRemindMfa,
}: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [mfaFilter, setMfaFilter] = useState<"all" | "enabled" | "missing">("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const filtered = useMemo(() => {
    let list = drivers.filter((d) => {
      if (statusFilter === "active" && !d.isActive) return false;
      if (statusFilter === "inactive" && d.isActive) return false;
      if (mfaFilter === "enabled" && !d.mfaEnabled) return false;
      if (mfaFilter === "missing" && (d.mfaEnabled || !requiresMfa)) return false;
      return true;
    });
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (d) =>
          d.firstName.toLowerCase().includes(q) ||
          d.lastName.toLowerCase().includes(q) ||
          d.email.toLowerCase().includes(q)
      );
    }
    return list;
  }, [drivers, statusFilter, mfaFilter, requiresMfa, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "name":
          cmp = `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`);
          break;
        case "email":
          cmp = a.email.localeCompare(b.email);
          break;
        case "status":
          cmp = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
          break;
        case "mfa":
          cmp = (a.mfaEnabled ? 1 : 0) - (b.mfaEnabled ? 1 : 0);
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
      setSortDir("asc");
    }
    setPageIndex(0);
  };

  const th = (key: SortKey, label: React.ReactNode) => (
    <th
      scope="col"
      className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800"
      onClick={() => toggleSort(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon current={sortKey === key} dir={sortKey === key ? sortDir : null} />
      </div>
    </th>
  );

  const toggleAll = () => {
    if (selected.size === paginated.length) {
      const next = new Set(selected);
      paginated.forEach((d) => next.delete(d.id));
      setSelected(next);
    } else {
      const next = new Set(selected);
      paginated.forEach((d) => next.add(d.id));
      setSelected(next);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const selectedList = Array.from(selected);

  function exportCsv() {
    const rows = filtered.map((d) => [
      d.firstName,
      d.lastName,
      d.email,
      d.isActive ? "Active" : "Inactive",
      d.mfaEnabled ? "Enabled" : "Not set",
    ]);
    const header = "First Name,Last Name,Email,Status,MFA\n";
    const csv = header + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `drivers-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (drivers.length === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-12 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 dark:bg-teal-900/30 mb-4">
          <Users className="h-8 w-8 text-teal-600 dark:text-teal-400" />
        </div>
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">No drivers yet</h3>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
          Add your first driver so they can log in to the mobile app and record income.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 flow-root">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <select
          className="input w-auto min-w-[120px] py-2 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "all" | "active" | "inactive");
            setPageIndex(0);
          }}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          className="input w-auto min-w-[140px] py-2 text-sm"
          value={mfaFilter}
          onChange={(e) => {
            setMfaFilter(e.target.value as "all" | "enabled" | "missing");
            setPageIndex(0);
          }}
        >
          <option value="all">All MFA</option>
          <option value="enabled">MFA enabled</option>
          <option value="missing">MFA missing</option>
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="search"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageIndex(0);
            }}
            className="input pl-9 w-full"
          />
        </div>
        <button type="button" onClick={exportCsv} className="ml-auto btn btn-secondary flex items-center gap-2 text-sm">
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {selectedList.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 dark:border-teal-800 dark:bg-teal-900/20">
          <span className="text-sm font-medium text-teal-800 dark:text-teal-200">
            {selectedList.length} selected
          </span>
          <form action={onBulkToggle} className="inline">
            <input type="hidden" name="ids" value={selectedList.join(",")} />
            <input type="hidden" name="makeActive" value="true" />
            <button type="submit" className="btn btn-secondary text-sm py-1.5">
              Activate
            </button>
          </form>
          <form action={onBulkToggle} className="inline">
            <input type="hidden" name="ids" value={selectedList.join(",")} />
            <input type="hidden" name="makeActive" value="false" />
            <button type="submit" className="btn btn-secondary text-sm py-1.5">
              Deactivate
            </button>
          </form>
          <form action={onBulkRemindMfa} className="inline">
            <input type="hidden" name="ids" value={selectedList.join(",")} />
            <button type="submit" className="btn btn-secondary text-sm py-1.5 flex items-center gap-1">
              <Send className="h-4 w-4" />
              Send MFA reminder
            </button>
          </form>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Clear selection
          </button>
        </div>
      )}

      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <div className="overflow-hidden shadow ring-1 ring-black/5 sm:rounded-lg">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left">
                      <input
                        type="checkbox"
                        checked={paginated.length > 0 && paginated.every((d) => selected.has(d.id))}
                        onChange={toggleAll}
                        className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
                      />
                    </th>
                    {th("name", (
                      <>
                        <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        <span>Name</span>
                      </>
                    ))}
                    {th("email", (
                      <>
                        <Mail className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        <span>Email</span>
                      </>
                    ))}
                    {th("status", (
                      <>
                        <Power className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        <span>Status</span>
                      </>
                    ))}
                    {th("mfa", (
                      <>
                        <Shield className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                        <span>MFA</span>
                      </>
                    ))}
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6 text-right text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Actions
                    </th>
                  </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No drivers match the filters.
                    </td>
                  </tr>
                ) : (
                  paginated.map((driver) => (
                    <tr key={driver.id}>
                      <td className="py-4 pl-4 pr-3">
                        <input
                          type="checkbox"
                          checked={selected.has(driver.id)}
                          onChange={() => toggleOne(driver.id)}
                          className="rounded border-zinc-300 text-teal-600 focus:ring-teal-500"
                        />
                      </td>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                        <div className="flex items-center gap-3">
                          <DriverAvatar
                            driverId={driver.id}
                            firstName={driver.firstName}
                            lastName={driver.lastName}
                            size={40}
                          />
                          <div>
                            <div className="font-semibold text-zinc-900 dark:text-zinc-50">
                              {driver.firstName} {driver.lastName}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
                          <span>{driver.email}</span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold leading-5 ${
                            driver.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {driver.isActive ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3.5 w-3.5" />
                              Inactive
                            </>
                          )}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold leading-5 ${
                            driver.mfaEnabled
                              ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                              : requiresMfa
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {driver.mfaEnabled ? (
                            <>
                              <Shield className="h-3.5 w-3.5" />
                              Enabled
                            </>
                          ) : requiresMfa ? (
                            <>
                              <ShieldAlert className="h-3.5 w-3.5" />
                              Required
                            </>
                          ) : (
                            "Not set"
                          )}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/drivers/${driver.id}`}
                            className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-teal-600 hover:bg-teal-50 hover:text-teal-700 dark:text-teal-400 dark:hover:bg-teal-900/20 transition-colors"
                            title="View Profile"
                          >
                            <Eye className="h-4 w-4" />
                            <span className="hidden sm:inline">Profile</span>
                          </Link>
                          <form action={onToggle} className="inline">
                            <input type="hidden" name="id" value={driver.id} />
                            <input type="hidden" name="isActive" value={String(driver.isActive)} />
                            <button
                              type="submit"
                              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                                driver.isActive
                                  ? "text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
                                  : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                              }`}
                              title={driver.isActive ? "Deactivate" : "Activate"}
                            >
                              <Power className="h-4 w-4" />
                              <span className="hidden sm:inline">{driver.isActive ? "Deactivate" : "Activate"}</span>
                            </button>
                          </form>
                          <form action={onResetMfa} className="inline">
                            <input type="hidden" name="id" value={driver.id} />
                            <button
                              type="submit"
                              className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-900/20 transition-colors"
                              title="Reset MFA"
                            >
                              <RotateCcw className="h-4 w-4" />
                              <span className="hidden sm:inline">Reset MFA</span>
                            </button>
                          </form>
                          {!driver.mfaEnabled && (
                            <form action={onRemindMfa} className="inline">
                              <input type="hidden" name="id" value={driver.id} />
                              <button
                                type="submit"
                                className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 transition-colors"
                                title="Send MFA Reminder"
                              >
                                <Send className="h-4 w-4" />
                                <span className="hidden sm:inline">Remind</span>
                              </button>
                            </form>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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
        </div>
      </div>
    </div>
  );
}
