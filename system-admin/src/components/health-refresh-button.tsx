"use client";

import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function HealthRefreshButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.refresh()}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
    >
      <RefreshCw className="h-4 w-4" />
      Refresh
    </button>
  );
}
