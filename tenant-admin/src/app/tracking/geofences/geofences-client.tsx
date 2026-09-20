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

const TYPES = ["rank", "depot", "fuel", "forbidden", "custom", "corridor"] as const;
const CLOSE_SNAP_M = 30;

function isCircleType(t: string) {
  return t === "rank" || t === "depot" || t === "fuel" || t === "forbidden";
}

function haversineM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
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
  const [name, setName] = useState("New zone");
  const [type, setType] = useState<(typeof TYPES)[number]>("custom");
  const [bufferM, setBufferM] = useState(200);
  const [radiusM, setRadiusM] = useState(250);
  const [path, setPath] = useState<Array<{ lat: number; lng: number }>>([]);
  const [pathClosed, setPathClosed] = useState(false);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState(vehicles[0]?.id ?? "");
  const [assignIds, setAssignIds] = useState<string[]>([]);
  const [applyName, setApplyName] = useState("");
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletRef = useRef<any>(null);
  const typeRef = useRef(type);
  const pathRef = useRef(path);
  const pathClosedRef = useRef(pathClosed);

  typeRef.current = type;
  pathRef.current = path;
  pathClosedRef.current = pathClosed;

  const drawMode = useMemo(() => {
    if (type === "corridor") return "corridor" as const;
    if (type === "custom") return "polygon" as const;
    return "circle" as const;
  }, [type]);

  const pathLabel = useMemo(() => {
    if (drawMode === "circle") {
      return center ? "Center set — adjust radius and save" : "Click map for center";
    }
    if (drawMode === "corridor") {
      return path.length
        ? `${path.length} points — click to extend, then Save zone`
        : "Click map to draw corridor path";
    }
    if (pathClosed) return `Closed polygon (${path.length} vertices) — ready to save`;
    if (path.length >= 3) {
      return `${path.length} points — click near first point (or Close shape) to finish`;
    }
    return path.length
      ? `${path.length} points — keep clicking`
      : "Click map to start polygon (min 3 points)";
  }, [drawMode, path, pathClosed, center]);

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
        const t = typeRef.current;
        if (isCircleType(t)) {
          setCenter(p);
          setPath([]);
          setPathClosed(false);
          return;
        }
        if (pathClosedRef.current) return;
        const prev = pathRef.current;
        if (t === "custom" && prev.length >= 3) {
          const d = haversineM(prev[0], p);
          if (d <= CLOSE_SNAP_M) {
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
    if (drawMode === "corridor" && path.length >= 2) {
      L.polyline(
        path.map((p) => [p.lat, p.lng]),
        { color: "#f59e0b", weight: 3 },
      ).addTo(group);
    } else if (drawMode === "polygon" && path.length >= 1) {
      if (path.length >= 2) {
        const pts = pathClosed
          ? [...path.map((p) => [p.lat, p.lng] as [number, number]), [path[0].lat, path[0].lng]]
          : path.map((p) => [p.lat, p.lng] as [number, number]);
        if (pathClosed || path.length >= 3) {
          L.polygon(path.map((p) => [p.lat, p.lng]), {
            color: "#0d9488",
            weight: 2,
            fillOpacity: pathClosed ? 0.25 : 0.1,
            dashArray: pathClosed ? undefined : "6 4",
          }).addTo(group);
        } else {
          L.polyline(pts, { color: "#0d9488", weight: 2, dashArray: "6 4" }).addTo(group);
        }
      }
      for (let i = 0; i < path.length; i++) {
        L.circleMarker([path[i].lat, path[i].lng], {
          radius: i === 0 ? 7 : 4,
          color: i === 0 ? "#f59e0b" : "#0d9488",
          fillColor: i === 0 ? "#f59e0b" : "#0d9488",
          fillOpacity: 1,
        }).addTo(group);
      }
    } else if (drawMode === "circle" && center) {
      L.circle([center.lat, center.lng], {
        radius: radiusM,
        color: "#0d9488",
      }).addTo(group);
    }
    group.addTo(map);
    draftLayerRef.current = group;
  }, [path, pathClosed, center, drawMode, radiusM]);

  function clearDraft() {
    setPath([]);
    setPathClosed(false);
    setCenter(null);
  }

  async function createFence() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const body: Record<string, unknown> = { name, type, bufferM, color: "#0d9488" };
      if (type === "corridor") {
        if (path.length < 2) throw new Error("Draw at least 2 corridor points");
        body.path = path;
      } else if (type === "custom") {
        if (path.length < 3) throw new Error("Draw at least 3 polygon points");
        if (!pathClosed) throw new Error("Close the shape (click near first point or Close shape)");
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
      clearDraft();
      setMessage(`Saved zone “${fence.name}”.`);
      // redraw library layer by adding polygon
      const api = leafletRef.current;
      if (api && fence.geojson?.type === "Polygon") {
        const coords = (fence.geojson.coordinates as number[][][])[0]?.map(
          (c: number[]) => [c[1], c[0]] as [number, number],
        );
        if (coords?.length) {
          api.L.polygon(coords, {
            color: fence.color || "#0d9488",
            weight: 2,
            fillOpacity: 0.15,
          })
            .bindPopup(`${fence.name} (${fence.type})`)
            .addTo(api.layer);
        }
      }
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
        defaultFenceType: type,
        kind: type === "corridor" ? "corridor" : type === "custom" ? "polygon" : "circle",
        color: "#0d9488",
        bufferM,
      };
      if (type === "corridor") {
        if (path.length < 2) throw new Error("Draw a corridor path first");
        body.path = path;
      } else if (type === "custom") {
        if (path.length < 3 || !pathClosed) {
          throw new Error("Close a polygon first (min 3 points)");
        }
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
      setMessage(`Template “${tpl.name}” saved — apply it anywhere in this tenant.`);
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
      const fence = await res.json();
      setFences((prev) => [...prev, fence]);
      setApplyName("");
      setMessage(`Applied template as “${fence.name}” in your library.`);
      const api = leafletRef.current;
      if (api && fence.geojson?.type === "Polygon") {
        const coords = (fence.geojson.coordinates as number[][][])[0]?.map(
          (c: number[]) => [c[1], c[0]] as [number, number],
        );
        if (coords?.length) {
          api.L.polygon(coords, {
            color: fence.color || "#0d9488",
            weight: 2,
            fillOpacity: 0.15,
          })
            .bindPopup(`${fence.name} (${fence.type})`)
            .addTo(api.layer);
        }
      }
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
          Draw circles, corridors, or closed polygons. Save templates and apply them anywhere in
          this tenant.
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
                clearDraft();
              }}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "custom" ? "custom (polygon)" : t}
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
          ) : type !== "custom" ? (
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
          <p className="text-xs text-zinc-500">{pathLabel}</p>
          <div className="flex flex-wrap gap-2">
            {type === "custom" && path.length >= 3 && !pathClosed ? (
              <button
                type="button"
                className="rounded-md border border-teal-600 px-3 py-2 text-sm text-teal-700 dark:text-teal-300"
                onClick={() => setPathClosed(true)}
              >
                Close shape
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
          className="min-h-[360px] overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
        />
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="mb-1 font-medium">Reusable templates</h2>
        <p className="mb-3 text-xs text-zinc-500">
          Saved shapes you can apply into the library anytime (same geometry, new zone name).
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
                  <td className="py-2 space-x-3">
                    <button
                      type="button"
                      className="text-teal-700 text-xs dark:text-teal-300"
                      disabled={busy}
                      onClick={() => void applyTemplate(t.id)}
                    >
                      Apply
                    </button>
                    <button
                      type="button"
                      className="text-red-600 text-xs"
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
                    No templates yet — draw a zone and click Save as template.
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
                      className="text-red-600 text-xs"
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
