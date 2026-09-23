"use client";

import { useState } from "react";

type DailyRow = Record<string, unknown>;

export function GeofenceDailyClient({
  initial,
  initialDay,
}: {
  initial: DailyRow[];
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
        `/api/proxy/tenant/tracking/geofences/daily?from=${encodeURIComponent(nextDay)}&to=${encodeURIComponent(nextDay)}`,
      );
      if (!res.ok) throw new Error(`Load failed (${res.status})`);
      const data = await res.json();
      setRows(Array.isArray(data) ? data : (data.vehicles ?? []));
      setDay(nextDay);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Geofences</p>
          <h1 className="text-2xl font-semibold">Daily geofence rollups</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Rank dwell, depot time, off-corridor minutes — from live GPS points.
          </p>
        </div>
        <input
          type="date"
          value={day}
          disabled={busy}
          onChange={(e) => load(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="px-3 py-2">Day</th>
              <th className="px-3 py-2">Vehicle</th>
              <th className="px-3 py-2">Rank dwell (s)</th>
              <th className="px-3 py-2">Depot (s)</th>
              <th className="px-3 py-2">Off corridor (s)</th>
              <th className="px-3 py-2">Events</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2">{String(r.day ?? r.Day ?? "").slice(0, 10)}</td>
                <td className="px-3 py-2">
                  {String(r.vehicleLabel ?? r.vehicle_id ?? r.vehicleId ?? "—")}
                </td>
                <td className="px-3 py-2">{String(r.rankDwellSeconds ?? r.rank_dwell_sec ?? "—")}</td>
                <td className="px-3 py-2">{String(r.depotDwellSeconds ?? r.depot_dwell_sec ?? "—")}</td>
                <td className="px-3 py-2">
                  {String(r.offCorridorSeconds ?? r.off_corridor_sec ?? "—")}
                </td>
                <td className="px-3 py-2">
                  {String(
                    (Number(r.enterCount ?? 0) || 0) + (Number(r.exitCount ?? 0) || 0) ||
                      r.eventCount ||
                      "—",
                  )}
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-zinc-500">
                  No daily geofence rollup yet for this day.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
