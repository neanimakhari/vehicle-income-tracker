"use client";

import { Fragment, useState } from "react";

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
  tripStarts?: string[];
  tripStops?: string[];
};

function fmt(n: number | null | undefined, digits = 1, suffix = "") {
  if (n == null || Number.isNaN(n)) return "—";
  return `${n.toFixed(digits)}${suffix}`;
}

function pairTrips(starts: string[], stops: string[]) {
  const pairs: Array<{ from: string; to: string; label: string }> = [];
  const n = Math.max(starts.length, stops.length);
  for (let i = 0; i < n; i++) {
    const from = starts[i];
    const to = stops[i] ?? stops[stops.length - 1];
    if (!from) continue;
    const end = to && new Date(to) > new Date(from) ? to : from;
    const endIso =
      end === from
        ? new Date(new Date(from).getTime() + 30 * 60 * 1000).toISOString()
        : end;
    pairs.push({
      from,
      to: endIso,
      label: `${new Date(from).toLocaleTimeString()} → ${new Date(endIso).toLocaleTimeString()}`,
    });
  }
  return pairs;
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
  const [expanded, setExpanded] = useState<string | null>(null);

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
            Expand a vehicle to replay engine-start segments on the live map.
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
              <th className="px-3 py-2 font-medium">Replay</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-zinc-500">
                  No trip/parking data for this day yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const pairs = pairTrips(r.tripStarts ?? [], r.tripStops ?? []);
                const open = expanded === r.vehicleId;
                return (
                  <Fragment key={r.vehicleId}>
                    <tr className="border-t border-zinc-100 dark:border-zinc-800">
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
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap gap-2">
                          <a
                            className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
                            href={`/tracking?mode=playback&day=${encodeURIComponent(day)}&vehicleId=${encodeURIComponent(r.vehicleId)}`}
                          >
                            Day
                          </a>
                          {pairs.length ? (
                            <button
                              type="button"
                              className="text-xs text-zinc-500 underline-offset-2 hover:underline"
                              onClick={() =>
                                setExpanded(open ? null : r.vehicleId)
                              }
                            >
                              {open ? "Hide segments" : "Segments"}
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {open
                      ? pairs.map((p, i) => (
                          <tr
                            key={`${r.vehicleId}-seg-${i}`}
                            className="border-t border-zinc-50 bg-zinc-50/80 dark:border-zinc-900 dark:bg-zinc-950/40"
                          >
                            <td
                              colSpan={9}
                              className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400"
                            >
                              Trip {i + 1}: {p.label}
                            </td>
                            <td className="px-3 py-2">
                              <a
                                className="text-xs font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
                                href={`/tracking?mode=playback&vehicleId=${encodeURIComponent(r.vehicleId)}&from=${encodeURIComponent(p.from)}&to=${encodeURIComponent(p.to)}`}
                              >
                                Replay
                              </a>
                            </td>
                          </tr>
                        ))
                      : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
