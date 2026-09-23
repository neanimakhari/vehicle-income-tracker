"use client";

import { hasModule } from "@/lib/entitlements";
import dynamic from "next/dynamic";
import Link from "next/link";
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

type TrackingEvent = {
  id: string;
  vehicleId?: string | null;
  eventType: string;
  message?: string | null;
  severity?: string;
  recordedAt: string;
};

type MetricsVehicle = {
  vehicleId: string;
  pointCount?: number;
  maxSpeedKph?: number;
  movingSamples?: number;
  idleSamples?: number;
};

type FleetFilter = "all" | "moving" | "idle" | "offline" | "alert";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);
const OFFLINE_MS = 15 * 60 * 1000;

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

function isOffline(point: TrackingPoint | null | undefined) {
  if (!point?.recordedAt) return true;
  return Date.now() - new Date(point.recordedAt).getTime() > OFFLINE_MS;
}

function statusKind(point: TrackingPoint | null | undefined): FleetFilter | "ok" {
  if (isOffline(point)) return "offline";
  if (point?.overspeed) return "alert";
  if ((point?.speedKph ?? 0) > 3) return "moving";
  return "idle";
}

function kindLabel(kind: FleetFilter | "ok"): string {
  switch (kind) {
    case "moving":
      return "Moving";
    case "idle":
      return "Idle";
    case "offline":
      return "Offline";
    case "alert":
      return "Alert";
    default:
      return "Ok";
  }
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
      <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
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
  const hasLive = hasModule(entitlements, "tracking_live");
  const hasHistory = hasModule(entitlements, "tracking_history");
  const hasObd = hasModule(entitlements, "tracking_obd");

  const [replayOpen, setReplayOpen] = useState(
    hasHistory && initialMode === "playback",
  );
  const [playbackDay, setPlaybackDay] = useState(initialDay ?? todayJhb());
  const [playbackTrail, setPlaybackTrail] = useState<TrackingPoint[]>([]);
  const [scrubIndex, setScrubIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [metrics, setMetrics] = useState<MetricsVehicle | null>(null);
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [latest, setLatest] = useState<TrackingPoint[]>(initialLatest);
  const [devices, setDevices] = useState<DeviceRow[]>(initialDevices);
  const [events, setEvents] = useState<TrackingEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [popiaAck, setPopiaAck] = useState(false);
  const [fleetFilter, setFleetFilter] = useState<FleetFilter>("all");
  const [showMore, setShowMore] = useState(false);
  const [showCommands, setShowCommands] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    initialVehicleId ??
      initialLatest[0]?.vehicleId ??
      vehicles[0]?.id ??
      null,
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [alertToast, setAlertToast] = useState<{
    message: string;
    severity: string;
  } | null>(null);
  const [cmdBusy, setCmdBusy] = useState<string | null>(null);
  const [alertedIds, setAlertedIds] = useState<Set<string>>(new Set());
  const [dayStory, setDayStory] = useState<{
    vehicles: number;
    distanceKm: number;
    starts: number;
    trips: number;
    offline: number;
  } | null>(null);

  useEffect(() => {
    try {
      setPopiaAck(localStorage.getItem("vit_tracking_popia_ack") === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!hasLive) return;
    let cancelled = false;
    (async () => {
      try {
        const day = todayJhb();
        const res = await fetch(
          `/api/proxy/tenant/tracking/trips-report?day=${encodeURIComponent(day)}`,
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const rows = Array.isArray(data?.vehicles) ? data.vehicles : [];
        let distanceKm = 0;
        let starts = 0;
        let trips = 0;
        let offline = 0;
        for (const r of rows) {
          distanceKm += Number(r.distanceKm ?? 0) || 0;
          starts += Number(r.engineStarts ?? 0) || 0;
          trips += Number(r.tripCount ?? 0) || 0;
          offline += Number(r.offlineEvents ?? 0) || 0;
        }
        if (!cancelled) {
          setDayStory({
            vehicles: rows.length,
            distanceKm,
            starts,
            trips,
            offline,
          });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasLive]);

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
      });
      socket.on(
        "tracking:alert",
        (ev: {
          message?: string;
          eventType?: string;
          severity?: string;
          vehicleId?: string;
        }) => {
          setAlertToast({
            message: ev.message || ev.eventType || "Tracking alert",
            severity: ev.severity || "warning",
          });
          if (ev.vehicleId) {
            setAlertedIds((prev) => new Set(prev).add(String(ev.vehicleId)));
          }
          window.setTimeout(() => setAlertToast(null), 8000);
        },
      );
    })();
    return () => {
      cancelled = true;
      socket?.disconnect();
    };
  }, [tenantSlug, hasLive, popiaAck]);

  useEffect(() => {
    if (!popiaAck || !hasLive) return;
    void fetchJsonClient<TrackingEvent[]>(
      "/api/proxy/tenant/tracking/events?limit=40",
    ).then((rows) => {
      if (Array.isArray(rows)) setEvents(rows);
    });
  }, [popiaAck, hasLive, selectedId]);

  async function loadPlayback(opts?: {
    day?: string;
    from?: string;
    to?: string;
    vehicleId?: string;
  }) {
    if (!hasHistory) return;
    const vid = opts?.vehicleId ?? selectedId;
    if (!vid) {
      setMessage("Select a vehicle to replay.");
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
      setReplayOpen(true);
      setSelectedId(vid);
      if (opts?.day) setPlaybackDay(opts.day);
      setMetrics(
        metricsRes?.vehicles?.find((v) => v.vehicleId === vid) ?? null,
      );
      setMessage(
        trail.length
          ? `Replay: ${trail.length} points`
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popiaAck]);

  useEffect(() => {
    if (!playing || !replayOpen || playbackTrail.length < 2) {
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
  }, [playing, replayOpen, playbackTrail.length]);

  async function refresh() {
    const [lat, devs, evs] = await Promise.all([
      fetchJsonClient<TrackingPoint[]>("/api/proxy/tenant/tracking/latest"),
      fetchJsonClient<DeviceRow[]>("/api/proxy/tenant/tracking/devices"),
      fetchJsonClient<TrackingEvent[]>(
        "/api/proxy/tenant/tracking/events?limit=40",
      ).catch(() => null),
    ]);
    if (Array.isArray(lat)) setLatest(lat);
    if (Array.isArray(devs)) setDevices(devs);
    if (Array.isArray(evs)) setEvents(evs);
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
      const kind = statusKind(point);
      const alert =
        kind === "alert" || alertedIds.has(v.id) || Boolean(point?.overspeed);
      return {
        vehicle: v,
        point,
        device,
        kind: alert && kind !== "offline" ? ("alert" as const) : kind,
      };
    });
  }, [vehicles, latestByVehicle, devices, alertedIds]);

  const counts = useMemo(() => {
    const c = { moving: 0, idle: 0, offline: 0, alert: 0 };
    for (const r of fleetRows) {
      if (r.kind === "moving") c.moving += 1;
      else if (r.kind === "idle") c.idle += 1;
      else if (r.kind === "offline") c.offline += 1;
      if (r.kind === "alert") c.alert += 1;
    }
    return c;
  }, [fleetRows]);

  const filteredFleet = useMemo(() => {
    if (fleetFilter === "all") return fleetRows;
    return fleetRows.filter((r) => r.kind === fleetFilter);
  }, [fleetRows, fleetFilter]);

  const selected =
    fleetRows.find((r) => r.vehicle.id === selectedId) ?? fleetRows[0];
  const selectedPoint = selected?.point ?? null;
  const vehicleEvents = useMemo(() => {
    const vid = selected?.vehicle.id;
    if (!vid) return [];
    return events.filter((e) => e.vehicleId === vid).slice(0, 3);
  }, [events, selected?.vehicle.id]);

  const playheadPoint =
    replayOpen && playbackTrail.length
      ? playbackTrail[Math.max(0, Math.min(scrubIndex, playbackTrail.length - 1))]
      : null;

  const latestSorted = useMemo(
    () =>
      [...latest].sort(
        (a, b) =>
          new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      ),
    [latest],
  );

  const statusLine = (() => {
    if (!selected) return "Select a vehicle";
    if (!selected.device) {
      return "No tracker bound — set up a GPS unit to see live position.";
    }
    if (isOffline(selectedPoint)) {
      return `Offline · last seen ${ageLabel(selectedPoint?.recordedAt ?? selected.device.lastSeenAt)}`;
    }
    if (selectedPoint?.overspeed) {
      return `Overspeed ${fmt(selectedPoint.speedKph, 0, " km/h")} · ${ageLabel(selectedPoint.recordedAt)}`;
    }
    if ((selectedPoint?.speedKph ?? 0) > 3) {
      return `Moving ${fmt(selectedPoint?.speedKph, 0, " km/h")} · signal ${ageLabel(selectedPoint?.recordedAt)}`;
    }
    return `Idle · signal ${ageLabel(selectedPoint?.recordedAt)}`;
  })();

  if (!hasLive) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Live Tracking</h1>
        <p className="text-sm text-zinc-600">
          Enable <code>tracking_live</code> on your plan.
        </p>
      </div>
    );
  }

  if (!popiaAck) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center gap-5 px-2">
        <h1 className="text-3xl font-semibold tracking-tight">Live Tracking</h1>
        <div className="rounded-2xl border border-zinc-200/80 bg-white/90 p-6 dark:border-zinc-700 dark:bg-zinc-900/90">
          <h2 className="text-lg font-semibold">Location data notice (POPIA)</h2>
          <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            Live tracking processes vehicle location and related telemetry. Use
            it only for legitimate fleet operations.
          </p>
          <button type="button" className="btn btn-primary mt-5" onClick={ackPopia}>
            I understand — open fleet map
          </button>
        </div>
      </div>
    );
  }

  const unboundCount = fleetRows.filter((r) => !r.device).length;

  return (
    <div className="-mx-1 space-y-4 sm:mx-0">
      {alertToast ? (
        <div
          className={`fixed right-4 top-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg ${
            alertToast.severity === "critical"
              ? "border-rose-300 bg-rose-50 text-rose-950"
              : "border-amber-300 bg-amber-50 text-amber-950"
          }`}
          role="alert"
        >
          <p className="font-semibold">Live alert</p>
          <p className="mt-0.5 opacity-90">{alertToast.message}</p>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-wide text-teal-700 dark:text-teal-300">
            Fleet Map · v{process.env.NEXT_PUBLIC_APP_VERSION ?? "1.2.5"}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Live Tracking
          </h1>
          <p className="mt-1 max-w-xl text-sm text-zinc-600 dark:text-zinc-300">
            See what the fleet is doing now, then replay a day or trip when you
            need to explain a route.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              connected
                ? "bg-emerald-100 text-emerald-800"
                : "bg-zinc-200/80 text-zinc-700"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-400"}`}
            />
            {connected ? "Live feed" : "Reconnecting"}
          </span>
          <button type="button" className="btn btn-secondary" onClick={refresh}>
            Refresh
          </button>
        </div>
      </div>

      {dayStory ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-200/70 bg-teal-50/70 px-3 py-2 text-sm text-teal-950 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-100">
          <p>
            Today · {dayStory.vehicles} vehicles · {fmt(dayStory.distanceKm, 1)} km ·{" "}
            {dayStory.starts} starts · {dayStory.trips} trip segments
            {dayStory.offline > 0 ? ` · ${dayStory.offline} offline` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {hasHistory ? (
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-teal-800 underline-offset-2 hover:underline dark:text-teal-200 disabled:opacity-50"
                disabled={busy === "playback" || !selectedId}
                onClick={() =>
                  loadPlayback({
                    day: todayJhb(),
                    vehicleId: selectedId ?? undefined,
                  })
                }
              >
                {busy === "playback" ? "Loading…" : "Replay selected · today"}
              </button>
            ) : null}
            <Link
              href="/tracking/trips"
              className="shrink-0 text-xs font-semibold text-teal-800 underline-offset-2 hover:underline dark:text-teal-200"
            >
              Full day → Trips & parking
            </Link>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", `All ${fleetRows.length}`],
            ["moving", `Moving ${counts.moving}`],
            ["idle", `Idle ${counts.idle}`],
            ["offline", `Offline ${counts.offline}`],
            ["alert", `Alerts ${counts.alert}`],
          ] as Array<[FleetFilter, string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFleetFilter(key)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              fleetFilter === key
                ? "bg-teal-600 text-white"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {unboundCount > 0 ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {unboundCount} vehicle{unboundCount === 1 ? "" : "s"} without a
          tracker.{" "}
          <Link href="/tracking/setup" className="font-semibold underline">
            Set up a tracker
          </Link>
        </p>
      ) : null}

      {message ? (
        <p
          className="rounded-lg border border-teal-200/70 bg-teal-50 px-3 py-2 text-sm text-teal-950 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-100"
          role="status"
        >
          {message}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative min-h-[420px] border-b border-zinc-200/80 lg:border-b-0 lg:border-r dark:border-zinc-700">
            <TrackingMap
              points={latestSorted}
              trail={[]}
              selectedVehicleId={selected?.vehicle.id}
              onSelectVehicle={setSelectedId}
            />
          </div>

          <div className="flex max-h-[640px] flex-col">
            <div className="border-b border-zinc-200/80 px-4 py-3 dark:border-zinc-700">
              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Fleet · {filteredFleet.length}
              </div>
            </div>
            <div className="max-h-48 space-y-1 overflow-y-auto border-b border-zinc-200/80 p-2 dark:border-zinc-700">
              {filteredFleet.map(({ vehicle, point, device, kind }) => {
                const active = selected?.vehicle.id === vehicle.id;
                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    onClick={() => setSelectedId(vehicle.id)}
                    className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                      active
                        ? "bg-teal-50 ring-1 ring-teal-500/40 dark:bg-teal-950/40"
                        : "hover:bg-zinc-50 dark:hover:bg-zinc-950/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium">{vehicle.label}</span>
                      <span className="text-[10px] font-semibold text-zinc-500">
                        {kindLabel(kind)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {device ? (
                        <span className="font-mono">{device.imei}</span>
                      ) : (
                        "No IMEI"
                      )}{" "}
                      · {fmt(point?.speedKph, 0, " km/h")}
                    </div>
                  </button>
                );
              })}
            </div>

            {selected ? (
              <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <div>
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                    {selected.vehicle.label}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">
                    {statusLine}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">
                    Overspeed uses your fleet speed limit in Tracking settings
                    (alerts). Offline means no GPS for about 15+ minutes.
                  </p>
                </div>

                <TelemetryGauges point={selectedPoint} hasObd={hasObd} />

                {vehicleEvents.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Recent events
                    </p>
                    <ul className="mt-1 space-y-1">
                      {vehicleEvents.map((e) => (
                        <li
                          key={e.id}
                          className="text-xs text-zinc-600 dark:text-zinc-300"
                        >
                          <span className="font-medium">{e.message ?? e.eventType}</span>
                          <span className="text-zinc-400">
                            {" "}
                            · {ageLabel(e.recordedAt)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {hasHistory ? (
                    <button
                      type="button"
                      className="btn btn-primary text-xs"
                      disabled={busy === "playback"}
                      onClick={() =>
                        loadPlayback({
                          day: todayJhb(),
                          vehicleId: selected.vehicle.id,
                        })
                      }
                    >
                      {busy === "playback" ? "Loading…" : "Replay today"}
                    </button>
                  ) : null}
                  <Link
                    href={`/tracking/setup?vehicleId=${encodeURIComponent(selected.vehicle.id)}`}
                    className="btn btn-secondary text-xs"
                  >
                    {selected.device ? "Fix tracker" : "Add tracker"}
                  </Link>
                  <Link href="/tracking/alerts" className="btn btn-secondary text-xs">
                    Alerts
                  </Link>
                  {selected.device ? (
                    <button
                      type="button"
                      className="btn btn-secondary text-xs"
                      onClick={() => setShowCommands((v) => !v)}
                    >
                      Commands
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-secondary text-xs"
                    onClick={() => setShowMore((v) => !v)}
                  >
                    {showMore ? "Less" : "More"}
                  </button>
                </div>

                {showCommands && selected.device ? (
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Speed 80", body: { type: "speed_alarm", value: 80 } },
                      {
                        label: "Interval 30s",
                        body: { type: "upload_interval", value: 30 },
                      },
                      { label: "Status", body: { type: "status" } },
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
                ) : null}

                {showMore ? (
                  <div className="grid grid-cols-2 gap-2">
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
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {replayOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950/50 backdrop-blur-sm">
          <div className="m-2 flex max-h-[calc(100vh-1rem)] flex-1 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900 sm:m-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Replay
                </p>
                <h2 className="text-lg font-semibold">
                  {selected?.vehicle.label ?? "Vehicle"}
                </h2>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setReplayOpen(false);
                  setPlaying(false);
                }}
              >
                Close
              </button>
            </div>
            <div className="flex flex-wrap items-end gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
              <div>
                <label className="text-xs text-zinc-500">Day (JHB)</label>
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
                disabled={busy === "playback"}
                onClick={() =>
                  loadPlayback({
                    day: playbackDay,
                    vehicleId: selected?.vehicle.id,
                  })
                }
              >
                Load route
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
                  <div className="min-w-[200px] flex-1">
                    <label className="text-xs text-zinc-500">
                      {playheadPoint
                        ? `${new Date(playheadPoint.recordedAt).toLocaleTimeString()} · ${fmt(playheadPoint.speedKph, 0, " km/h")}`
                        : "Scrub"}
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
              {metrics ? (
                <p className="text-xs text-zinc-500">
                  {metrics.pointCount ?? 0} pts · max{" "}
                  {fmt(
                    metrics.maxSpeedKph != null
                      ? Number(metrics.maxSpeedKph)
                      : null,
                    0,
                    " km/h",
                  )}
                </p>
              ) : null}
            </div>
            <div className="min-h-0 flex-1">
              <TrackingMap
                points={latestSorted}
                trail={playbackTrail}
                selectedVehicleId={selected?.vehicle.id}
                playheadIndex={scrubIndex}
                fitTrail={playbackTrail.length >= 2}
              />
            </div>
            {playbackTrail.length >= 2 ? (
              <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
                <TrackingSpeedChart
                  points={playbackTrail}
                  scrubIndex={scrubIndex}
                  onScrub={(i) => {
                    setPlaying(false);
                    setScrubIndex(i);
                  }}
                />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
