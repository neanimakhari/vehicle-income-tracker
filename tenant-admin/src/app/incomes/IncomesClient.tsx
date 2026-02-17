"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CreateIncomeModal } from "@/components/create-income-modal";
import { IncomeEditButton } from "./income-edit-form";
import { TablePagination } from "@/components/table-pagination";
import { FullscreenImageViewer, toDataUrl } from "@/components/fullscreen-image-viewer";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react";

type Income = {
  id: string;
  vehicle: string;
  driverName: string;
  driverId?: string;
  income: number;
  startingKm?: number;
  endKm?: number;
  petrolPoured?: number;
  petrolLitres?: number;
  expenseDetail?: string;
  expensePrice?: number;
  expenseImage?: string;
  petrolSlip?: string;
  loggedOn: string;
  approvalStatus?: string;
  approvedAt?: string;
  approvedBy?: string;
};
type Driver = { id: string; firstName: string; lastName: string; email: string; isActive: boolean };
type Vehicle = { id: string; label: string; registrationNumber: string };

type SortKey = "loggedOn" | "vehicle" | "driverName" | "income" | "startingKm" | "endKm";
type SortDir = "asc" | "desc";

type Props = {
  incomes: Income[];
  drivers: Driver[];
  vehicles: Vehicle[];
  createIncome: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  updateIncome: (formData: FormData) => Promise<unknown>;
  deleteIncome: (formData: FormData) => Promise<unknown>;
  approveIncome: (id: string) => Promise<{ success: boolean; error?: string }>;
  rejectIncome: (id: string) => Promise<{ success: boolean; error?: string }>;
};

function SortIcon({ current, dir }: { current: boolean; dir: SortDir | null }) {
  if (!current) return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  return dir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
}

function safeNum(v: unknown): number {
  if (v == null) return 0;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isNaN(n) ? 0 : n;
}

