"use client";

import { useState } from "react";

type RecRow = {
  day: string;
  vehicleId: string;
  vehicleLabel: string | null;
  incomeTotal: number;
  incomePetrolLitres: number;
  incomeDistanceKm: number;
  trackerDistanceKm: number | null;
  trackerEstimatedLitres: number | null;
  distanceGapPct: number | null;
  fuelGapPct: number | null;
  incomePerKm: number | null;
  incomePerIgnitionHour: number | null;
  idleFuelWasteLitres: number | null;
  idleFuelWasteRand: number | null;
  flags: string[];
};

function fmt(n: number | null | undefined, digits = 1, prefix = "", suffix = "") {
  if (n == null || Number.isNaN(n)) return "—";
  return `${prefix}${n.toFixed(digits)}${suffix}`;
}

export function TrackingReconcileClient({
  initial,
  initialDay,
}: {
  initial: RecRow[];
  initialDay: string;
}) {
  const [day, setDay] = useState(initialDay);
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(nextDay: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/tenant/tracking/reconciliation?from=${encodeURIComponent(nextDay)}&to=${encodeURIComponent(nextDay)}`,
      );
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      setRows(data.vehicles ?? []);
      setDay(nextDay);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function recalculate() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/tenant/tracking/analytics/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ day, includeSimulate: true }),
      });
      if (!res.ok) throw new Error(`Recalculate failed (${res.status})`);
      await load(day);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Day reconciliation</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Income vs tracker
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Compare what drivers logged with distance and fuel estimated from the tracker.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={day}
            onChange={(e) => load(e.target.value)}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="button"
            onClick={() => recalculate()}
            disabled={busy}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {busy ? "Working…" : "Recalculate day"}
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Vehicle</th>
              <th className="px-3 py-2 font-medium">Income</th>
              <th className="px-3 py-2 font-medium">Km log / track</th>
              <th className="px-3 py-2 font-medium">Km gap</th>
              <th className="px-3 py-2 font-medium">L log / track</th>
              <th className="px-3 py-2 font-medium">R/km</th>
              <th className="px-3 py-2 font-medium">R/h ign</th>
              <th className="px-3 py-2 font-medium">Idle waste</th>
              <th className="px-3 py-2 font-medium">Flags</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">
                  No reconciliation rows yet — recalculate after tracking + income exist for the day.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={`${r.day}-${r.vehicleId}`}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-3 py-2 font-medium">{r.vehicleLabel ?? r.vehicleId}</td>
                  <td className="px-3 py-2">{fmt(r.incomeTotal, 0, "R ")}</td>
                  <td className="px-3 py-2">
                    {fmt(r.incomeDistanceKm, 0)} / {fmt(r.trackerDistanceKm, 1)}
                  </td>
                  <td className="px-3 py-2">{fmt(r.distanceGapPct, 0, "", "%")}</td>
                  <td className="px-3 py-2">
                    {fmt(r.incomePetrolLitres, 1)} / {fmt(r.trackerEstimatedLitres, 1)}
                  </td>
                  <td className="px-3 py-2">{fmt(r.incomePerKm, 2, "R ")}</td>
                  <td className="px-3 py-2">{fmt(r.incomePerIgnitionHour, 0, "R ")}</td>
                  <td className="px-3 py-2">
                    {fmt(r.idleFuelWasteLitres, 2, "", " L")}
                    {r.idleFuelWasteRand != null
                      ? ` · ${fmt(r.idleFuelWasteRand, 0, "R ")}`
                      : ""}
                  </td>
                  <td className="px-3 py-2">
                    {r.flags?.length ? (
                      <div className="flex flex-wrap gap-1">
                        {r.flags.map((f) => (
                          <span
                            key={f}
                            className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium uppercase text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                          >
                            {f.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-zinc-400">OK</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
