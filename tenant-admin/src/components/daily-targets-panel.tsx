"use client";

import { useState } from "react";
import Link from "next/link";
import { Target, ArrowRight } from "lucide-react";

type DriverTarget = {
  driverId: string;
  driverName: string;
  target: number | null;
  actual: number;
  variance: number | null;
  shortfall: number;
  surplus: number;
  percentHit: number | null;
  hit: boolean | null;
  entryCount: number;
};

type DailyTargetsPayload = {
  date: string;
  defaultDailyTargetAmount: number | null;
  summary: {
    drivers: number;
    driversWithTarget: number;
    hitCount: number;
    missCount: number;
    totalTarget: number;
    totalActual: number;
    totalVariance: number | null;
  };
  drivers: DriverTarget[];
};

function formatRand(n: number | null | undefined) {
  if (n == null || Number.isNaN(n)) return "—";
  return `R ${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function DailyTargetsPanel({
  initial,
  defaultTarget,
}: {
  initial: DailyTargetsPayload | null;
  defaultTarget: number | null;
}) {
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultValue, setDefaultValue] = useState(
    defaultTarget != null ? String(defaultTarget) : "",
  );
  const [message, setMessage] = useState<string | null>(null);
  const data = initial;

  async function saveDefault(e: React.FormEvent) {
    e.preventDefault();
    setSavingDefault(true);
    setMessage(null);
    try {
      const raw = defaultValue.trim();
      const amount = raw === "" ? null : Number(raw);
      if (amount != null && (Number.isNaN(amount) || amount < 0)) {
        setMessage("Enter a valid amount (or leave blank).");
        return;
      }
      const res = await fetch("/api/proxy/tenant/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultDailyTargetAmount: amount }),
      });
      if (!res.ok) {
        setMessage("Could not save default target.");
        return;
      }
      setMessage("Default daily target saved. Refresh to recalculate.");
    } catch {
      setMessage("Could not save default target.");
    } finally {
      setSavingDefault(false);
    }
  }

  const missDrivers =
    data?.drivers.filter((d) => d.hit === false).slice(0, 8) ?? [];
  const hitDrivers =
    data?.drivers.filter((d) => d.hit === true).slice(0, 5) ?? [];

  return (
    <div className="card p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30 shrink-0">
            <Target className="h-6 w-6 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Daily target vs actual
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {data
                ? `For ${data.date} · approved + auto income only`
                : "Set a default target to start tracking shortfalls"}
            </p>
            <Link
              href="/target-calendar"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
            >
              Configure calendar rules
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
        <form onSubmit={saveDefault} className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-zinc-600 dark:text-zinc-400">
            Tenant default (R/day)
            <input
              className="input mt-1 w-36 py-2 text-sm"
              inputMode="decimal"
              placeholder="e.g. 1500"
              value={defaultValue}
              onChange={(e) => setDefaultValue(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={savingDefault}>
            {savingDefault ? "Saving…" : "Save default"}
          </button>
        </form>
      </div>
      {message ? (
        <p className="text-sm text-teal-700 dark:text-teal-300">{message}</p>
      ) : null}

      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Hit target" value={`${data.summary.hitCount}/${data.summary.driversWithTarget}`} />
            <Metric label="Fleet target" value={formatRand(data.summary.totalTarget)} />
            <Metric label="Fleet actual" value={formatRand(data.summary.totalActual)} />
            <Metric
              label="Variance"
              value={formatRand(data.summary.totalVariance)}
              tone={
                data.summary.totalVariance == null
                  ? "neutral"
                  : data.summary.totalVariance >= 0
                    ? "good"
                    : "bad"
              }
            />
          </div>

          {missDrivers.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50 mb-2">
                Shortfall today
              </h4>
              <div className="overflow-x-auto -mx-2 px-2">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-zinc-600 dark:text-zinc-400">
                      <th className="py-2 pr-4">Driver</th>
                      <th className="py-2 pr-4">Target</th>
                      <th className="py-2 pr-4">Actual</th>
                      <th className="py-2">Short</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missDrivers.map((d) => (
                      <tr key={d.driverId} className="border-t border-zinc-200 dark:border-zinc-700">
                        <td className="py-2 pr-4">
                          <Link
                            href={`/drivers/${d.driverId}`}
                            className="font-medium text-teal-700 hover:underline dark:text-teal-300"
                          >
                            {d.driverName}
                          </Link>
                        </td>
                        <td className="py-2 pr-4 text-zinc-800 dark:text-zinc-200">{formatRand(d.target)}</td>
                        <td className="py-2 pr-4 text-zinc-800 dark:text-zinc-200">{formatRand(d.actual)}</td>
                        <td className="py-2 font-medium text-amber-700 dark:text-amber-300">
                          {formatRand(d.shortfall)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {hitDrivers.length > 0 && missDrivers.length === 0 && (
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              All drivers with a target have hit it today.
            </p>
          )}

          <Link
            href="/drivers"
            className="inline-flex items-center gap-2 text-sm font-medium text-teal-700 hover:underline dark:text-teal-300"
          >
            Set per-driver targets on Drivers
            <ArrowRight className="h-4 w-4" />
          </Link>
        </>
      ) : (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Targets data is unavailable right now. Save a default above, then refresh after the API migration is applied.
        </p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "bad"
        ? "text-amber-700 dark:text-amber-300"
        : "text-zinc-900 dark:text-zinc-50";
  return (
    <div className="rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-3">
      <div className="text-xs text-zinc-600 dark:text-zinc-400">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}
