"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { refreshHealthPage } from "@/app/health/refresh-action";

export function HealthRefreshButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [spin, setSpin] = useState(false);

  return (
    <button
      type="button"
      disabled={pending || spin}
      onClick={() => {
        setSpin(true);
        start(async () => {
          try {
            await refreshHealthPage();
            // Hard navigation with cache-bust — router.refresh() alone often looks like a no-op
            router.replace(`/health?t=${Date.now()}`);
            router.refresh();
          } finally {
            // Keep spinner briefly so the user sees feedback even if metrics look the same
            window.setTimeout(() => setSpin(false), 600);
          }
        });
      }}
      className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
    >
      <RefreshCw className={`h-4 w-4 ${pending || spin ? "animate-spin" : ""}`} />
      {pending || spin ? "Refreshing…" : "Refresh"}
    </button>
  );
}
