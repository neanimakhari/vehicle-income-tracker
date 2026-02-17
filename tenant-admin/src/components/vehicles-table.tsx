"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Car, Filter, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TablePagination } from "@/components/table-pagination";

type Vehicle = {
  id: string;
  label: string;
  registrationNumber: string;
  isActive: boolean;
};

type SortKey = "label" | "registrationNumber" | "status";
type SortDir = "asc" | "desc";

type Props = {
  vehicles: Vehicle[];
  onToggle: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
};

function SortIcon({ current, dir }: { current: boolean; dir: SortDir | null }) {
  if (!current) return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  return dir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
}

export function VehiclesTable({ vehicles, onToggle, onDelete }: Props) {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("label");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const filtered = useMemo(() => {
    let list = vehicles.filter((v) => {
      if (statusFilter === "active" && !v.isActive) return false;
      if (statusFilter === "inactive" && v.isActive) return false;
      return true;
    });
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (v) =>
          v.label.toLowerCase().includes(q) ||
          (v.registrationNumber ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [vehicles, statusFilter, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "label":
          cmp = a.label.localeCompare(b.label);
          break;
        case "registrationNumber":
          cmp = (a.registrationNumber ?? "").localeCompare(b.registrationNumber ?? "");
          break;
        case "status":
          cmp = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
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

  const th = (key: SortKey, label: string) => (
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
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="search"
            placeholder="Search by name or registration..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageIndex(0);
            }}
            className="input pl-9 w-full"
          />
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-12 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 dark:bg-teal-900/30 mb-4">
            <Car className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">No vehicles yet</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
            Add your first vehicle to start tracking income and maintenance.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No vehicles match the current filter.</p>
        </div>
      ) : (
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black/5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    {th("label", "Vehicle")}
                    {th("registrationNumber", "Registration")}
                    {th("status", "Status")}
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                  {paginated.map((vehicle) => (
                    <tr key={vehicle.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-zinc-900 dark:text-zinc-50">
                        {vehicle.label}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {vehicle.registrationNumber}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            vehicle.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {vehicle.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/vehicles/${vehicle.id}`}
                            className="text-teal-600 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300"
                          >
                            View Details
                          </Link>
                          <form action={onToggle}>
                            <input type="hidden" name="id" value={vehicle.id} />
                            <input type="hidden" name="isActive" value={String(vehicle.isActive)} />
                            <button className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400" type="submit">
                              {vehicle.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                          <form action={onDelete}>
                            <input type="hidden" name="id" value={vehicle.id} />
                            <button className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" type="submit">
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
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
      )}
    </div>
  );
}
