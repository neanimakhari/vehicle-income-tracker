"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CreateExpenseModal } from "@/components/create-expense-modal";
import { TablePagination } from "@/components/table-pagination";
import { FullscreenImageViewer, toDataUrl } from "@/components/fullscreen-image-viewer";
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Eye } from "lucide-react";

type Expense = { id: string; description: string; amount: number; receiptImage?: string; loggedOn?: string };

type SortKey = "description" | "amount" | "loggedOn";
type SortDir = "asc" | "desc";

type Props = {
  expenses: Expense[];
  createExpense: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  deleteExpense: (formData: FormData) => Promise<unknown>;
};

function SortIcon({ current, dir }: { current: boolean; dir: SortDir | null }) {
  if (!current) return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  return dir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
}

export function ExpensesClient({ expenses, createExpense, deleteExpense }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("loggedOn");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const [viewerImage, setViewerImage] = useState<{ dataUrl: string; title: string } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return expenses;
    return expenses.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        String(e.amount).toLowerCase().includes(q) ||
        (e.loggedOn && new Date(e.loggedOn).toLocaleDateString().toLowerCase().includes(q))
    );
  }, [expenses, search]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "description") cmp = a.description.localeCompare(b.description);
      else if (sortKey === "amount") cmp = a.amount - b.amount;
      else cmp = new Date(a.loggedOn || 0).getTime() - new Date(b.loggedOn || 0).getTime();
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
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Expenses</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Track tenant expenses and receipts.</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <CreateExpenseModal createExpense={createExpense} />
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="search"
            placeholder="Search by description or amount..."
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
                    {th("description", "Description")}
                    {th("amount", "Amount")}
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Receipt
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                  {expenses.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No expenses yet. Add one using the button above.
                      </td>
                    </tr>
                  ) : sorted.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No records match your search.
                      </td>
                    </tr>
                  ) : (
                    paginated.map((expense) => (
                      <tr key={expense.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-zinc-900 dark:text-zinc-50">
                          {expense.loggedOn ? new Date(expense.loggedOn).toLocaleDateString() : "—"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-900 dark:text-zinc-50">{expense.description}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">R {expense.amount.toFixed(2)}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm">
                          {expense.receiptImage ? (
                            <button
                              type="button"
                              onClick={() => setViewerImage({ dataUrl: toDataUrl(expense.receiptImage!), title: "Receipt" })}
                              className="inline-flex items-center rounded-md overflow-hidden border border-zinc-200 dark:border-zinc-600 hover:ring-2 hover:ring-teal-500 transition-all"
                              title="View receipt"
                            >
                              <img
                                src={toDataUrl(expense.receiptImage)}
                                alt="Receipt"
                                className="h-10 w-10 object-cover bg-zinc-100 dark:bg-zinc-800"
                              />
                            </button>
                          ) : (
                            <span className="text-zinc-400 dark:text-zinc-500 text-xs">—</span>
                          )}
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/expenses/${expense.id}`}
                              className="inline-flex items-center gap-1 text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300"
                            >
                              <Eye className="h-4 w-4" /> View
                            </Link>
                            <form action={async (formData) => { await deleteExpense(formData); }} className="inline">
                              <input type="hidden" name="id" value={expense.id} />
                              <button className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" type="submit">
                                Delete
                              </button>
                            </form>
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

