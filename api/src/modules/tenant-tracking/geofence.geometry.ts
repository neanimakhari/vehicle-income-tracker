/** Pure geometry helpers for geofence containment (unit-tested). */

export type LatLng = { lat: number; lng: number };

export type GeoJsonPolygon = {
  type: 'Polygon';
  coordinates: number[][][]; // [ [ [lng,lat], ... ] ]
};

export type GeoJsonLineString = {
  type: 'LineString';
  coordinates: number[][]; // [ [lng,lat], ... ]
};

export type GeoJsonPoint = {
  type: 'Point';
  coordinates: [number, number];
};

export type FenceGeoJson =
  | GeoJsonPolygon
  | GeoJsonLineString
  | GeoJsonPoint
  | { type: 'Feature'; geometry: GeoJsonPolygon | GeoJsonLineString | GeoJsonPoint; properties?: Record<string, unknown> };

function toRad(d: number) {
  return (d * Math.PI) / 180;
}

export function haversineM(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(x)));
}

/** Ray-casting point-in-polygon. Ring is [lng,lat][]. */
export function pointInRing(point: LatLng, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > point.lat !== yj > point.lat &&
      point.lng < ((xj - xi) * (point.lat - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function distanceToSegmentM(
  p: LatLng,
  a: LatLng,
  b: LatLng,
): number {
  // Equirectangular projection locally
  const x = toRad(p.lng - a.lng) * Math.cos(toRad((p.lat + a.lat) / 2));
  const y = toRad(p.lat - a.lat);
  const dx = toRad(b.lng - a.lng) * Math.cos(toRad((a.lat + b.lat) / 2));
  const dy = toRad(b.lat - a.lat);
  const L2 = dx * dx + dy * dy;
  let t = L2 === 0 ? 0 : (x * dx + y * dy) / L2;
  t = Math.max(0, Math.min(1, t));
  const proj: LatLng = {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
  return haversineM(p, proj);
}

export function distanceToLineStringM(
  p: LatLng,
  coords: number[][],
): number {
  if (coords.length === 0) return Infinity;
  if (coords.length === 1) {
    return haversineM(p, { lat: coords[0][1], lng: coords[0][0] });
  }
  let min = Infinity;
  for (let i = 1; i < coords.length; i++) {
    const d = distanceToSegmentM(
      p,
      { lat: coords[i - 1][1], lng: coords[i - 1][0] },
      { lat: coords[i][1], lng: coords[i][0] },
    );
    if (d < min) min = d;
  }
  return min;
}

/** Approximate circle as polygon (n sides). */
export function circleToPolygon(
  center: LatLng,
  radiusM: number,
  sides = 32,
): GeoJsonPolygon {
  const coords: number[][] = [];
  const latRad = toRad(center.lat);
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * Math.cos(latRad);
  for (let i = 0; i <= sides; i++) {
    const ang = (2 * Math.PI * i) / sides;
    const dLat = (radiusM * Math.cos(ang)) / mPerDegLat;
    const dLng = (radiusM * Math.sin(ang)) / mPerDegLng;
    coords.push([center.lng + dLng, center.lat + dLat]);
  }
  return { type: 'Polygon', coordinates: [coords] };
}

/** Buffer a polyline into a rough capsule polygon (simple offset). */
export function bufferLineString(
  line: GeoJsonLineString,
  bufferM: number,
): GeoJsonPolygon {
  const pts = line.coordinates;
  if (pts.length < 2) {
    const c = pts[0] ?? [28.05, -26.2];
    return circleToPolygon({ lat: c[1], lng: c[0] }, bufferM);
  }
  // Sample circles along the path and take a convex-ish union via densified outline
  const samples: LatLng[] = [];
  for (let i = 0; i < pts.length; i++) {
    samples.push({ lat: pts[i][1], lng: pts[i][0] });
  }
  // Build left/right offset rings
  const left: number[][] = [];
  const right: number[][] = [];
  for (let i = 0; i < samples.length; i++) {
    const prev = samples[Math.max(0, i - 1)];
    const next = samples[Math.min(samples.length - 1, i + 1)];
    const bearing = Math.atan2(next.lng - prev.lng, next.lat - prev.lat);
    const perp = bearing + Math.PI / 2;
    const latRad = toRad(samples[i].lat);
    const mPerDegLat = 111320;
    const mPerDegLng = Math.max(1e-6, 111320 * Math.cos(latRad));
    const dLat = (bufferM * Math.cos(perp)) / mPerDegLat;
    const dLng = (bufferM * Math.sin(perp)) / mPerDegLng;
    left.push([samples[i].lng + dLng, samples[i].lat + dLat]);
    right.push([samples[i].lng - dLng, samples[i].lat - dLat]);
  }
  const ring = [...left, ...right.reverse()];
  ring.push(ring[0]);
  return { type: 'Polygon', coordinates: [ring] };
}

export function unwrapGeometry(gj: FenceGeoJson): {
  kind: 'polygon' | 'line' | 'point';
  polygon?: GeoJsonPolygon;
  line?: GeoJsonLineString;
  point?: LatLng;
} {
  const g =
    gj && typeof gj === 'object' && 'type' in gj && gj.type === 'Feature'
      ? gj.geometry
      : (gj as GeoJsonPolygon | GeoJsonLineString | GeoJsonPoint);
  if (g.type === 'Polygon') return { kind: 'polygon', polygon: g };
  if (g.type === 'LineString') return { kind: 'line', line: g };
  return {
    kind: 'point',
    point: { lng: g.coordinates[0], lat: g.coordinates[1] },
  };
}

export function pointInFence(
  point: LatLng,
  opts: {
    geojson: FenceGeoJson;
    type: string;
    radiusM?: number | null;
    bufferM?: number | null;
    centerLat?: number | null;
    centerLng?: number | null;
  },
): boolean {
  if (
    opts.centerLat != null &&
    opts.centerLng != null &&
    opts.radiusM != null &&
    opts.radiusM > 0
  ) {
    return (
      haversineM(point, { lat: Number(opts.centerLat), lng: Number(opts.centerLng) }) <=
      Number(opts.radiusM)
    );
  }
  const u = unwrapGeometry(opts.geojson);
  if (u.kind === 'polygon' && u.polygon) {
    const ring = u.polygon.coordinates[0] ?? [];
    return pointInRing(point, ring);
  }
  if (u.kind === 'line' && u.line) {
    const buf = Number(opts.bufferM ?? 200);
    return distanceToLineStringM(point, u.line.coordinates) <= buf;
  }
  if (u.kind === 'point' && u.point) {
    const buf = Number(opts.radiusM ?? opts.bufferM ?? 100);
    return haversineM(point, u.point) <= buf;
  }
  return false;
}

export function normalizeGeoJsonForStorage(input: {
  type: string;
  geojson?: FenceGeoJson | null;
  centerLat?: number | null;
  centerLng?: number | null;
  radiusM?: number | null;
  bufferM?: number | null;
  path?: LatLng[] | null;
}): { geojson: GeoJsonPolygon | GeoJsonLineString; centerLat: number | null; centerLng: number | null } {
  if (input.path && input.path.length >= 2) {
    const line: GeoJsonLineString = {
      type: 'LineString',
      coordinates: input.path.map((p) => [p.lng, p.lat]),
    };
    if (input.type === 'corridor') {
      return {
        geojson: bufferLineString(line, Number(input.bufferM ?? 200)),
        centerLat: input.path[0].lat,
        centerLng: input.path[0].lng,
      };
    }
    return { geojson: line, centerLat: input.path[0].lat, centerLng: input.path[0].lng };
  }
  if (
    input.centerLat != null &&
    input.centerLng != null &&
    input.radiusM != null
  ) {
    return {
      geojson: circleToPolygon(
        { lat: Number(input.centerLat), lng: Number(input.centerLng) },
        Number(input.radiusM),
      ),
      centerLat: Number(input.centerLat),
      centerLng: Number(input.centerLng),
    };
  }
  if (!input.geojson) {
    throw new Error('geojson, path, or center+radius required');
  }
  const u = unwrapGeometry(input.geojson);
  if (u.kind === 'line' && u.line && input.type === 'corridor') {
    return {
      geojson: bufferLineString(u.line, Number(input.bufferM ?? 200)),
      centerLat: u.line.coordinates[0]?.[1] ?? null,
      centerLng: u.line.coordinates[0]?.[0] ?? null,
    };
  }
  if (u.kind === 'polygon' && u.polygon) {
    const c = u.polygon.coordinates[0]?.[0];
    return {
      geojson: u.polygon,
      centerLat: c ? c[1] : null,
      centerLng: c ? c[0] : null,
    };
  }
  if (u.kind === 'line' && u.line) {
    return {
      geojson: u.line,
      centerLat: u.line.coordinates[0]?.[1] ?? null,
      centerLng: u.line.coordinates[0]?.[0] ?? null,
    };
  }
  throw new Error('Unsupported geojson');
}
