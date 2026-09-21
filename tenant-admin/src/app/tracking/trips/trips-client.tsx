"use client";

import { useState } from "react";

type VehicleTripRow = {
  vehicleId: string;
  vehicleLabel: string | null;
  tripCount: number;
  engineStarts: number;
  engineStops: number;
  stopCount: number;
  parkingHours: number;
  movingHours: number;
  ignitionHours: number;
  distanceKm: number | null;
  maxSpeedKph: number | null;
  overspeedEvents: number;
  offlineEvents: number;
};

function fmt(n: number | null | undefined, digits = 1, suffix = "") {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}${suffix}`;
}

export function TripsReportClient({
  initialDay,
  initial,
}: {
  initialDay: string;
  initial: VehicleTripRow[];
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
        `/api/proxy/tenant/tracking/trips-report?day=${encodeURIComponent(nextDay)}`,
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

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Tracker reports
          </p>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Trips & parking
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Engine start/stop events plus daily idle (parking) and stop counts.
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

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2 font-medium">Vehicle</th>
              <th className="px-3 py-2 font-medium">Trips</th>
              <th className="px-3 py-2 font-medium">Starts / stops</th>
              <th className="px-3 py-2 font-medium">Parking h</th>
              <th className="px-3 py-2 font-medium">Moving h</th>
              <th className="px-3 py-2 font-medium">Km</th>
              <th className="px-3 py-2 font-medium">Max km/h</th>
              <th className="px-3 py-2 font-medium">Overspeed</th>
              <th className="px-3 py-2 font-medium">Offline</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-zinc-500">
                  No trip/parking data for this day yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.vehicleId}
                  className="border-t border-zinc-100 dark:border-zinc-800"
                >
                  <td className="px-3 py-2 font-medium">
                    {r.vehicleLabel ?? r.vehicleId}
                  </td>
                  <td className="px-3 py-2">{r.tripCount}</td>
                  <td className="px-3 py-2">
                    {r.engineStarts} / {r.engineStops}
                  </td>
                  <td className="px-3 py-2">{fmt(r.parkingHours, 1)}</td>
                  <td className="px-3 py-2">{fmt(r.movingHours, 1)}</td>
                  <td className="px-3 py-2">{fmt(r.distanceKm, 1)}</td>
                  <td className="px-3 py-2">{fmt(r.maxSpeedKph, 0)}</td>
                  <td className="px-3 py-2">{r.overspeedEvents}</td>
                  <td className="px-3 py-2">{r.offlineEvents}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
