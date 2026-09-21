"use client";

import { useState } from "react";

type Ev = {
  id: string;
  vehicleId: string;
  geofenceName: string | null;
  geofenceType: string | null;
  eventType: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
};

export function GeofenceEventsClient({ initial }: { initial: Ev[] }) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      const res = await fetch("/api/proxy/tenant/tracking/geofences/events?limit=100");
      if (res.ok) {
        setRows(await res.json());
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">Geofences</p>
          <h1 className="text-2xl font-semibold">Enter / exit events</h1>
        </div>
        <button
          type="button"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
          disabled={busy}
          onClick={refresh}
        >
          {busy ? "Loading…" : "Refresh"}
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Event</th>
              <th className="px-3 py-2">Zone</th>
              <th className="px-3 py-2">Vehicle</th>
              <th className="px-3 py-2">Position</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-zinc-500">
                  No events yet — assign fences and wait for live tracker points.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2 whitespace-nowrap">
                    {new Date(r.recordedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 uppercase text-xs font-semibold">{r.eventType}</td>
                  <td className="px-3 py-2">
                    {r.geofenceName ?? "—"}{" "}
                    <span className="text-zinc-500">({r.geofenceType})</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.vehicleId.slice(0, 8)}</td>
                  <td className="px-3 py-2 font-mono text-xs">
                    {r.latitude.toFixed(5)}, {r.longitude.toFixed(5)}
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
