import {
  bufferLineString,
  circleToPolygon,
  haversineM,
  normalizeGeoJsonForStorage,
  pathToClosedPolygon,
  pointInFence,
  pointInRing,
} from './geofence.geometry';

describe('geofence.geometry', () => {
  it('detects point inside square polygon', () => {
    const ring = [
      [28.0, -26.2],
      [28.1, -26.2],
      [28.1, -26.1],
      [28.0, -26.1],
      [28.0, -26.2],
    ];
    expect(pointInRing({ lat: -26.15, lng: 28.05 }, ring)).toBe(true);
    expect(pointInRing({ lat: -26.3, lng: 28.05 }, ring)).toBe(false);
  });

  it('circle containment via radius', () => {
    const inside = pointInFence(
      { lat: -26.2041, lng: 28.0473 },
      {
        type: 'depot',
        geojson: circleToPolygon({ lat: -26.2041, lng: 28.0473 }, 500),
        centerLat: -26.2041,
        centerLng: 28.0473,
        radiusM: 500,
      },
    );
    const outside = pointInFence(
      { lat: -26.25, lng: 28.1 },
      {
        type: 'depot',
        geojson: circleToPolygon({ lat: -26.2041, lng: 28.0473 }, 500),
        centerLat: -26.2041,
        centerLng: 28.0473,
        radiusM: 500,
      },
    );
    expect(inside).toBe(true);
    expect(outside).toBe(false);
  });

  it('corridor buffer contains nearby points', () => {
    const line = {
      type: 'LineString' as const,
      coordinates: [
        [28.04, -26.21],
        [28.06, -26.2],
        [28.08, -26.19],
      ],
    };
    const poly = bufferLineString(line, 300);
    const onPath = pointInFence(
      { lat: -26.2, lng: 28.06 },
      { type: 'corridor', geojson: poly, bufferM: 300 },
    );
    expect(onPath).toBe(true);
    expect(haversineM({ lat: -26.2, lng: 28.06 }, { lat: -26.2, lng: 28.06 })).toBe(0);
  });

  it('pathToClosedPolygon closes the ring', () => {
    const poly = pathToClosedPolygon([
      { lat: -26.2, lng: 28.04 },
      { lat: -26.2, lng: 28.05 },
      { lat: -26.21, lng: 28.05 },
    ]);
    const ring = poly.coordinates[0];
    expect(ring.length).toBe(4);
    expect(ring[0]).toEqual(ring[ring.length - 1]);
  });

  it('normalize path ≥3 non-corridor becomes polygon', () => {
    const out = normalizeGeoJsonForStorage({
      type: 'custom',
      path: [
        { lat: -26.2, lng: 28.04 },
        { lat: -26.2, lng: 28.05 },
        { lat: -26.21, lng: 28.05 },
        { lat: -26.21, lng: 28.04 },
      ],
    });
    expect(out.geojson.type).toBe('Polygon');
  });
});
