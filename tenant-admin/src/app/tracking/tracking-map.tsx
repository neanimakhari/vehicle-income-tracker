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
  engineRpm?: number | null;
  fuelRateLph?: number | null;
  externalVoltage?: number | null;
};

type LeafletNS = {
  map: (el: HTMLElement) => LeafletMap;
  tileLayer: (url: string, opts: Record<string, unknown>) => { addTo: (m: LeafletMap) => void };
  marker: (latLng: [number, number]) => LeafletMarker;
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
};

type LeafletPolyline = {
  addTo: (m: LeafletMap) => LeafletPolyline;
  setLatLngs: (ll: [number, number][]) => void;
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

export function TrackingMap({
  points,
  trail,
}: {
  points: MapPoint[];
  trail: MapPoint[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<Map<string, LeafletMarker>>(new Map());
  const trailRef = useRef<LeafletPolyline | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!containerRef.current || mapRef.current) return;
      try {
        const L = await loadLeaflet();
        if (cancelled || !containerRef.current) return;
        LRef.current = L;
        const map = L.map(containerRef.current).setView([-26.2041, 28.0473], 11);
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
      let marker = markersRef.current.get(key);
      const popup = [
        `<strong>${p.vehicleLabel ?? "Vehicle"}</strong>`,
        `Speed: ${p.speedKph != null ? `${Number(p.speedKph).toFixed(1)} km/h` : "—"}`,
        p.engineRpm != null ? `RPM: ${Number(p.engineRpm).toFixed(0)}` : null,
        p.fuelRateLph != null ? `Fuel: ${Number(p.fuelRateLph).toFixed(1)} L/h` : null,
        new Date(p.recordedAt).toLocaleString(),
      ]
        .filter(Boolean)
        .join("<br/>");
      if (!marker) {
        marker = L.marker(latLng).addTo(map);
        markersRef.current.set(key, marker);
      } else {
        marker.setLatLng(latLng);
      }
      marker.bindPopup(popup);
    }
    for (const [key, marker] of markersRef.current) {
      if (!seen.has(key)) {
        map.removeLayer(marker);
        markersRef.current.delete(key);
      }
    }

    if (trail.length >= 2) {
      const latlngs = [...trail]
        .reverse()
        .map((p) => [Number(p.latitude), Number(p.longitude)] as [number, number]);
      if (trailRef.current) {
        trailRef.current.setLatLngs(latlngs);
      } else {
        trailRef.current = L.polyline(latlngs, {
          color: "#0f766e",
          weight: 3,
          opacity: 0.7,
        }).addTo(map);
      }
    } else if (trailRef.current) {
      map.removeLayer(trailRef.current);
      trailRef.current = null;
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(
        points.map((p) => [Number(p.latitude), Number(p.longitude)] as [number, number]),
      );
      map.fitBounds(bounds.pad(0.2));
    }
  }, [points, trail, mapReady]);

  return (
    <div
      ref={containerRef}
      className="h-[420px] w-full rounded-lg border border-zinc-200 dark:border-zinc-700 z-0"
      role="img"
      aria-label="Live vehicle map"
    />
  );
}
