"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  totalItems: number;
  pageSize: number;
  pageIndex: number; // 0-based
  onPageSizeChange: (size: number) => void;
  onPageChange: (page: number) => void;
  pageSizeOptions?: number[];
};

export function TablePagination({
  totalItems,
  pageSize,
  pageIndex,
  onPageSizeChange,
  onPageChange,
  pageSizeOptions = [10, 25, 50],
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const start = totalItems === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min((pageIndex + 1) * pageSize, totalItems);

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/50 sm:px-6">
      <div className="flex flex-wrap items-center gap-4">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          Showing <span className="font-medium">{start}</span> to <span className="font-medium">{end}</span> of{" "}
          <span className="font-medium">{totalItems}</span> results
        </p>
        <select
          className="input w-auto min-w-[80px] py-1.5 text-sm"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n} per page
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(pageIndex - 1)}
          disabled={pageIndex <= 0}
          className="btn btn-secondary py-1.5 px-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="sr-only sm:not-sr-only sm:ml-1">Previous</span>
        </button>
        <span className="text-sm text-zinc-600 dark:text-zinc-400 px-2">
          Page {pageIndex + 1} of {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(pageIndex + 1)}
          disabled={pageIndex >= totalPages - 1}
          className="btn btn-secondary py-1.5 px-2 text-sm disabled:opacity-50 disabled:pointer-events-none"
        >
          <span className="sr-only sm:not-sr-only sm:mr-1">Next</span>
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

