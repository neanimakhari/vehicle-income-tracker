"use client";

import { useState } from "react";
import { FullscreenImageViewer, toDataUrl } from "@/components/fullscreen-image-viewer";

type Expense = { id: string; description: string; amount: number; receiptImage?: string; loggedOn?: string };

export function ExpenseViewClient({ expense }: { expense: Expense }) {
  const [viewerOpen, setViewerOpen] = useState(false);
  const dataUrl = expense.receiptImage ? toDataUrl(expense.receiptImage) : null;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Expense details</h1>
      </div>
      <dl className="px-6 py-4 space-y-4">
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Description</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-50">{expense.description}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Amount</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-50">R {expense.amount.toFixed(2)}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Date</dt>
          <dd className="mt-1 text-zinc-900 dark:text-zinc-50">
            {expense.loggedOn ? new Date(expense.loggedOn).toLocaleDateString(undefined, { dateStyle: "long" }) : "—"}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Receipt</dt>
          <dd>
            {dataUrl ? (
              <button
                type="button"
                onClick={() => setViewerOpen(true)}
                className="rounded-lg border border-zinc-200 dark:border-zinc-700 overflow-hidden hover:ring-2 hover:ring-teal-500 transition-all"
              >
                <img src={dataUrl} alt="Receipt" className="max-h-48 w-auto object-contain bg-zinc-50 dark:bg-zinc-800" />
              </button>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500 text-sm">No receipt image</span>
            )}
          </dd>
        </div>
      </dl>
      {dataUrl && viewerOpen && (
        <FullscreenImageViewer imageDataUrl={dataUrl} title="Receipt" onClose={() => setViewerOpen(false)} />
      )}
    </div>
  );
}

