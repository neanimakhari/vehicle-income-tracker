"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Mode = "operations" | "transport" | "combined";

type TransportSummary = {
  expected: number;
  paid: number;
  balance: number;
  overdueCount: number;
  collectionRate: number;
};

export function DashboardStreamToggle({
  operationsIncome,
  operationsNet,
}: {
  operationsIncome: number;
  operationsNet: number;
}) {
  const [mode, setMode] = useState<Mode>("combined");
  const [transport, setTransport] = useState<TransportSummary | null>(null);

  useEffect(() => {
    void fetch("/api/proxy/tenant/transport/reports/summary")
      .then(async (r) => (r.ok ? ((await r.json()) as TransportSummary) : null))
      .then(setTransport)
      .catch(() => setTransport(null));
  }, []);

  const income =
    mode === "operations"
      ? operationsIncome
      : mode === "transport"
        ? Number(transport?.paid ?? 0)
        : operationsIncome + Number(transport?.paid ?? 0);
  const secondary =
    mode === "operations"
      ? operationsNet
      : mode === "transport"
        ? Number(transport?.balance ?? 0)
        : operationsNet;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["operations", "Day-to-day"],
            ["transport", "Scholar / staff"],
            ["combined", "Both"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            className={`rounded-md px-3 py-1.5 text-sm ${
              mode === id
                ? "bg-teal-700 text-white"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
        <Link href="/transport" className="ml-auto text-sm text-teal-700 hover:underline dark:text-teal-300">
          Open transport module
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            {mode === "transport" ? "Transport collected" : "Income (view)"}
          </div>
          <div className="mt-1 text-2xl font-semibold">
            R {income.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-xs uppercase tracking-wide text-zinc-500">
            {mode === "transport" ? "Outstanding fees" : "Net (ops) / outstanding"}
          </div>
          <div className="mt-1 text-2xl font-semibold">
            R {secondary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </div>
          {mode !== "operations" && transport && (
            <div className="mt-1 text-xs text-zinc-500">
              {transport.overdueCount} overdue ·{" "}
              {Math.round((transport.collectionRate || 0) * 100)}% collected
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