export function IncomesClient({
  incomes = [],
  drivers = [],
  vehicles = [],
  createIncome,
  updateIncome,
  deleteIncome,
  approveIncome,
  rejectIncome,
}: Props) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending">("all");
  const [sortKey, setSortKey] = useState<SortKey>("loggedOn");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [viewerImage, setViewerImage] = useState<{ dataUrl: string; title: string } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const router = useRouter();

  const safeIncomes = Array.isArray(incomes) ? incomes : [];
  const statusFiltered = useMemo(() => {
    if (statusFilter !== "pending") return safeIncomes;
    return safeIncomes.filter((i) => (i.approvalStatus ?? "auto") === "pending");
  }, [safeIncomes, statusFilter]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return statusFiltered;
    return statusFiltered.filter(
      (i) =>
        String(i.vehicle ?? "").toLowerCase().includes(q) ||
        String(i.driverName ?? "").toLowerCase().includes(q) ||
        new Date(i.loggedOn).toLocaleDateString().toLowerCase().includes(q) ||
        String(i.income ?? "").toLowerCase().includes(q) ||
        String(i.startingKm ?? "").includes(q) ||
        String(i.endKm ?? "").includes(q)
    );
  }, [statusFiltered, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "loggedOn":
          cmp = new Date(a.loggedOn).getTime() - new Date(b.loggedOn).getTime();
          break;
        case "vehicle":
          cmp = a.vehicle.localeCompare(b.vehicle);
          break;
        case "driverName":
          cmp = a.driverName.localeCompare(b.driverName);
          break;
        case "income":
          cmp = safeNum(a.income) - safeNum(b.income);
          break;
        case "startingKm":
          cmp = safeNum(a.startingKm) - safeNum(b.startingKm);
          break;
        case "endKm":
          cmp = safeNum(a.endKm) - safeNum(b.endKm);
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
      setSortDir(key === "loggedOn" ? "desc" : "asc");
    }
    setPageIndex(0);
  };

  const th = (key: SortKey, label: string, extraClass = "") => (
    <th
      scope="col"
      className={`py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800 ${key === "loggedOn" ? "pl-4 pr-3" : "px-3"} ${extraClass}`}
      onClick={() => toggleSort(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon current={sortKey === key} dir={sortKey === key ? sortDir : null} />
      </div>
    </th>
  );

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Vehicle Incomes</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">A list of all vehicle income records.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <CreateIncomeModal vehicles={vehicles} drivers={drivers} createIncome={createIncome} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700 p-0.5 bg-zinc-50 dark:bg-zinc-900/50">
          <button
            type="button"
            onClick={() => { setStatusFilter("all"); setPageIndex(0); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${statusFilter === "all" ? "bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"}`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => { setStatusFilter("pending"); setPageIndex(0); }}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${statusFilter === "pending" ? "bg-white dark:bg-zinc-800 shadow text-zinc-900 dark:text-zinc-50" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50"}`}
          >
            Pending approval
          </button>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="search"
            placeholder="Search by vehicle, driver, date, amount..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageIndex(0);
            }}
            className="input pl-9 w-full"
          />
        </div>
      </div>

      <div className="mt-6 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black/5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    {th("loggedOn", "Date")}
                    {th("vehicle", "Vehicle")}
                    {th("driverName", "Driver")}
                    {th("income", "Income")}
                    {th("startingKm", "Starting KM")}
                    {th("endKm", "End KM")}
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Pictures
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                  {safeIncomes.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12">
                        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-8 text-center">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">No income records yet</p>
                          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Log your first income using the button above.</p>
                        </div>
                      </td>
                    </tr>
                  ) : sorted.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No records match your search.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((income) => {
                      const status = income.approvalStatus ?? "auto";
                      return (
                      <tr key={income.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-zinc-900 dark:text-zinc-50">
                          {new Date(income.loggedOn).toLocaleDateString()}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">{income.vehicle}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">{income.driverName}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">R {safeNum(income.income).toFixed(2)}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">{income.startingKm ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">{income.endKm ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            status === "pending" ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200" :
                            status === "approved" || status === "auto" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200" :
                            status === "rejected" ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200" :
                            "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300"
                          }`}>
                            {status === "auto" ? "Auto" : status.charAt(0).toUpperCase() + status.slice(1)}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            {income.petrolSlip ? (
                              <button
                                type="button"
                                onClick={() => setViewerImage({ dataUrl: toDataUrl(income.petrolSlip!), title: "Petrol slip" })}
                                className="inline-flex items-center gap-1.5 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-600 hover:ring-2 hover:ring-teal-500 transition-all"
                                title="View petrol slip (click to zoom)"
                              >
                                <img
                                  src={toDataUrl(income.petrolSlip)}
                                  alt="Petrol slip"
                                  className="h-10 w-10 object-cover bg-zinc-100 dark:bg-zinc-800"
                                />
                                <span className="pr-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hidden sm:inline">Petrol</span>
                              </button>
                            ) : null}
                            {income.expenseImage ? (
                              <button
                                type="button"
                                onClick={() => setViewerImage({ dataUrl: toDataUrl(income.expenseImage!), title: "Expense receipt" })}
                                className="inline-flex items-center gap-1.5 rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-600 hover:ring-2 hover:ring-amber-500 transition-all"
                                title="View expense receipt (click to zoom)"
                              >
                                <img
                                  src={toDataUrl(income.expenseImage)}
                                  alt="Expense receipt"
                                  className="h-10 w-10 object-cover bg-zinc-100 dark:bg-zinc-800"
                                />
                                <span className="pr-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hidden sm:inline">Receipt</span>
                              </button>
                            ) : null}
                            {!income.petrolSlip && !income.expenseImage ? (
                              <span className="text-zinc-400 dark:text-zinc-500 text-xs">—</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex items-center justify-end gap-2 flex-wrap">
                            {status === "pending" && (
                              <>
                                <button
                                  type="button"
                                  disabled={actionLoading === income.id}
                                  onClick={async () => {
                                    setActionLoading(income.id);
                                    const r = await approveIncome(income.id);
                                    setActionLoading(null);
                                    if (r?.success) router.refresh();
                                    else if (r?.error) alert(r.error);
                                  }}
                                  className="text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 disabled:opacity-50"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  disabled={actionLoading === income.id}
                                  onClick={async () => {
                                    setActionLoading(income.id);
                                    const r = await rejectIncome(income.id);
                                    setActionLoading(null);
                                    if (r?.success) router.refresh();
                                    else if (r?.error) alert(r.error);
                                  }}
                                  className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <Link
                              href={`/incomes/${income.id}`}
                              className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                            >
                              <Eye className="h-4 w-4" /> View
                            </Link>
                            <IncomeEditButton income={income} drivers={drivers} vehicles={vehicles} updateIncome={updateIncome} />
                            <form action={async (formData) => { await deleteIncome(formData); }} className="inline">
                              <input type="hidden" name="id" value={income.id} />
                              <button className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" type="submit">
                                Delete
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    ); })
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

      {viewerImage && (
        <FullscreenImageViewer
          imageDataUrl={viewerImage.dataUrl}
          title={viewerImage.title}
          onClose={() => setViewerImage(null)}
        />
      )}
    </div>
  );
}

