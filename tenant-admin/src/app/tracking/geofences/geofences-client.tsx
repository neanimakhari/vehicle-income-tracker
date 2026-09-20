"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Fence = {
  id: string;
  name: string;
  type: string;
  color: string | null;
  bufferM: number | null;
  radiusM: number | null;
  centerLat: number | null;
  centerLng: number | null;
  geojson: { type: string; coordinates: unknown };
  isActive: boolean;
};

type Vehicle = { id: string; label: string };

const TYPES = ["rank", "depot", "fuel", "forbidden", "custom", "corridor"] as const;

export function GeofencesClient({
  initial,
  vehicles,
}: {
  initial: Fence[];
  vehicles: Vehicle[];
}) {
  const [fences, setFences] = useState(initial);
  const [name, setName] = useState("New zone");
  const [type, setType] = useState<(typeof TYPES)[number]>("rank");
  const [bufferM, setBufferM] = useState(200);
  const [radiusM, setRadiusM] = useState(250);
  const [path, setPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0]?.id ?? "");
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);

  const pathLabel = useMemo(
    () => (path.length ? `${path.length} points` : "Click map to draw"),
    [path],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current) return;
      const map = L.map(mapRef.current).setView([-26.2041, 28.0473], 12);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      const layerGroup = L.layerGroup().addTo(map);
      const draftLayerRef = { current: null as any };
      leafletRef.current = { map, layer: layerGroup, L, draftLayerRef };

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        if (type === "corridor" || type === "custom") {
          setPath((prev) => [...prev, p]);
        } else {
          setCenter(p);
        }
      });

      // draw existing fences
      for (const f of fences) {
        try {
          if (f.geojson?.type === "Polygon") {
            const coords = (f.geojson.coordinates as number[][][])[0]?.map(
              (c) => [c[1], c[0]] as [number, number],
            );
            if (coords?.length) {
              L.polygon(coords, {
                color: f.color || "#0d9488",
                weight: 2,
                fillOpacity: 0.15,
              })
                .bindPopup(`${f.name} (${f.type})`)
                .addTo(layerGroup);
            }
          }
        } catch {
          /* ignore bad geom */
        }
      }
    })();
    return () => {
      cancelled = true;
      leafletRef.current?.map.remove();
      leafletRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const api = leafletRef.current as any;
    if (!api) return;
    const { L, map, draftLayerRef } = api;
    if (draftLayerRef.current) {
      try {
        map.removeLayer(draftLayerRef.current);
      } catch {
        /* ignore */
      }
      draftLayerRef.current = null;
    }
    if (type === "corridor" && path.length >= 2) {
      const line = L.polyline(
        path.map((p: { lat: number; lng: number }) => [p.lat, p.lng]),
        { color: "#f59e0b", weight: 3 },
      );
      line.addTo(map);
      draftLayerRef.current = line;
    } else if (center && type !== "corridor") {
      const circle = L.circle([center.lat, center.lng], {
        radius: radiusM,
        color: "#0d9488",
      });
      circle.addTo(map);
      draftLayerRef.current = circle;
    }
  }, [path, center, type, radiusM]);

  async function createFence() {
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name, type, bufferM, color: "#0d9488" };
      if (type === "corridor") {
        if (path.length < 2) throw new Error("Draw at least 2 corridor points");
        body.path = path;
      } else if (center) {
        body.centerLat = center.lat;
        body.centerLng = center.lng;
        body.radiusM = radiusM;
      } else {
        throw new Error("Click the map to set a center");
      }
      const res = await fetch("/api/proxy/tenant/tracking/geofences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Create failed (${res.status})`);
      const fence = await res.json();
      setFences((prev) => [...prev, fence]);
      setPath([]);
      setCenter(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeFence(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/proxy/tenant/tracking/geofences/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Delete failed (${res.status})`);
      setFences((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAssignments() {
    if (!selectedVehicle) return;
    setBusy(true);
    setError(null);
    try {
      const assignments = assignIds.map((geofenceId) => {
        const fence = fences.find((f) => f.id === geofenceId);
        const role =
          fence?.type === "corridor"
            ? "corridor"
            : fence?.type === "depot"
              ? "home"
              : fence?.type === "rank"
                ? "work_rank"
                : fence?.type === "forbidden"
                  ? "forbidden"
                  : "watch";
        return {
          geofenceId,
          role,
          isRequiredCorridor: fence?.type === "corridor",
        };
      });
      const res = await fetch(
        `/api/proxy/tenant/tracking/geofences/vehicles/${selectedVehicle}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignments }),
        },
      );
      if (!res.ok) throw new Error(`Assign failed (${res.status})`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function loadAssignments(vehicleId: string) {
    setSelectedVehicle(vehicleId);
    const res = await fetch(
      `/api/proxy/tenant/tracking/geofences/vehicles/${vehicleId}`,
    );
    if (!res.ok) return;
    const rows = await res.json();
    setAssignIds(rows.map((r: { geofenceId: string }) => r.geofenceId));
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Geofences</p>
        <h1 className="text-2xl font-semibold">Zones & corridors</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Draw ranks, depots, and per-route corridors. Assign them to vehicles with different routes.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-medium">Create</h2>
          <label className="block text-sm">
            Name
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="block text-sm">
            Type
            <select
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              value={type}
              onChange={(e) => {
                setType(e.target.value as (typeof TYPES)[number]);
                setPath([]);
                setCenter(null);
              }}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          {type === "corridor" ? (
            <label className="block text-sm">
              Buffer (m)
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={bufferM}
                onChange={(e) => setBufferM(Number(e.target.value))}
              />
            </label>
          ) : (
            <label className="block text-sm">
              Radius (m)
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={radiusM}
                onChange={(e) => setRadiusM(Number(e.target.value))}
              />
            </label>
          )}
          <p className="text-xs text-zinc-500">
            {type === "corridor" ? pathLabel : center ? "Center set" : "Click map for center"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              disabled={busy}
              onClick={createFence}
            >
              Save zone
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              onClick={() => {
                setPath([]);
                setCenter(null);
              }}
            >
              Clear draft
            </button>
          </div>
        </div>

        <div
          ref={mapRef}
          className="min-h-[360px] overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
        />
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 font-medium">Library</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1 pr-3">Name</th>
                <th className="py-1 pr-3">Type</th>
                <th className="py-1 pr-3">Buffer/R</th>
                <th className="py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {fences.map((f) => (
                <tr key={f.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-3 font-medium">{f.name}</td>
                  <td className="py-2 pr-3">{f.type}</td>
                  <td className="py-2 pr-3">{f.bufferM ?? f.radiusM ?? "—"}</td>
                  <td className="py-2">
                    <button
                      type="button"
                      className="text-red-600 text-xs"
                      onClick={() => removeFence(f.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!fences.length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-zinc-500">
                    No geofences yet — draw one on the map.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-3 font-medium">Assign to vehicle</h2>
        <div className="flex flex-wrap gap-3">
          <select
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={selectedVehicle}
            onChange={(e) => loadAssignments(e.target.value)}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="rounded-md bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-50"
            disabled={busy || !selectedVehicle}
            onClick={saveAssignments}
          >
            Save assignments
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {fences.map((f) => {
            const on = assignIds.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() =>
                  setAssignIds((prev) =>
                    on ? prev.filter((id) => id !== f.id) : [...prev, f.id],
                  )
                }
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  on
                    ? "bg-teal-700 text-white"
                    : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                }`}
              >
                {f.name} · {f.type}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    if ((window as any).L) {
      resolve((window as any).L);
      return;
    }
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.onload = () => resolve((window as any).L);
    s.onerror = () => reject(new Error("Leaflet failed to load"));
    document.body.appendChild(s);
  });
}
