"use client";

import { useState, useMemo } from "react";
import { Wrench, CheckCircle2, AlertTriangle, Calendar, Gauge, Car, XCircle, Clock, Filter, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TablePagination } from "@/components/table-pagination";

export type MaintenanceTask = {
  id: string;
  vehicleLabel: string;
  registrationNumber?: string;
  maintenanceType?: string;
  dueKm?: number;
  dueDate?: string;
  lastServiceKm?: number;
  lastServiceDate?: string;
  serviceIntervalKm?: number;
  serviceIntervalDays?: number;
  cost?: number;
  notes?: string;
  isCompleted: boolean;
  completedAt?: string;
  completedKm?: number;
  currentKm?: number;
  lastIncomeDate?: string;
  kmRemaining?: number;
  daysRemaining?: number;
  kmSinceLastService?: number;
  daysSinceLastService?: number;
  status: "ok" | "due_soon" | "overdue";
};

const MAINTENANCE_TYPE_LABELS: Record<string, string> = {
  oil_change: "Oil Change",
  service: "Service",
  tire_rotation: "Tire Rotation",
  brake_service: "Brake Service",
  filter_replacement: "Filter Replacement",
  battery_check: "Battery Check",
  inspection: "Inspection",
  other: "Other",
};

type SortKey = "vehicleLabel" | "dueDate" | "status" | "dueKm";
type SortDir = "asc" | "desc";

function SortIcon({ current, dir }: { current: boolean; dir: SortDir | null }) {
  if (!current) return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  return dir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
}

type Props = {
  tasks: MaintenanceTask[];
  updateTask: (formData: FormData) => Promise<void>;
  deleteTask: (formData: FormData) => Promise<void>;
};

