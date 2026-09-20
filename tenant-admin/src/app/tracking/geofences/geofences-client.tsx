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

type FenceTemplate = {
  id: string;
  name: string;
  description: string | null;
  kind: string;
  defaultFenceType: string;
  geojson: { type: string; coordinates: unknown };
  bufferM: number | null;
  radiusM: number | null;
  color: string | null;
};

type Vehicle = { id: string; label: string };
type DrawShape = "road" | "area" | "circle";
type LatLng = { lat: number; lng: number };

const CIRCLE_TYPES = ["rank", "depot", "fuel", "forbidden"] as const;
const CLOSE_SNAP_M = 30;

function haversineM(a: LatLng, b: LatLng) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Rough road buffer outline for map preview (matches API idea). */
function previewRoadBuffer(path: LatLng[], bufferM: number): [number, number][] {
  if (path.length < 2) return [];
  const left: [number, number][] = [];
  const right: [number, number][] = [];
  for (let i = 0; i < path.length; i++) {
    const prev = path[Math.max(0, i - 1)];
    const next = path[Math.min(path.length - 1, i + 1)];
    const bearing = Math.atan2(next.lng - prev.lng, next.lat - prev.lat);
    const perp = bearing + Math.PI / 2;
    const latRad = (path[i].lat * Math.PI) / 180;
    const mPerDegLat = 111320;
    const mPerDegLng = Math.max(1e-6, 111320 * Math.cos(latRad));
    const dLat = (bufferM * Math.cos(perp)) / mPerDegLat;
    const dLng = (bufferM * Math.sin(perp)) / mPerDegLng;
    left.push([path[i].lat + dLat, path[i].lng + dLng]);
    right.push([path[i].lat - dLat, path[i].lng - dLng]);
  }
  return [...left, ...right.reverse(), left[0]];
}

