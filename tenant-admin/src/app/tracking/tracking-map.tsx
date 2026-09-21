"use client";

import { useEffect, useRef, useState } from "react";

export type MapPoint = {
  id: string;
  vehicleId?: string | null;
  vehicleLabel: string | null;
  latitude: number;
  longitude: number;
  speedKph: number | null;
  heading: number | null;
  recordedAt: string;
  ignitionOn?: boolean | null;
  gpsFixOk?: boolean | null;
  satellites?: number | null;
  engineRpm?: number | null;
  fuelRateLph?: number | null;
  fuelLevelPercent?: number | null;
  externalVoltage?: number | null;
  backupBatteryLevel?: number | null;
  odometerKm?: number | null;
  coolantC?: number | null;
  engineLoadPercent?: number | null;
  overspeed?: boolean | null;
};

type LeafletNS = {
  map: (el: HTMLElement) => LeafletMap;
  tileLayer: (url: string, opts: Record<string, unknown>) => { addTo: (m: LeafletMap) => void };
  divIcon: (opts: Record<string, unknown>) => unknown;
  marker: (latLng: [number, number], opts?: Record<string, unknown>) => LeafletMarker;
  polyline: (
    latlngs: [number, number][],
    opts: Record<string, unknown>,
  ) => LeafletPolyline;
  latLngBounds: (latlngs: [number, number][]) => { pad: (n: number) => unknown };
};

type LeafletMap = {
  setView: (c: [number, number], z: number) => LeafletMap;
  remove: () => void;
  removeLayer: (layer: unknown) => void;
  fitBounds: (b: unknown) => void;
};

type LeafletMarker = {
  addTo: (m: LeafletMap) => LeafletMarker;
  setLatLng: (ll: [number, number]) => void;
  bindPopup: (html: string) => void;
  setIcon?: (icon: unknown) => void;
};

type LeafletPolyline = {
  addTo: (m: LeafletMap) => LeafletPolyline;
  setLatLngs: (ll: [number, number][]) => void;
  setStyle?: (opts: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    L?: LeafletNS;
  }
}