export function MaintenanceTableClient({ tasks, updateTask, deleteTask }: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "overdue" | "due_soon" | "pending">("all");
  const [sortKey, setSortKey] = useState<SortKey>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);

  const filtered = useMemo(() => {
    let list = tasks;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (t) =>
          t.vehicleLabel.toLowerCase().includes(q) ||
          (t.registrationNumber ?? "").toLowerCase().includes(q) ||
          (t.maintenanceType ?? "").toLowerCase().includes(q) ||
          (t.notes ?? "").toLowerCase().includes(q)
      );
    }
    if (statusFilter === "completed") list = list.filter((t) => t.isCompleted);
    else if (statusFilter === "overdue") list = list.filter((t) => !t.isCompleted && t.status === "overdue");
    else if (statusFilter === "due_soon") list = list.filter((t) => !t.isCompleted && t.status === "due_soon");
    else if (statusFilter === "pending") list = list.filter((t) => !t.isCompleted);
    return list;
  }, [tasks, search, statusFilter]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "vehicleLabel":
          cmp = a.vehicleLabel.localeCompare(b.vehicleLabel);
          break;
        case "dueDate":
          cmp = (new Date(a.dueDate ?? 0).getTime()) - (new Date(b.dueDate ?? 0).getTime());
          break;
        case "dueKm":
          cmp = (a.dueKm ?? 0) - (b.dueKm ?? 0);
          break;
        case "status":
          const order = { overdue: 0, due_soon: 1, ok: 2 };
          cmp = (order[a.status as keyof typeof order] ?? 3) - (order[b.status as keyof typeof order] ?? 3);
          if (a.isCompleted !== b.isCompleted) cmp = a.isCompleted ? 1 : -1;
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

  return (
    <div className="mt-8 flow-root">
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <Filter className="h-4 w-4" />
          Filters
        </div>
        <select
          className="input w-auto min-w-[140px] py-2 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as typeof statusFilter);
            setPageIndex(0);
          }}
        >
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="overdue">Overdue</option>
          <option value="due_soon">Due soon</option>
          <option value="completed">Completed</option>
        </select>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="search"
            placeholder="Search by vehicle, type, notes..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageIndex(0);
            }}
            className="input pl-9 w-full"
          />
        </div>
      </div>

      <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
          <div className="overflow-hidden shadow ring-1 ring-black/5 sm:rounded-lg">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-gradient-to-r from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-800 border-b border-zinc-200 dark:border-zinc-700">
                <tr>
                  {th("vehicleLabel", (
                    <>
                      <Car className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      <span>Vehicle / Type</span>
                    </>
                  ))}
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    <div className="flex items-center gap-2">
                      <Gauge className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      <span>Current / Due KM</span>
                    </div>
                  </th>
                  {th("dueDate", (
                    <>
                      <Calendar className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      <span>Due Date</span>
                    </>
                  ))}
                  <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-teal-600 dark:text-teal-400" />
                      <span>Last Service</span>
                    </div>
                  </th>
                  {th("status", "Status")}
                  <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                    <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                {tasks.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <Wrench className="h-8 w-8 text-zinc-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">No maintenance tasks found</p>
                          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Create your first maintenance task above</p>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                      No tasks match your filters.
                    </td>
                  </tr>
                ) : (
                  paginated.map((task) => (
                    <tr key={task.id} className={task.isCompleted ? "opacity-60" : ""}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-50">{task.vehicleLabel}</div>
                        {task.registrationNumber && (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400">{task.registrationNumber}</div>
                        )}
                        <div className="text-xs font-medium text-teal-600 dark:text-teal-400 mt-1">
                          {MAINTENANCE_TYPE_LABELS[task.maintenanceType || "other"] || "Other"}
                        </div>
                        {task.notes && (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 truncate max-w-xs">{task.notes}</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                        {task.currentKm != null && (
                          <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                            Current: <span className="font-semibold text-zinc-900 dark:text-zinc-50">{task.currentKm.toLocaleString()} km</span>
                          </div>
                        )}
                        {task.dueKm ? (
                          <div>
                            <div className="font-medium">Due: {task.dueKm.toLocaleString()} km</div>
                            {task.kmRemaining != null && (
                              <div
                                className={`text-xs font-medium ${
                                  task.kmRemaining <= 0
                                    ? "text-red-600 dark:text-red-400"
                                    : task.kmRemaining <= 500
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {task.kmRemaining > 0 ? `${task.kmRemaining.toLocaleString()} km remaining` : "Overdue"}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                        {task.dueDate ? (
                          <div>
                            <div className="font-medium">{new Date(task.dueDate).toLocaleDateString()}</div>
                            {task.daysRemaining != null && (
                              <div
                                className={`text-xs font-medium ${
                                  task.daysRemaining <= 0
                                    ? "text-red-600 dark:text-red-400"
                                    : task.daysRemaining <= 7
                                    ? "text-amber-600 dark:text-amber-400"
                                    : "text-emerald-600 dark:text-emerald-400"
                                }`}
                              >
                                {task.daysRemaining > 0 ? `${task.daysRemaining} days remaining` : "Overdue"}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500">—</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-700 dark:text-zinc-300">
                        {task.isCompleted && task.completedAt ? (
                          <div>
                            <div className="font-medium text-emerald-600 dark:text-emerald-400">
                              {new Date(task.completedAt).toLocaleDateString()}
                            </div>
                            {task.completedKm && (
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">@ {task.completedKm.toLocaleString()} km</div>
                            )}
                          </div>
                        ) : task.lastServiceDate ? (
                          <div>
                            <div className="font-medium">{new Date(task.lastServiceDate).toLocaleDateString()}</div>
                            {task.lastServiceKm && (
                              <div className="text-xs text-zinc-500 dark:text-zinc-400">@ {task.lastServiceKm.toLocaleString()} km</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-zinc-400 dark:text-zinc-500">Never</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold leading-5 ${
                            task.isCompleted
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : task.status === "overdue"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : task.status === "due_soon"
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {task.isCompleted ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Completed
                            </>
                          ) : task.status === "overdue" ? (
                            <>
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Overdue
                            </>
                          ) : task.status === "due_soon" ? (
                            <>
                              <AlertTriangle className="h-3.5 w-3.5" />
                              Due Soon
                            </>
                          ) : (
                            "Pending"
                          )}
                        </span>
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <form action={updateTask}>
                          <input type="hidden" name="id" value={task.id} />
                          <input type="hidden" name="isCompleted" value={String(task.isCompleted)} />
                          {!task.isCompleted && task.currentKm != null && (
                            <input type="hidden" name="completedKm" value={task.currentKm} />
                          )}
                          <button
                            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
                              task.isCompleted
                                ? "text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
                                : "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-900/20"
                            }`}
                            type="submit"
                          >
                            {task.isCompleted ? (
                              <>
                                <XCircle className="h-4 w-4" />
                                <span className="hidden sm:inline">Reopen</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-4 w-4" />
                                <span className="hidden sm:inline">Complete</span>
                              </>
                            )}
                          </button>
                        </form>
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

