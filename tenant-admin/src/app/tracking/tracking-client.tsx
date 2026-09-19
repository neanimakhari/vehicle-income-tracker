"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { fetchJsonClient } from "../../lib/api-client";
import type { MapPoint } from "./tracking-map";

const TrackingMap = dynamic(
  () => import("./tracking-map").then((m) => m.TrackingMap),
  { ssr: false, loading: () => <div className="h-[420px] animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" /> },
);

type TrackingPoint = MapPoint & {
  ignitionOn?: boolean | null;
  overspeed?: boolean | null;
};

type VehicleRow = { id: string; label: string; trackerImei?: string | null };
type DeviceRow = {
  id: string;
  imei: string;
  vehicleId: string;
  isActive: boolean;
  lastSeenAt: string | null;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

export function TrackingClient({
  initialHistory,
  initialLatest,
  tenantSlug,
  entitlements,
  vehicles,
  devices: initialDevices,
}: {
  initialHistory: TrackingPoint[];
  initialLatest: TrackingPoint[];
  tenantSlug: string;
  entitlements: string[] | null;
  vehicles: VehicleRow[];
  devices: DeviceRow[];
}) {
  const entitled = useMemo(
    () => (entitlements == null ? null : new Set(entitlements)),
    [entitlements],
  );
  const hasLive = entitled == null || entitled.has("tracking_live");
  const hasHistory = entitled == null || entitled.has("tracking_history");
  const hasObd = entitled == null || entitled.has("tracking_obd");

  const [history, setHistory] = useState<TrackingPoint[]>(initialHistory);
  const [latest, setLatest] = useState<TrackingPoint[]>(initialLatest);
  const [devices, setDevices] = useState<DeviceRow[]>(initialDevices);
  const [connected, setConnected] = useState(false);
  const [popiaAck, setPopiaAck] = useState(false);
  const [simVehicleId, setSimVehicleId] = useState(vehicles[0]?.id ?? "");
  const [simProfile, setSimProfile] = useState<"basic" | "obd">("basic");
  const [bindVehicleId, setBindVehicleId] = useState(vehicles[0]?.id ?? "");
  const [bindImei, setBindImei] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      setPopiaAck(localStorage.getItem("vit_tracking_popia_ack") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!tenantSlug || !hasLive || !popiaAck) return;
    let socket: Socket | null = null;
    let cancelled = false;
    (async () => {
      const creds = await fetchJsonClient<{ token: string; tenantId: string }>("/api/ws-token");
      if (!creds?.token || cancelled) return;
      socket = io(`${API_BASE}/tracking`, {
        transports: ["websocket", "polling"],
        withCredentials: true,
        auth: { token: creds.token, tenantId: creds.tenantId || tenantSlug },
        query: { tenantId: creds.tenantId || tenantSlug },
      });
      socket.on("connect", () => {
        setConnected(true);
        socket?.emit("tracking:subscribe", { tenantId: tenantSlug });
      });
      socket.on("disconnect", () => setConnected(false));
      socket.on("tracking:update", (point: TrackingPoint) => {
        setHistory((prev) => [point, ...prev].slice(0, 200));
        setLatest((prev) => {
          const key = point.vehicleId ?? point.vehicleLabel ?? point.id;
          const without = prev.filter(
            (p) => (p.vehicleId ?? p.vehicleLabel ?? p.id) !== key,
          );
          return [point, ...without];
        });
      });
    })();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [tenantSlug, hasLive, popiaAck]);

  async function refresh() {
    const [lat, hist, devs] = await Promise.all([
      fetchJsonClient<TrackingPoint[]>("/api/proxy/tenant/tracking/latest"),
      hasHistory
        ? fetchJsonClient<TrackingPoint[]>("/api/proxy/tenant/tracking/history?limit=100")
        : Promise.resolve([] as TrackingPoint[]),
      fetchJsonClient<DeviceRow[]>("/api/proxy/tenant/tracking/devices"),
    ]);
    if (Array.isArray(lat)) setLatest(lat);
    if (Array.isArray(hist)) setHistory(hist);
    if (Array.isArray(devs)) setDevices(devs);
  }

  async function runSimulate() {
    if (!simVehicleId) return;
    setBusy("sim");
    setMessage(null);
    try {
      const res = await fetch("/api/proxy/tenant/tracking/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vehicleId: simVehicleId,
          profile: simProfile === "obd" && hasObd ? "obd" : "basic",
          points: 24,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err?.message ?? `Simulate failed (${res.status})`);
      } else {
        setMessage("Demo trail generated.");
        await refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function bindDevice() {
    if (!bindVehicleId || !bindImei.trim()) return;
    setBusy("bind");
    setMessage(null);
    try {
      const res = await fetch(`/api/proxy/tenant/tracking/devices/${bindVehicleId}/bind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei: bindImei.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err?.message ?? `Bind failed (${res.status})`);
      } else {
        setMessage("IMEI bound.");
        setBindImei("");
        await refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function unbindDevice(vehicleId: string) {
    setBusy(`unbind-${vehicleId}`);
    try {
      await fetch(`/api/proxy/tenant/tracking/devices/${vehicleId}/unbind`, { method: "POST" });
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  function ackPopia() {
    try {
      localStorage.setItem("vit_tracking_popia_ack", "1");
    } catch {
      /* ignore */
    }
    setPopiaAck(true);
  }

  const latestSorted = useMemo(
    () => [...latest].sort((a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()),
    [latest],
  );

  if (!hasLive) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Live Tracking</h1>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Live tracking is not on your plan.</p>
          <p className="mt-1">
            Upgrade to include <code className="text-xs">tracking_live</code> (and optional history / OBD
            add-ons) to see the map, bind trackers, and run demos. Contact support to enable.
          </p>
        </div>
      </div>
    );
  }

  if (!popiaAck) {
    return (
      <div className="mx-auto max-w-lg space-y-4 py-8">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Live Tracking</h1>
        <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">Location data notice (POPIA)</h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Live tracking processes personal information (vehicle location and related telemetry). Use it only
            for legitimate fleet operations, inform drivers where required, and keep access limited to authorised
            staff. Map views are audited.
          </p>
          <button type="button" className="btn btn-primary mt-4" onClick={ackPopia}>
            I understand — open map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Live Tracking</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
            OSM map, device bind, and optional OBD demo. Ingest is private (IMEI → tenant).
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
          <button type="button" className="btn btn-secondary" onClick={refresh}>
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <p className="text-sm text-zinc-700 dark:text-zinc-200" role="status">
          {message}
        </p>
      )}

      <TrackingMap points={latestSorted} trail={hasHistory ? history.slice(0, 80) : []} />

      {!hasHistory && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
          History playback is an add-on (<code className="text-xs">tracking_history</code>). Enable it to show
          breadcrumbs on the map and the history table.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4 space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Demo simulator</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Generates a short trail without hardware. OBD profile requires the OBD module.
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              className="input"
              value={simVehicleId}
              onChange={(e) => setSimVehicleId(e.target.value)}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            <select
              className="input"
              value={simProfile}
              onChange={(e) => setSimProfile(e.target.value as "basic" | "obd")}
            >
              <option value="basic">Basic GPS</option>
              <option value="obd" disabled={!hasObd}>
                OBD{!hasObd ? " (locked)" : ""}
              </option>
            </select>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!simVehicleId || busy === "sim"}
              onClick={runSimulate}
            >
              {busy === "sim" ? "Running…" : "Simulate"}
            </button>
          </div>
          {!hasObd && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Upsell: enable <code>tracking_obd</code> for RPM, fuel rate, and voltage on the map.
            </p>
          )}
        </div>

        <div className="card p-4 space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Bind tracker IMEI</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Platform registry maps IMEI → this tenant + vehicle. Inactive devices are rejected at ingest.
          </p>
          <div className="flex flex-wrap gap-2">
            <select
              className="input"
              value={bindVehicleId}
              onChange={(e) => setBindVehicleId(e.target.value)}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                  {v.trackerImei ? ` (${v.trackerImei})` : ""}
                </option>
              ))}
            </select>
            <input
              className="input"
              placeholder="IMEI"
              value={bindImei}
              onChange={(e) => setBindImei(e.target.value)}
            />
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy === "bind"}
              onClick={bindDevice}
            >
              Bind
            </button>
          </div>
          <ul className="space-y-2 text-sm">
            {devices.map((d) => (
              <li
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-200 px-3 py-2 dark:border-zinc-700"
              >
                <span>
                  <span className="font-mono">{d.imei}</span>
                  <span className="ml-2 text-zinc-500">
                    {d.isActive ? "active" : "inactive"}
                    {d.lastSeenAt ? ` · seen ${new Date(d.lastSeenAt).toLocaleString()}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  className="btn btn-secondary text-xs"
                  disabled={busy === `unbind-${d.vehicleId}`}
                  onClick={() => unbindDevice(d.vehicleId)}
                >
                  Unbind
                </button>
              </li>
            ))}
            {devices.length === 0 && (
              <li className="text-zinc-500 dark:text-zinc-400">No devices bound yet.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Latest positions</h2>
          <div className="space-y-2">
            {latestSorted.map((point) => (
              <div key={point.id} className="rounded border border-zinc-200 p-3 text-sm dark:border-zinc-700">
                <div className="font-medium text-zinc-900 dark:text-zinc-50">
                  {point.vehicleLabel ?? "Unknown vehicle"}
                </div>
                <div className="text-zinc-600 dark:text-zinc-300">
                  Lat/Lng: {Number(point.latitude).toFixed(6)}, {Number(point.longitude).toFixed(6)}
                </div>
                <div className="text-zinc-600 dark:text-zinc-300">
                  Speed: {point.speedKph != null ? `${Number(point.speedKph).toFixed(1)} km/h` : "—"}
                  {hasObd && point.engineRpm != null
                    ? ` · RPM ${Number(point.engineRpm).toFixed(0)}`
                    : ""}
                </div>
                <div className="text-xs text-zinc-500 dark:text-zinc-400">
                  {new Date(point.recordedAt).toLocaleString()}
                </div>
              </div>
            ))}
            {latestSorted.length === 0 && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                No points yet — run Simulate or bind a tracker.
              </p>
            )}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent history</h2>
          {!hasHistory ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Module not entitled.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto">
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
                      <td className="px-3 py-2 text-sm whitespace-nowrap">
                        {new Date(point.recordedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
