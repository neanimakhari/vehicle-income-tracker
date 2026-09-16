"use client";

import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { fetchJsonClient } from "../../lib/api-client";

type TrackingPoint = {
  id: string;
  vehicleLabel: string | null;
  latitude: number;
  longitude: number;
  speedKph: number | null;
  heading: number | null;
  recordedAt: string;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function TrackingClient({
  initialHistory,
  initialLatest,
  tenantSlug,
}: {
  initialHistory: TrackingPoint[];
  initialLatest: TrackingPoint[];
  tenantSlug: string;
}) {
  const [history, setHistory] = useState<TrackingPoint[]>(initialHistory);
  const [latest, setLatest] = useState<TrackingPoint[]>(initialLatest);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!tenantSlug) return;
    const socket: Socket = io(`${API_BASE}/tracking`, {
      transports: ["websocket", "polling"],
      withCredentials: true,
      query: { tenantId: tenantSlug },
    });
    socket.on("connect", () => {
      setConnected(true);
      socket.emit("tracking:subscribe", { tenantId: tenantSlug });
    });
    socket.on("disconnect", () => setConnected(false));
    socket.on("tracking:update", (point: TrackingPoint) => {
      setHistory((prev) => [point, ...prev].slice(0, 200));
      setLatest((prev) => {
        const key = point.vehicleLabel ?? point.id;
        const without = prev.filter((p) => (p.vehicleLabel ?? p.id) !== key);
        return [point, ...without];
      });
    });
    return () => {
      socket.disconnect();
    };
  }, [tenantSlug]);

  async function refreshHistory() {
    const rows = await fetchJsonClient<TrackingPoint[]>("/api/proxy/tenant/tracking/history?limit=100");
    if (Array.isArray(rows)) setHistory(rows);
  }

  const latestSorted = useMemo(
    () => [...latest].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()),
    [latest],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Live Tracking</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            Realtime GPS updates with persisted history.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <span
            className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
              connected
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            }`}
          >
            {connected ? "Live connected" : "Disconnected"}
          </span>
          <button type="button" className="btn btn-secondary" onClick={refreshHistory}>
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Latest Vehicle Positions</h2>
          <div className="space-y-2">
            {latestSorted.map((point) => (
              <div key={point.id} className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-700">
                <div className="font-medium text-zinc-900 dark:text-zinc-50">{point.vehicleLabel ?? "Unknown vehicle"}</div>
                <div className="text-zinc-600 dark:text-zinc-300">
                  Lat/Lng: {Number(point.latitude).toFixed(6)}, {Number(point.longitude).toFixed(6)}
                </div>
                <div className="text-zinc-600 dark:text-zinc-300">
                  Speed: {point.speedKph != null ? `${Number(point.speedKph).toFixed(1)} km/h` : "—"}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(point.recordedAt).toLocaleString()}
                </div>
              </div>
            ))}
            {latestSorted.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No live tracking points yet.</p>
            )}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent History</h2>
          <div className="max-h-[520px] overflow-auto">
            <table className="min-w-[32rem] w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900 sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">Vehicle</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">Coordinates</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">Speed</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold whitespace-nowrap">Recorded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {history.map((point) => (
                  <tr key={point.id}>
                    <td className="px-3 py-2 text-sm whitespace-nowrap">{point.vehicleLabel ?? "—"}</td>
                    <td className="px-3 py-2 text-sm whitespace-nowrap">
                      {Number(point.latitude).toFixed(6)}, {Number(point.longitude).toFixed(6)}
                    </td>
                    <td className="px-3 py-2 text-sm whitespace-nowrap">
                      {point.speedKph != null ? Number(point.speedKph).toFixed(1) : "—"}
                    </td>
                    <td className="px-3 py-2 text-sm whitespace-nowrap">{new Date(point.recordedAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

