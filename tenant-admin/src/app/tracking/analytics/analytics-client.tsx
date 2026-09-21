"use client";

import { useMemo, useState } from "react";

type AnalyticsRow = {
  day: string;
  vehicleId: string;
  vehicleLabel: string | null;
  pointCount: number;
  distanceKm: number | null;
  distanceBasis: string | null;
  idlePct: number | null;
  utilisationHours: number | null;
  avgSpeedMoving: number | null;
  maxSpeedKph: number | null;
  stopCount?: number;
  ignitionOnSeconds?: number;
  avgExternalVoltage?: number | null;
  minExternalVoltage?: number | null;
  gpsFixOkPct?: number | null;
  estimatedLitres?: number | null;
  litresPer100km?: number | null;
  kmPerLitre?: number | null;
  overspeedMovingPct: number | null;
  overspeedSampleCount?: number;
  confidence: string;
  computedAt?: string;
};

function fmt(n: number | null | undefined, digits = 1, suffix = "") {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}${suffix}`;
}

export function TrackingAnalyticsClient({
  initial,
  includeObd,
  initialDay,
}: {
  initial: AnalyticsRow[];
  includeObd: boolean;
  initialDay: string;
}) {
  const [day, setDay] = useState(initialDay);
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    const distance = rows.reduce((s, r) => s + (r.distanceKm ?? 0), 0);
    const litres = rows.reduce((s, r) => s + (r.estimatedLitres ?? 0), 0);
    return { distance, litres, vehicles: rows.length };
  }, [rows]);

  async function load(nextDay: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/tenant/tracking/analytics?from=${encodeURIComponent(nextDay)}&to=${encodeURIComponent(nextDay)}`,
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
        body: JSON.stringify({ day, includeSimulate: false }),
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
          <p className="text-xs uppercase tracking-wide text-zinc-500">Tracker analytics</p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Daily vehicle efficiency
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Precomputed from GPS/OBD points (not live recompute). Johannesburg calendar day.
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

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Vehicles</p>
          <p className="text-2xl font-semibold">{totals.vehicles}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-xs text-zinc-500">Tracked km</p>
          <p className="text-2xl font-semibold">{fmt(totals.distance, 1)}</p>
        </div>
        {includeObd ? (
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">Est. litres</p>
            <p className="text-2xl font-semibold">{fmt(totals.litres, 2)}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-xs text-zinc-500">OBD</p>
            <p className="text-sm text-zinc-500">Not entitled</p>
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Vehicle</th>
              <th className="px-3 py-2 font-medium">Km</th>
              <th className="px-3 py-2 font-medium">Stops</th>
              <th className="px-3 py-2 font-medium">Ign. h</th>
              <th className="px-3 py-2 font-medium">Idle %</th>
              <th className="px-3 py-2 font-medium">Util. h</th>
              <th className="px-3 py-2 font-medium">Avg / max</th>
              <th className="px-3 py-2 font-medium">Avg V</th>
              <th className="px-3 py-2 font-medium">GPS %</th>
              {includeObd ? (
                <>
                  <th className="px-3 py-2 font-medium">L</th>
                  <th className="px-3 py-2 font-medium">L/100km</th>
                </>
              ) : null}
              <th className="px-3 py-2 font-medium">Overspeed</th>
              <th className="px-3 py-2 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={includeObd ? 13 : 11}
                  className="px-3 py-8 text-center text-zinc-500"
                >
                  No rollup for this day yet — run Recalculate or wait for the hourly job.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={`${r.day}-${r.vehicleId}`}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-3 py-2 font-medium">{r.vehicleLabel ?? r.vehicleId}</td>
                  <td className="px-3 py-2">
                    {fmt(r.distanceKm, 1)}
                    <span className="ml-1 text-xs text-zinc-500">{r.distanceBasis}</span>
                  </td>
                  <td className="px-3 py-2">{r.stopCount ?? "—"}</td>
                  <td className="px-3 py-2">
                    {r.ignitionOnSeconds != null
                      ? fmt(r.ignitionOnSeconds / 3600, 1)
                      : "—"}
                  </td>
                  <td className="px-3 py-2">{fmt(r.idlePct, 0, "%")}</td>
                  <td className="px-3 py-2">{fmt(r.utilisationHours, 2)}</td>
                  <td className="px-3 py-2">
                    {fmt(r.avgSpeedMoving, 0)} / {fmt(r.maxSpeedKph, 0)}
                  </td>
                  <td className="px-3 py-2">{fmt(r.avgExternalVoltage, 1)}</td>
                  <td className="px-3 py-2">{fmt(r.gpsFixOkPct, 0, "%")}</td>
                  {includeObd ? (
                    <>
                      <td className="px-3 py-2">{fmt(r.estimatedLitres, 2)}</td>
                      <td className="px-3 py-2">{fmt(r.litresPer100km, 1)}</td>
                    </>
                  ) : null}
                  <td className="px-3 py-2">{fmt(r.overspeedMovingPct, 0, "%")}</td>
                  <td className="px-3 py-2 capitalize">{r.confidence}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