function numberedMarkerIcon(L: any, n: number, accent = false) {
  const bg = accent ? "#f59e0b" : "#0d9488";
  return L.divIcon({
    className: "vit-gf-road-marker",
    html: `<div style="
      width:26px;height:26px;border-radius:999px;background:${bg};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font:700 12px/1 system-ui,sans-serif;border:2px solid #fff;
      box-shadow:0 1px 4px rgba(0,0,0,.45)">${n}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

export function GeofencesClient({
  initial,
  initialTemplates,
  vehicles,
}: {
  initial: Fence[];
  initialTemplates: FenceTemplate[];
  vehicles: Vehicle[];
}) {
  const [fences, setFences] = useState(initial);
  const [templates, setTemplates] = useState(initialTemplates);
  const [name, setName] = useState("New road");
  const [drawShape, setDrawShape] = useState<DrawShape>("road");
  const [circleType, setCircleType] =
    useState<(typeof CIRCLE_TYPES)[number]>("depot");
  const [bufferM, setBufferM] = useState(80);
  const [radiusM, setRadiusM] = useState(250);
  const [path, setPath] = useState<LatLng[]>([]);
  const [pathClosed, setPathClosed] = useState(false);
  const [center, setCenter] = useState<LatLng | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0]?.id ?? "");
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const [applyName, setApplyName] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const drawShapeRef = useRef(drawShape);
  const pathRef = useRef(path);
  const pathClosedRef = useRef(pathClosed);

  drawShapeRef.current = drawShape;
  pathRef.current = path;
  pathClosedRef.current = pathClosed;

  const fenceType =
    drawShape === "road" ? "corridor" : drawShape === "area" ? "custom" : circleType;

  const helpText = useMemo(() => {
    if (drawShape === "circle") {
      return center
        ? "Center set — adjust radius, then Save zone"
        : "Click the map once to place the circle center";
    }
    if (drawShape === "road") {
      if (!path.length) {
        return "Click along the road to drop numbered markers (2+). Buffer = road width each side.";
      }
      return `${path.length} marker${path.length === 1 ? "" : "s"} — keep clicking the road, Undo if needed, then Save. No need to close.`;
    }
    if (pathClosed) return `Closed area (${path.length} corners) — ready to save`;
    if (path.length >= 3) {
      return `${path.length} corners — click near #1 (or Close shape) to finish`;
    }
    return path.length
      ? `${path.length} corners — keep clicking around the area`
      : "Click map corners to outline an area (min 3), then close it";
  }, [drawShape, path, pathClosed, center]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await loadLeaflet();
      if (cancelled || !mapRef.current) return;
      const map = L.map(mapRef.current).setView([-26.2041, 28.0473], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
      }).addTo(map);
      const layerGroup = L.layerGroup().addTo(map);
      const draftLayerRef = { current: null as any };
      leafletRef.current = { map, layer: layerGroup, L, draftLayerRef };

      map.on("click", (e: { latlng: { lat: number; lng: number } }) => {
        const p = { lat: e.latlng.lat, lng: e.latlng.lng };
        const mode = drawShapeRef.current;
        if (mode === "circle") {
          setCenter(p);
          setPath([]);
          setPathClosed(false);
          return;
        }
        if (pathClosedRef.current) return;
        const prev = pathRef.current;
        if (mode === "area" && prev.length >= 3) {
          if (haversineM(prev[0], p) <= CLOSE_SNAP_M) {
            setPathClosed(true);
            return;
          }
        }
        setPath((cur) => [...cur, p]);
      });

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
          /* ignore */
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
    const group = L.layerGroup();

    if (drawShape === "road" && path.length >= 1) {
      if (path.length >= 2) {
        const bufRing = previewRoadBuffer(path, bufferM);
        if (bufRing.length) {
          L.polygon(bufRing, {
            color: "#f59e0b",
            weight: 1,
            fillColor: "#f59e0b",
            fillOpacity: 0.18,
            dashArray: "4 4",
          }).addTo(group);
        }
        L.polyline(
          path.map((p) => [p.lat, p.lng]),
          { color: "#0f766e", weight: 4 },
        ).addTo(group);
      }
      path.forEach((p, i) => {
        L.marker([p.lat, p.lng], {
          icon: numberedMarkerIcon(L, i + 1, i === 0),
          interactive: false,
        }).addTo(group);
      });
    } else if (drawShape === "area" && path.length >= 1) {
      if (path.length >= 2) {
        if (pathClosed || path.length >= 3) {
          L.polygon(
            path.map((p) => [p.lat, p.lng]),
            {
              color: "#0d9488",
              weight: 2,
              fillOpacity: pathClosed ? 0.25 : 0.1,
              dashArray: pathClosed ? undefined : "6 4",
            },
          ).addTo(group);
        } else {
          L.polyline(
            path.map((p) => [p.lat, p.lng]),
            { color: "#0d9488", weight: 2, dashArray: "6 4" },
          ).addTo(group);
        }
      }
      path.forEach((p, i) => {
        L.marker([p.lat, p.lng], {
          icon: numberedMarkerIcon(L, i + 1, i === 0),
          interactive: false,
        }).addTo(group);
      });
    } else if (drawShape === "circle" && center) {
      L.circle([center.lat, center.lng], {
        radius: radiusM,
        color: "#0d9488",
      }).addTo(group);
      L.marker([center.lat, center.lng], {
        icon: numberedMarkerIcon(L, 1, true),
        interactive: false,
      }).addTo(group);
    }

    group.addTo(map);
    draftLayerRef.current = group;
  }, [path, pathClosed, center, drawShape, radiusM, bufferM]);

  function clearDraft() {
    setPath([]);
    setPathClosed(false);
    setCenter(null);
  }

  function undoLastMarker() {
    if (pathClosed) {
      setPathClosed(false);
      return;
    }
    setPath((prev) => prev.slice(0, -1));
  }

  function switchShape(next: DrawShape) {
    setDrawShape(next);
    clearDraft();
    if (next === "road") setName((n) => (n === "New zone" || n === "New area" ? "New road" : n));
    if (next === "area") setName((n) => (n === "New road" || n === "New zone" ? "New area" : n));
  }

  function addFenceToMap(fence: Fence) {
    const api = leafletRef.current;
    if (!api || fence.geojson?.type !== "Polygon") return;
    const coords = (fence.geojson.coordinates as number[][][])[0]?.map(
      (c: number[]) => [c[1], c[0]] as [number, number],
    );
    if (!coords?.length) return;
    api.L.polygon(coords, {
      color: fence.color || "#0d9488",
      weight: 2,
      fillOpacity: 0.15,
    })
      .bindPopup(`${fence.name} (${fence.type})`)
      .addTo(api.layer);
  }

  async function createFence() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        name,
        type: fenceType,
        bufferM,
        color: drawShape === "road" ? "#f59e0b" : "#0d9488",
      };
      if (drawShape === "road") {
        if (path.length < 2) {
          throw new Error("Drop at least 2 markers along the road");
        }
        body.path = path;
        body.bufferM = bufferM;
      } else if (drawShape === "area") {
        if (path.length < 3) throw new Error("Need at least 3 corners");
        if (!pathClosed) {
          throw new Error("Close the area (click near marker #1 or Close shape)");
        }
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
      const markerCount = path.length;
      const fence = (await res.json()) as Fence;
      setFences((prev) => [...prev, fence]);
      clearDraft();
      setMessage(
        drawShape === "road"
          ? `Road geofence “${fence.name}” saved (${markerCount} markers, ${bufferM}m buffer each side).`
          : `Saved zone “${fence.name}”.`,
      );
      addFenceToMap(fence);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveAsTemplate() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        name: name || "Template",
        defaultFenceType: fenceType,
        kind: drawShape === "road" ? "corridor" : drawShape === "area" ? "polygon" : "circle",
        color: drawShape === "road" ? "#f59e0b" : "#0d9488",
        bufferM,
      };
      if (drawShape === "road") {
        if (path.length < 2) throw new Error("Drop road markers first");
        body.path = path;
      } else if (drawShape === "area") {
        if (path.length < 3 || !pathClosed) throw new Error("Close an area first");
        body.path = path;
      } else if (center) {
        body.centerLat = center.lat;
        body.centerLng = center.lng;
        body.radiusM = radiusM;
      } else {
        throw new Error("Draw a zone first");
      }
      const res = await fetch("/api/proxy/tenant/tracking/geofences/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Save template failed (${res.status})`);
      const tpl = await res.json();
      setTemplates((prev) => [...prev, tpl]);
      setMessage(`Template “${tpl.name}” saved — Apply it anywhere in this tenant.`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function applyTemplate(id: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const tpl = templates.find((t) => t.id === id);
      const res = await fetch(
        `/api/proxy/tenant/tracking/geofences/templates/${id}/instantiate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: applyName.trim() || `${tpl?.name ?? "Zone"} (copy)`,
            type: tpl?.defaultFenceType,
          }),
        },
      );
      if (!res.ok) throw new Error(`Apply failed (${res.status})`);
      const fence = (await res.json()) as Fence;
      setFences((prev) => [...prev, fence]);
      setApplyName("");
      setMessage(`Applied template as “${fence.name}”.`);
      addFenceToMap(fence);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeTemplate(id: string) {
    setBusy(true);
    try {
      const res = await fetch(`/api/proxy/tenant/tracking/geofences/templates/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error(`Delete template failed (${res.status})`);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
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
      setMessage("Assignments saved.");
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
          Drop numbered markers along a road, outline an area, or place a circle. Save templates and
          apply them anywhere in this tenant.
        </p>
      </div>

      {error ? (
        <p className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-md border border-teal-300 bg-teal-50 px-3 py-2 text-sm text-teal-900 dark:border-teal-900 dark:bg-teal-950/40 dark:text-teal-100">
          {message}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <h2 className="font-medium">Create</h2>

          <div>
            <p className="mb-1.5 text-sm font-medium">What are you drawing?</p>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["road", "Road (markers)"],
                  ["area", "Closed area"],
                  ["circle", "Circle"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => switchShape(id)}
                  className={`rounded-md px-3 py-2 text-sm font-medium ${
                    drawShape === id
                      ? "bg-teal-700 text-white"
                      : "border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <label className="block text-sm">
            Name
            <input
              className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          {drawShape === "circle" ? (
            <label className="block text-sm">
              Zone type
              <select
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={circleType}
                onChange={(e) =>
                  setCircleType(e.target.value as (typeof CIRCLE_TYPES)[number])
                }
              >
                {CIRCLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {drawShape === "road" ? (
            <label className="block text-sm">
              Road buffer each side (m)
              <input
                type="number"
                min={10}
                max={500}
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={bufferM}
                onChange={(e) => setBufferM(Number(e.target.value))}
              />
              <span className="mt-1 block text-xs text-zinc-500">
                How wide the geofence is beside the road (e.g. 50–100 m for a taxi corridor).
              </span>
            </label>
          ) : null}

          {drawShape === "circle" ? (
            <label className="block text-sm">
              Radius (m)
              <input
                type="number"
                className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
                value={radiusM}
                onChange={(e) => setRadiusM(Number(e.target.value))}
              />
            </label>
          ) : null}

          <p className="rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {helpText}
          </p>

          <div className="flex flex-wrap gap-2">
            {drawShape === "area" && path.length >= 3 && !pathClosed ? (
              <button
                type="button"
                className="rounded-md border border-teal-600 px-3 py-2 text-sm text-teal-700 dark:text-teal-300"
                onClick={() => setPathClosed(true)}
              >
                Close shape
              </button>
            ) : null}
            {(drawShape === "road" || drawShape === "area") && path.length > 0 ? (
              <button
                type="button"
                className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
                onClick={undoLastMarker}
              >
                Undo last marker
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              disabled={busy}
              onClick={() => void createFence()}
            >
              Save zone
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              disabled={busy}
              onClick={() => void saveAsTemplate()}
            >
              Save as template
            </button>
            <button
              type="button"
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700"
              onClick={clearDraft}
            >
              Clear draft
            </button>
          </div>
        </div>

        <div
          ref={mapRef}
          className="min-h-[420px] overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
        />
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-1 font-medium">Reusable templates</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Saved roads/areas you can Apply into the library anytime.
        </p>
        <div className="mb-3 flex flex-wrap gap-2">
          <input
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Name when applying…"
            value={applyName}
            onChange={(e) => setApplyName(e.target.value)}
          />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-1 pr-3">Name</th>
                <th className="py-1 pr-3">Kind</th>
                <th className="py-1">Actions</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-3 font-medium">{t.name}</td>
                  <td className="py-2 pr-3">
                    {t.kind} → {t.defaultFenceType}
                  </td>
                  <td className="space-x-3 py-2">
                    <button
                      type="button"
                      className="text-xs text-teal-700 dark:text-teal-300"
                      disabled={busy}
                      onClick={() => void applyTemplate(t.id)}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className="text-xs text-red-600"
                      disabled={busy}
                      onClick={() => void removeTemplate(t.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!templates.length ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-zinc-500">
                    No templates yet — draw a road/area and click Save as template.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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
                      className="text-xs text-red-600"
                      onClick={() => void removeFence(f.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {!fences.length ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-zinc-500">
                    No geofences yet — draw a road with markers on the map.
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
            onChange={(e) => void loadAssignments(e.target.value)}
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
            onClick={() => void saveAssignments()}
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
