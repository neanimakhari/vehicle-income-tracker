"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";
import { fetchJsonClient } from "../../lib/api-client";
import type { MapPoint } from "./tracking-map";
import { TelemetryGauges } from "./telemetry-gauges";
import { TrackingSpeedChart } from "./tracking-speed-chart";

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

type MetricsVehicle = {
  vehicleId: string;
  pointCount?: number;
  maxSpeedKph?: number;
  avgSpeedKph?: number;
  movingSamples?: number;
  idleSamples?: number;
};

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

function todayJhb(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dayBoundsIso(day: string): { from: string; to: string } {
  return {
    from: `${day}T00:00:00+02:00`,
    to: `${day}T23:59:59.999+02:00`,
  };
}

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
  initialMode = "live",
  initialDay,
  initialFrom,
  initialTo,
  initialVehicleId,
}: {
  initialHistory: TrackingPoint[];
  initialLatest: TrackingPoint[];
  tenantSlug: string;
  entitlements: string[] | null;
  vehicles: VehicleRow[];
  devices: DeviceRow[];
  initialMode?: "live" | "playback";
  initialDay?: string;
  initialFrom?: string;
  initialTo?: string;
  initialVehicleId?: string;
}) {
  const entitled = useMemo(
    () => (entitlements == null ? null : new Set(entitlements)),
    [entitlements],
  );
  const hasLive = entitled == null || entitled.has("tracking_live");
  const hasHistory = entitled == null || entitled.has("tracking_history");
  const hasObd = entitled == null || entitled.has("tracking_obd");

  const [mode, setMode] = useState<"live" | "playback">(
    hasHistory ? initialMode : "live",
  );
  const [playbackDay, setPlaybackDay] = useState(initialDay ?? todayJhb());
  const [playbackTrail, setPlaybackTrail] = useState<TrackingPoint[]>([]);
  const [scrubIndex, setScrubIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [metrics, setMetrics] = useState<MetricsVehicle | null>(null);
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [history, setHistory] = useState<TrackingPoint[]>(initialHistory);
  const [latest, setLatest] = useState<TrackingPoint[]>(initialLatest);
  const [devices, setDevices] = useState<DeviceRow[]>(initialDevices);
  const [connected, setConnected] = useState(false);
  const [popiaAck, setPopiaAck] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialVehicleId ??
      initialLatest[0]?.vehicleId ??
      vehicles[0]?.id ??
      null,
  );
  const [bindImei, setBindImei] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [alertToast, setAlertToast] = useState<{
    message: string;
    severity: string;
  } | null>(null);
  const [cmdBusy, setCmdBusy] = useState<string | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;

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
      const creds = await fetchJsonClient<{ token: string; tenantId: string }>(
        "/api/ws-token",
      );
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
        setLatest((prev) => {
          const key = point.vehicleId ?? point.vehicleLabel ?? point.id;
          const without = prev.filter(
            (p) => (p.vehicleId ?? p.vehicleLabel ?? p.id) !== key,
          );
          return [point, ...without];
        });
        if (modeRef.current === "live") {
          setHistory((prev) => [...prev, point].slice(-200));
        }
      });
      socket.on(
        "tracking:alert",
        (ev: { message?: string; eventType?: string; severity?: string }) => {
          setAlertToast({
            message: ev.message || ev.eventType || "Tracking alert",
            severity: ev.severity || "warning",
          });
          window.setTimeout(() => setAlertToast(null), 8000);
        },
      );
    })();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [tenantSlug, hasLive, popiaAck]);

  async function loadPlayback(opts?: {
    day?: string;
    from?: string;
    to?: string;
    vehicleId?: string;
  }) {
    if (!hasHistory) return;
    const vid = opts?.vehicleId ?? selectedId;
    if (!vid) {
      setMessage("Select a vehicle for playback.");
      return;
    }
    setBusy("playback");
    setMessage(null);
    setPlaying(false);
    try {
      let from = opts?.from;
      let to = opts?.to;
      const day = opts?.day ?? playbackDay;
      if (!from || !to) {
        const b = dayBoundsIso(day);
        from = b.from;
        to = b.to;
      }
      const qs = new URLSearchParams({
        vehicleId: vid,
        from,
        to,
        limit: "2000",
      });
      const [pts, metricsRes] = await Promise.all([
        fetchJsonClient<TrackingPoint[]>(
          `/api/proxy/tenant/tracking/history?${qs}`,
        ),
        fetchJsonClient<{ vehicles?: MetricsVehicle[] }>(
          `/api/proxy/tenant/tracking/metrics/summary?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&vehicleId=${encodeURIComponent(vid)}`,
        ).catch(() => null),
      ]);
      const trail = Array.isArray(pts) ? pts : [];
      setPlaybackTrail(trail);
      setScrubIndex(trail.length ? trail.length - 1 : 0);
      setMode("playback");
      setSelectedId(vid);
      if (opts?.day) setPlaybackDay(opts.day);
      const m = metricsRes?.vehicles?.find((v) => v.vehicleId === vid) ?? null;
      setMetrics(m);
      setMessage(
        trail.length
          ? `Loaded ${trail.length} points for playback`
          : "No points in this window",
      );
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (!popiaAck || !hasHistory) return;
    if (initialMode === "playback" && (initialFrom || initialDay)) {
      void loadPlayback({
        day: initialDay,
        from: initialFrom,
        to: initialTo,
        vehicleId: initialVehicleId ?? selectedId ?? undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-link once on ack
  }, [popiaAck]);

  useEffect(() => {
    if (!playing || mode !== "playback" || playbackTrail.length < 2) {
      if (playTimer.current) {
        clearInterval(playTimer.current);
        playTimer.current = null;
      }
      return;
    }
    playTimer.current = setInterval(() => {
      setScrubIndex((i) => {
        if (i >= playbackTrail.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 350);
    return () => {
      if (playTimer.current) clearInterval(playTimer.current);
    };
  }, [playing, mode, playbackTrail.length]);

  async function refresh() {
    const [lat, hist, devs] = await Promise.all([
      fetchJsonClient<TrackingPoint[]>("/api/proxy/tenant/tracking/latest"),
      hasHistory && mode === "live"
        ? fetchJsonClient<TrackingPoint[]>(
            `/api/proxy/tenant/tracking/history?limit=100${
              selectedId ? `&vehicleId=${encodeURIComponent(selectedId)}` : ""
            }`,
          )
        : Promise.resolve(null),
      fetchJsonClient<DeviceRow[]>("/api/proxy/tenant/tracking/devices"),
    ]);
    if (Array.isArray(lat)) setLatest(lat);
    if (Array.isArray(hist)) setHistory(hist);
    if (Array.isArray(devs)) setDevices(devs);
  }

  async function bindDevice() {
    if (!selectedId || !bindImei.trim()) return;
    setBusy("bind");
    setMessage(null);
    try {
      const res = await fetch(
        `/api/proxy/tenant/tracking/devices/${selectedId}/bind`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imei: bindImei.trim() }),
        },
      );
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
      await fetch(`/api/proxy/tenant/tracking/devices/${vehicleId}/unbind`, {
        method: "POST",
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  }

  async function sendCommand(
    imei: string,
    body: Record<string, unknown>,
    label: string,
  ) {
    setCmdBusy(label);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/proxy/tenant/tracking/devices/${encodeURIComponent(imei)}/command`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.message ?? `Command failed (${res.status})`);
      } else if (data.queued) {
        setMessage(`${label}: queued until device reconnects`);
      } else {
        setMessage(`${label}: sent`);
      }
    } finally {
      setCmdBusy(null);
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

  const selected =
    fleetRows.find((r) => r.vehicle.id === selectedId) ?? fleetRows[0];

  const liveTrail = useMemo(() => {
    if (!hasHistory || mode !== "live") return [] as TrackingPoint[];
    const vid = selected?.vehicle.id;
    const chron = [...history].sort(
      (a, b) =>
        new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
    );
    if (!vid) return chron.slice(-80);
    return chron.filter((p) => p.vehicleId === vid).slice(-80);
  }, [history, hasHistory, selected?.vehicle.id, mode]);

  const trail = mode === "playback" ? playbackTrail : liveTrail;
  const playheadPoint =
    mode === "playback" && trail.length
      ? trail[Math.max(0, Math.min(scrubIndex, trail.length - 1))]
      : null;
  const selectedPoint =
    mode === "playback" ? playheadPoint : (selected?.point ?? null);

  const latestSorted = useMemo(
    () =>
      [...latest].sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      ),
    [latest],
  );

  if (!hasLive) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Live Tracking
        </h1>
        <div className="rounded-xl border border-amber-200/80 bg-amber-50 p-5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">Live tracking is not on your plan.</p>
          <p className="mt-1 opacity-90">
            Enable <code className="text-xs">tracking_live</code> (and optional
            history / OBD) to use the fleet map.
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
            Live tracking processes personal information (vehicle location and
            related telemetry). Use it only for legitimate fleet operations,
            inform drivers where required, and keep access limited to authorised
            staff. Map views are audited.
          </p>
          <button
            type="button"
            className="btn btn-primary mt-5 w-full sm:w-auto"
            onClick={ackPopia}
          >
            I understand — open fleet map
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="-mx-1 space-y-4 sm:mx-0">
      {alertToast ? (
        <div
          className={`fixed right-4 top-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
            alertToast.severity === "critical"
              ? "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-800 dark:bg-rose-950/90 dark:text-rose-100"
              : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/90 dark:text-amber-100"
          }`}
          role="alert"
        >
          <p className="font-semibold">Live alert</p>
          <p className="mt-0.5 opacity-90">{alertToast.message}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-teal-700 dark:text-teal-300">
            Fleet map
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Live Tracking
          </h1>
          <p className="mt-2 flex flex-wrap gap-3 text-sm">
            <a
              href="/tracking/analytics"
              className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
            >
              Tracker analytics
            </a>
            <a
              href="/tracking/trips"
              className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
            >
              Trips & parking
            </a>
            <a
              href="/tracking/alerts"
              className="font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
            >
              Alerts
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasHistory ? (
            <div className="inline-flex rounded-lg border border-zinc-200 p-0.5 dark:border-zinc-700">
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  mode === "live"
                    ? "bg-teal-600 text-white"
                    : "text-zinc-600 dark:text-zinc-300"
                }`}
                onClick={() => {
                  setMode("live");
                  setPlaying(false);
                }}
              >
                Live
              </button>
              <button
                type="button"
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                  mode === "playback"
                    ? "bg-teal-600 text-white"
                    : "text-zinc-600 dark:text-zinc-300"
                }`}
                onClick={() => setMode("playback")}
              >
                Playback
              </button>
            </div>
          ) : null}
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
            {connected ? "WS" : "Offline"}
          </span>
          <button type="button" className="btn btn-secondary" onClick={refresh}>
            Refresh
          </button>
        </div>
      </div>

      {hasHistory && mode === "playback" ? (
        <div className="flex flex-col gap-3 rounded-xl border border-zinc-200/80 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900 sm:flex-row sm:items-end">
          <div>
            <label className="text-xs font-medium text-zinc-500">Day (JHB)</label>
            <input
              type="date"
              className="input mt-1"
              value={playbackDay}
              onChange={(e) => setPlaybackDay(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy === "playback" || !selectedId}
            onClick={() => loadPlayback({ day: playbackDay })}
          >
            {busy === "playback" ? "Loading…" : "Load route"}
          </button>
          {playbackTrail.length > 1 ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPlaying((p) => !p)}
              >
                {playing ? "Pause" : "Play"}
              </button>
              <div className="min-w-0 flex-1">
                <label className="text-xs font-medium text-zinc-500">
                  Scrub ·{" "}
                  {playheadPoint
                    ? new Date(playheadPoint.recordedAt).toLocaleTimeString()
                    : "—"}{" "}
                  · {fmt(playheadPoint?.speedKph, 0, " km/h")}
                </label>
                <input
                  type="range"
                  className="mt-1 w-full"
                  min={0}
                  max={Math.max(0, playbackTrail.length - 1)}
                  value={scrubIndex}
                  onChange={(e) => {
                    setPlaying(false);
                    setScrubIndex(Number(e.target.value));
                  }}
                />
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {mode === "playback" && metrics ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <TelemetryCell label="Points" value={String(metrics.pointCount ?? 0)} />
          <TelemetryCell
            label="Max speed"
            value={fmt(metrics.maxSpeedKph != null ? Number(metrics.maxSpeedKph) : null, 0, " km/h")}
          />
          <TelemetryCell
            label="Moving samples"
            value={String(metrics.movingSamples ?? 0)}
          />
          <TelemetryCell
            label="Idle samples"
            value={String(metrics.idleSamples ?? 0)}
          />
        </div>
      ) : null}

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
              playheadIndex={mode === "playback" ? scrubIndex : null}
              fitTrail={mode === "playback" && playbackTrail.length >= 2}
            />
          </div>

          <div className="flex max-h-[560px] flex-col">
            <div className="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Fleet · {fleetRows.length}
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
                        : "border-zinc-200/80 bg-zinc-50/50 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-950/40"
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
                            ? "bg-zinc-200 text-zinc-600"
                            : point.overspeed
                              ? "bg-rose-100 text-rose-700"
                              : moving
                                ? "bg-teal-100 text-teal-800"
                                : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {!point
                          ? "Offline"
                          : point.overspeed
                            ? "Alert"
                            : moving
                              ? "Moving"
                              : "Idle"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                      <span>{fmt(point?.speedKph, 0, " km/h")}</span>
                      <span className="text-zinc-400">
                        {ageLabel(point?.recordedAt)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {selected && (
          <div className="border-t border-zinc-200/80 bg-zinc-50/60 px-4 py-4 dark:border-zinc-700 dark:bg-zinc-950/40">
            <div className="mb-3">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {selected.vehicle.label}
                {mode === "playback" ? (
                  <span className="ml-2 text-xs font-normal text-zinc-500">
                    playback
                  </span>
                ) : null}
              </h2>
              <p className="text-xs text-zinc-500">
                {selectedPoint
                  ? `${Number(selectedPoint.latitude).toFixed(5)}, ${Number(selectedPoint.longitude).toFixed(5)} · ${ageLabel(selectedPoint.recordedAt)}`
                  : "No position yet."}
              </p>
            </div>

            <TelemetryGauges point={selectedPoint} hasObd={hasObd} />

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <TelemetryCell
                label="Heading"
                value={fmt(selectedPoint?.heading, 0, "°")}
              />
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
                label="Odometer"
                value={fmt(selectedPoint?.odometerKm, 1, " km")}
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

            {mode === "live" ? (
              <div className="mt-4 flex flex-col gap-2 border-t border-zinc-200/70 pt-4 dark:border-zinc-700 sm:flex-row sm:items-end">
                <div className="min-w-0 flex-1">
                  <label className="text-xs font-medium text-zinc-500">
                    Bind IMEI
                  </label>
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
                    Unbind
                  </button>
                )}
              </div>
            ) : null}

            {mode === "live" && selected.device ? (
              <div className="mt-4 border-t border-zinc-200/70 pt-4 dark:border-zinc-700">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                  Device commands
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[
                    { label: "Speed 80", body: { type: "speed_alarm", value: 80 } },
                    {
                      label: "Interval 30s",
                      body: { type: "upload_interval", value: 30 },
                    },
                    { label: "Status", body: { type: "status" } },
                    { label: "Mileage", body: { type: "mileage" } },
                  ].map((c) => (
                    <button
                      key={c.label}
                      type="button"
                      className="btn btn-secondary text-xs"
                      disabled={cmdBusy != null}
                      onClick={() =>
                        sendCommand(selected.device!.imei, c.body, c.label)
                      }
                    >
                      {cmdBusy === c.label ? "…" : c.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {mode === "playback" && playbackTrail.length >= 2 ? (
        <TrackingSpeedChart
          points={playbackTrail}
          scrubIndex={scrubIndex}
          onScrub={(i) => {
            setPlaying(false);
            setScrubIndex(i);
          }}
        />
      ) : null}

      {hasHistory && trail.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-700">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Trail · {selected?.vehicle.label ?? "—"}
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
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {[...trail].reverse().map((point, revIdx) => {
                  const idx = trail.length - 1 - revIdx;
                  const active = mode === "playback" && idx === scrubIndex;
                  return (
                    <tr
                      key={point.id}
                      className={`cursor-pointer tabular-nums ${
                        active ? "bg-amber-50 dark:bg-amber-950/30" : ""
                      }`}
                      onClick={() => {
                        if (mode === "playback") {
                          setPlaying(false);
                          setScrubIndex(idx);
                        }
                      }}
                    >
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-300">
                        {new Date(point.recordedAt).toLocaleTimeString()}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-zinc-600 dark:text-zinc-300">
                        {Number(point.latitude).toFixed(5)},{" "}
                        {Number(point.longitude).toFixed(5)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2">
                        {fmt(point.speedKph, 1)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
