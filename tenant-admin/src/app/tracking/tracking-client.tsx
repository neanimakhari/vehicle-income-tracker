"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { io, Socket } from "socket.io-client";
import { fetchJsonClient } from "../../lib/api-client";
import type { MapPoint } from "./tracking-map";

const TrackingMap = dynamic(
  () => import("./tracking-map").then((m) => m.TrackingMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[360px] items-center justify-center bg-zinc-100 text-sm text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
        Loading map…
      </div>
    ),
  },
);

export type TrackingPoint = MapPoint;

type VehicleRow = { id: string; label: string; trackerImei?: string | null };
type DeviceRow = {
  id: string;
  imei: string;
  vehicleId: string;
  isActive: boolean;
  lastSeenAt: string | null;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(/\/$/, "");

function fmt(n: number | null | undefined, digits = 0, suffix = "") {
  if (n == null || Number.isNaN(Number(n))) return "—";
  return `${Number(n).toFixed(digits)}${suffix}`;
}

function ageLabel(iso: string | null | undefined) {
  if (!iso) return "No signal";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms)) return "—";
  if (ms < 60_000) return "Just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return new Date(iso).toLocaleString();
}

function TelemetryCell({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-md bg-zinc-50 px-2.5 py-2 dark:bg-zinc-950/60">
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-0.5 text-sm font-semibold tabular-nums ${
          warn ? "text-rose-600 dark:text-rose-400" : "text-zinc-900 dark:text-zinc-50"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

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
  const [selectedId, setSelectedId] = useState<string | null>(
    initialLatest[0]?.vehicleId ?? vehicles[0]?.id ?? null,
  );
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
        ? fetchJsonClient<TrackingPoint[]>(
            `/api/proxy/tenant/tracking/history?limit=100${
              selectedId ? `&vehicleId=${encodeURIComponent(selectedId)}` : ""
            }`,
          )
        : Promise.resolve([] as TrackingPoint[]),
      fetchJsonClient<DeviceRow[]>("/api/proxy/tenant/tracking/devices"),
    ]);
    if (Array.isArray(lat)) setLatest(lat);
    if (Array.isArray(hist)) setHistory(hist);
    if (Array.isArray(devs)) setDevices(devs);
  }

  async function runFullSimulate(vehicleId: string) {
    setBusy(`sim-${vehicleId}`);
    setMessage(null);
    setSelectedId(vehicleId);
    try {
      const profile = hasObd ? "obd" : "basic";
      const res = await fetch("/api/proxy/tenant/tracking/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vehicleId, profile, points: 36 }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err?.message ?? `Simulate failed (${res.status})`);
      } else {
        setMessage(
          hasObd
            ? "Full OBD demo trail generated (GPS + RPM, fuel, voltage, coolant, load)."
            : "GPS demo trail generated.",
        );
        await refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  async function bindDevice() {
    if (!selectedId || !bindImei.trim()) return;
    setBusy("bind");
    setMessage(null);
    try {
      const res = await fetch(`/api/proxy/tenant/tracking/devices/${selectedId}/bind`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imei: bindImei.trim() }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(err?.message ?? `Bind failed (${res.status})`);
      } else {
        setMessage("IMEI bound to selected vehicle.");
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

  const latestByVehicle = useMemo(() => {
    const map = new Map<string, TrackingPoint>();
    for (const p of latest) {
      const id = p.vehicleId ?? p.vehicleLabel ?? p.id;
      if (id) map.set(String(id), p);
    }
    return map;
  }, [latest]);

  const fleetRows = useMemo(() => {
    return vehicles.map((v) => {
      const point = latestByVehicle.get(v.id);
      const device = devices.find((d) => d.vehicleId === v.id);
      return { vehicle: v, point, device };
    });
  }, [vehicles, latestByVehicle, devices]);

  const selected = fleetRows.find((r) => r.vehicle.id === selectedId) ?? fleetRows[0];
  const selectedPoint = selected?.point ?? null;

  const trail = useMemo(() => {
    if (!hasHistory) return [] as TrackingPoint[];
    const vid = selected?.vehicle.id;
    if (!vid) return history.slice(0, 80);
    return history.filter((p) => p.vehicleId === vid).slice(0, 80);
  }, [history, hasHistory, selected?.vehicle.id]);

  const latestSorted = useMemo(
    () =>
      [...latest].sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      ),
    [latest],
  );

  if (!hasLive) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Live Tracking</h1>
        <div className="rounded-xl border border-amber-200/80 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Live tracking is not on your plan.</p>
          <p className="mt-1 opacity-90">
            Enable <code className="text-xs">tracking_live</code> (and optional history / OBD) to use the
            fleet map.
          </p>
        </div>
      </div>
    );
  }

  if (!popiaAck) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-5 px-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">
            Fleet map
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Live Tracking
          </h1>
        </div>
        <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 shadow-sm backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/90">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Location data notice (POPIA)
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Live tracking processes personal information (vehicle location and related telemetry). Use it
            only for legitimate fleet operations, inform drivers where required, and keep access limited to
            authorised staff. Map views are audited.
          </p>
          <button type="button" className="btn btn-primary mt-5 w-full sm:w-auto" onClick={ackPopia}>
            I understand — open fleet map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-1 space-y-4 sm:mx-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">
            Fleet map
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Live Tracking
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
            All tenant vehicles with a signal appear on the map. Select one for full telemetry and trail.
          </p>
          <p className="mt-2 flex flex-wrap gap-3 text-sm">
            <a
              href="/tracking/analytics"
              className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
            >
              Tracker analytics
            </a>
            <a
              href="/tracking/reconciliation"
              className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
            >
              Day reconciliation
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              connected
                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200"
                : "bg-zinc-200/80 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-400"}`}
            />
            {connected ? "Live" : "Polling"}
          </span>
          <button type="button" className="btn btn-secondary" onClick={refresh}>
            Refresh
          </button>
          {selected && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy?.startsWith("sim")}
              onClick={() => runFullSimulate(selected.vehicle.id)}
            >
              {busy === `sim-${selected.vehicle.id}`
                ? "Simulating…"
                : hasObd
                  ? "Simulate full OBD"
                  : "Simulate GPS"}
            </button>
          )}
        </div>
      </div>

      {message && (
        <p
          className="rounded-lg border border-teal-200/70 bg-teal-50 px-3 py-2 text-sm text-teal-950 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100"
          role="status"
        >
          {message}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="relative min-h-[420px] border-b border-zinc-200/80 lg:border-b-0 lg:border-r dark:border-zinc-700">
            <TrackingMap
              points={latestSorted}
              trail={trail}
              selectedVehicleId={selected?.vehicle.id}
              onSelectVehicle={setSelectedId}
            />
            <div className="pointer-events-none absolute bottom-3 left-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-zinc-700 shadow dark:bg-zinc-950/80 dark:text-zinc-200">
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-teal-600" /> Moving
              </span>
              <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-zinc-700 shadow dark:bg-zinc-950/80 dark:text-zinc-200">
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-zinc-500" /> Idle
              </span>
              <span className="rounded-full bg-white/90 px-2 py-1 text-[10px] font-medium text-zinc-700 shadow dark:bg-zinc-950/80 dark:text-zinc-200">
                <span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-600" /> Overspeed
              </span>
            </div>
          </div>

          <div className="flex max-h-[560px] flex-col">
            <div className="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Fleet · {fleetRows.length} vehicle{fleetRows.length === 1 ? "" : "s"}
              </div>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {fleetRows.map(({ vehicle, point, device }) => {
                const active = selected?.vehicle.id === vehicle.id;
                const moving = (point?.speedKph ?? 0) > 3;
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => setSelectedId(vehicle.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      active
                        ? "border-teal-500/70 bg-teal-50/80 ring-1 ring-teal-500/30 dark:border-teal-500/50 dark:bg-teal-950/30"
                        : "border-zinc-200/80 bg-zinc-50/50 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950/40 dark:hover:border-zinc-600"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-zinc-900 dark:text-zinc-50">
                          {vehicle.label}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {device ? (
                            <span className="font-mono">{device.imei}</span>
                          ) : (
                            "No IMEI bound"
                          )}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          !point
                            ? "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                            : point.overspeed
                              ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
                              : moving
                                ? "bg-teal-100 text-teal-800 dark:bg-teal-950/50 dark:text-teal-200"
                                : "bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {!point ? "Offline" : point.overspeed ? "Alert" : moving ? "Moving" : "Idle"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                      <span>{fmt(point?.speedKph, 0, " km/h")}</span>
                      {hasObd && <span>{fmt(point?.engineRpm, 0, " rpm")}</span>}
                      <span className="text-zinc-400">{ageLabel(point?.recordedAt)}</span>
                    </div>
                  </button>
                );
              })}
              {fleetRows.length === 0 && (
                <p className="px-2 py-6 text-center text-sm text-zinc-500">No vehicles yet.</p>
              )}
            </div>
          </div>
        </div>

        {selected && (
          <div className="border-t border-zinc-200/80 bg-zinc-50/60 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-950/40">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                  {selected.vehicle.label}
                </h2>
                <p className="text-xs text-zinc-500">
                  {selectedPoint
                    ? `${Number(selectedPoint.latitude).toFixed(5)}, ${Number(selectedPoint.longitude).toFixed(5)} · ${ageLabel(selectedPoint.recordedAt)}`
                    : "No position yet — run a full simulation or wait for ingest."}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-primary text-sm"
                  disabled={busy?.startsWith("sim")}
                  onClick={() => runFullSimulate(selected.vehicle.id)}
                >
                  {busy === `sim-${selected.vehicle.id}` ? "Running…" : "Simulate everything"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <TelemetryCell label="Speed" value={fmt(selectedPoint?.speedKph, 1, " km/h")} />
              <TelemetryCell label="Heading" value={fmt(selectedPoint?.heading, 0, "°")} />
              <TelemetryCell
                label="Ignition"
                value={
                  selectedPoint?.ignitionOn == null
                    ? "—"
                    : selectedPoint.ignitionOn
                      ? "On"
                      : "Off"
                }
              />
              <TelemetryCell
                label="GPS"
                value={
                  selectedPoint?.gpsFixOk == null
                    ? "—"
                    : selectedPoint.gpsFixOk
                      ? `OK · ${fmt(selectedPoint.satellites, 0)} sats`
                      : "No fix"
                }
              />
              <TelemetryCell
                label="Backup batt."
                value={fmt(selectedPoint?.backupBatteryLevel, 0, "%")}
              />
              <TelemetryCell
                label="Status"
                value={
                  selectedPoint?.overspeed
                    ? "Overspeed"
                    : (selectedPoint?.speedKph ?? 0) > 3
                      ? "Moving"
                      : selectedPoint
                        ? "Idle"
                        : "Offline"
                }
                warn={Boolean(selectedPoint?.overspeed)}
              />
            </div>

            {hasObd ? (
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
                <TelemetryCell label="Engine RPM" value={fmt(selectedPoint?.engineRpm, 0)} />
                <TelemetryCell label="Fuel rate" value={fmt(selectedPoint?.fuelRateLph, 1, " L/h")} />
                <TelemetryCell label="Fuel level" value={fmt(selectedPoint?.fuelLevelPercent, 0, "%")} />
                <TelemetryCell label="Voltage" value={fmt(selectedPoint?.externalVoltage, 1, " V")} />
                <TelemetryCell label="Coolant" value={fmt(selectedPoint?.coolantC, 0, "°C")} />
                <TelemetryCell label="Engine load" value={fmt(selectedPoint?.engineLoadPercent, 0, "%")} />
                <TelemetryCell
                  label="Odometer"
                  value={fmt(selectedPoint?.odometerKm, 1, " km")}
                />
              </div>
            ) : (
              <p className="mt-3 text-xs text-zinc-500">
                OBD metrics locked — enable <code className="text-[11px]">tracking_obd</code> for RPM, fuel,
                voltage, coolant, and load.
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2 border-t border-zinc-200/70 pt-4 dark:border-zinc-700 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1">
                <label className="text-xs font-medium text-zinc-500">Bind IMEI to this vehicle</label>
                <input
                  className="input mt-1 w-full"
                  placeholder="e.g. 356938035643809"
                  value={bindImei}
                  onChange={(e) => setBindImei(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy === "bind"}
                onClick={bindDevice}
              >
                Bind
              </button>
              {selected.device && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy === `unbind-${selected.vehicle.id}`}
                  onClick={() => unbindDevice(selected.vehicle.id)}
                >
                  Unbind {selected.device.imei}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {hasHistory && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-700">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Trail · {selected?.vehicle.label ?? "All"}
            </h2>
            <span className="text-xs text-zinc-500">{trail.length} points</span>
          </div>
          <div className="max-h-[280px] overflow-auto">
            <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
              <thead className="sticky top-0 bg-zinc-50 dark:bg-zinc-950">
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2 font-semibold">Time</th>
                  <th className="px-3 py-2 font-semibold">Coords</th>
                  <th className="px-3 py-2 font-semibold">Speed</th>
                  {hasObd && (
                    <>
                      <th className="px-3 py-2 font-semibold">RPM</th>
                      <th className="px-3 py-2 font-semibold">Fuel</th>
                      <th className="px-3 py-2 font-semibold">V</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {trail.map((point) => (
                  <tr key={point.id} className="tabular-nums">
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-300">
                      {new Date(point.recordedAt).toLocaleTimeString()}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-300">
                      {Number(point.latitude).toFixed(5)}, {Number(point.longitude).toFixed(5)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">
                      {fmt(point.speedKph, 1)}
                    </td>
                    {hasObd && (
                      <>
                        <td className="whitespace-nowrap px-3 py-2">{fmt(point.engineRpm, 0)}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {fmt(point.fuelLevelPercent, 0, "%")}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          {fmt(point.externalVoltage, 1)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {trail.length === 0 && (
                  <tr>
                    <td
                      colSpan={hasObd ? 6 : 3}
                      className="px-3 py-8 text-center text-zinc-500"
                    >
                      No trail yet — simulate everything on a vehicle.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