function loadLeaflet(): Promise<LeafletNS> {
  return new Promise((resolve, reject) => {
    if (window.L) {
      resolve(window.L);
      return;
    }
    const cssId = "leaflet-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const existing = document.querySelector('script[data-leaflet="1"]');
    if (existing) {
      existing.addEventListener("load", () => {
        if (window.L) resolve(window.L);
        else reject(new Error("Leaflet failed to load"));
      });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.dataset.leaflet = "1";
    script.onload = () => {
      if (window.L) resolve(window.L);
      else reject(new Error("Leaflet failed to load"));
    };
    script.onerror = () => reject(new Error("Leaflet script error"));
    document.body.appendChild(script);
  });
}

function popupHtml(p: MapPoint) {
  const rows = [
    ["Speed", p.speedKph != null ? `${Number(p.speedKph).toFixed(1)} km/h` : "—"],
    ["Heading", p.heading != null ? `${Number(p.heading).toFixed(0)}°` : "—"],
    ["Ignition", p.ignitionOn == null ? "—" : p.ignitionOn ? "On" : "Off"],
    ["GPS", p.gpsFixOk == null ? "—" : p.gpsFixOk ? `Fix · ${p.satellites ?? "—"} sats` : "No fix"],
    ["RPM", p.engineRpm != null ? Number(p.engineRpm).toFixed(0) : null],
    ["Fuel rate", p.fuelRateLph != null ? `${Number(p.fuelRateLph).toFixed(1)} L/h` : null],
    ["Fuel", p.fuelLevelPercent != null ? `${Number(p.fuelLevelPercent).toFixed(0)}%` : null],
    ["Voltage", p.externalVoltage != null ? `${Number(p.externalVoltage).toFixed(1)} V` : null],
    ["Coolant", p.coolantC != null ? `${Number(p.coolantC).toFixed(0)}°C` : null],
    ["Load", p.engineLoadPercent != null ? `${Number(p.engineLoadPercent).toFixed(0)}%` : null],
    ["Odo", p.odometerKm != null ? `${Number(p.odometerKm).toFixed(1)} km` : null],
  ].filter(([, v]) => v != null);

  return `<div style="min-width:160px;font:12px/1.4 system-ui,sans-serif">
    <div style="font-weight:700;margin-bottom:6px">${p.vehicleLabel ?? "Vehicle"}</div>
    ${rows.map(([k, v]) => `<div style="display:flex;justify-content:space-between;gap:12px"><span style="opacity:.65">${k}</span><span>${v}</span></div>`).join("")}
    <div style="margin-top:6px;opacity:.55;font-size:11px">${new Date(p.recordedAt).toLocaleString()}</div>
  </div>`;
}

/** Trail points must be chronological (oldest → newest). */
export function TrackingMap({
  points,
  trail,
  selectedVehicleId,
  onSelectVehicle,
  playheadIndex = null,
  fitTrail = false,
}: {
  points: MapPoint[];
  trail: MapPoint[];
  selectedVehicleId?: string | null;
  onSelectVehicle?: (vehicleId: string | null) => void;
  playheadIndex?: number | null;
  fitTrail?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const trailRef = useRef<LeafletPolyline | null>(null);
  const playedRef = useRef<LeafletPolyline | null>(null);
  const playheadRef = useRef<LeafletMarker | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const lastFitKey = useRef<string>("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      try {
        const L = await loadLeaflet();
        if (cancelled || !containerRef.current) return;
        LRef.current = L;
        const map = L.map(containerRef.current).setView([-26.2041, 28.0473], 12);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
        mapRef.current = map;
        setMapReady(true);
      } catch (err) {
        console.error(err);
      }
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current.clear();
      trailRef.current = null;
      playedRef.current = null;
      playheadRef.current = null;
      setMapReady(false);
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = LRef.current;
    if (!map || !L || !mapReady) return;

    const seen = new Set<string>();
    for (const p of points) {
      const key = String(p.vehicleId ?? p.vehicleLabel ?? p.id);
      seen.add(key);
      const latLng: [number, number] = [Number(p.latitude), Number(p.longitude)];
      const selected = selectedVehicleId != null && key === selectedVehicleId;
      const moving = (p.speedKph ?? 0) > 3;
      const color = p.overspeed ? "#dc2626" : moving ? "#0d9488" : "#64748b";
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:${selected ? 18 : 14}px;height:${selected ? 18 : 14}px;border-radius:999px;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>`,
        iconSize: [selected ? 18 : 14, selected ? 18 : 14],
        iconAnchor: [selected ? 9 : 7, selected ? 9 : 7],
      });
      let marker = markersRef.current.get(key);
      if (!marker) {
        marker = L.marker(latLng, { icon }).addTo(map);
        markersRef.current.set(key, marker);
        if (onSelectVehicle) {
          (marker as unknown as { on: (ev: string, fn: () => void) => void }).on?.(
            "click",
            () => onSelectVehicle(String(p.vehicleId ?? "")),
          );
        }
      } else {
        marker.setLatLng(latLng);
        marker.setIcon?.(icon);
      }
      marker.bindPopup(popupHtml(p));
    }
    for (const [key, marker] of markersRef.current) {
      if (!seen.has(key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    }

    const latlngs = trail.map(
      (p) => [Number(p.latitude), Number(p.longitude)] as [number, number],
    );

    if (latlngs.length >= 2) {
      if (trailRef.current) {
        trailRef.current.setLatLngs(latlngs);
        trailRef.current.setStyle?.({
          color: "#94a3b8",
          weight: 3,
          opacity: 0.55,
        });
      } else {
        trailRef.current = L.polyline(latlngs, {
          color: "#94a3b8",
          weight: 3,
          opacity: 0.55,
        }).addTo(map);
      }
    } else if (trailRef.current) {
      map.removeLayer(trailRef.current);
      trailRef.current = null;
    }

    const idx =
      playheadIndex != null && trail.length
        ? Math.max(0, Math.min(playheadIndex, trail.length - 1))
        : null;

    if (idx != null && latlngs.length >= 1) {
      const played = latlngs.slice(0, idx + 1);
      if (played.length >= 2) {
        if (playedRef.current) {
          playedRef.current.setLatLngs(played);
        } else {
          playedRef.current = L.polyline(played, {
            color: "#0f766e",
            weight: 4,
            opacity: 0.9,
          }).addTo(map);
        }
      } else if (playedRef.current) {
        map.removeLayer(playedRef.current);
        playedRef.current = null;
      }

      const ph = trail[idx];
      const phLl: [number, number] = [
        Number(ph.latitude),
        Number(ph.longitude),
      ];
      const phIcon = L.divIcon({
        className: "",
        html: `<div style="width:16px;height:16px;border-radius:999px;background:#f59e0b;border:2px solid #fff;box-shadow:0 0 0 3px rgba(245,158,11,.35)"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });
      if (!playheadRef.current) {
        playheadRef.current = L.marker(phLl, { icon: phIcon }).addTo(map);
      } else {
        playheadRef.current.setLatLng(phLl);
        playheadRef.current.setIcon?.(phIcon);
      }
      playheadRef.current.bindPopup(popupHtml(ph));
    } else {
      if (playedRef.current) {
        map.removeLayer(playedRef.current);
        playedRef.current = null;
      }
      if (playheadRef.current) {
        map.removeLayer(playheadRef.current);
        playheadRef.current = null;
      }
    }

    const fitKey = fitTrail
      ? `trail:${trail.length}:${trail[0]?.id}:${trail[trail.length - 1]?.id}`
      : `fleet:${selectedVehicleId ?? "all"}:${points.map((p) => p.id).join(",")}`;
    if (fitKey !== lastFitKey.current) {
      lastFitKey.current = fitKey;
      if (fitTrail && latlngs.length >= 2) {
        map.fitBounds(L.latLngBounds(latlngs).pad(0.2));
      } else {
        const focus = points.filter((p) =>
          selectedVehicleId ? String(p.vehicleId) === selectedVehicleId : true,
        );
        const boundsPts = focus.length ? focus : points;
        if (boundsPts.length > 0) {
          map.fitBounds(
            L.latLngBounds(
              boundsPts.map(
                (p) =>
                  [Number(p.latitude), Number(p.longitude)] as [number, number],
              ),
            ).pad(0.35),
          );
        }
      }
    }
  }, [
    points,
    trail,
    mapReady,
    selectedVehicleId,
    onSelectVehicle,
    playheadIndex,
    fitTrail,
  ]);

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[360px] w-full z-0"
      role="img"
      aria-label="Live vehicle map"
    />
  );
}
