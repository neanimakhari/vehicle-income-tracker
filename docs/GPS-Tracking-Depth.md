# GPS tracking depth (PostGIS + Timescale + OBD + commercial submodules)

Branch: `feature/gps-tracking-postgis-timescale`

## What shipped

- Migration `1700000000039`: PostGIS/Timescale best-effort, `parent_key` on feature modules, submodules `tracking_history|obd|geofence|alerts`, `platform.tracker_devices`, OBD columns + optional geography on tenant `gps_tracking_points`, `vehicles.tracker_imei`
- Nest `TenantTrackingModule`: latest/history/metrics, simulate (basic|obd), IMEI bind/unbind/active, WS `/tracking`, internal ingest
- Tenant-admin `/tracking`: Leaflet+OSM map, POPIA ack, simulate, IMEI bind, submodule upsell
- `gps-ingest/` TCP sidecar + mock simulator (localhost-bound in compose)

## Deploy notes

1. Set `GPS_INGEST_SECRET` on API + gps-ingest (same value).
2. Run migrations on **DB host** (not app droplet if split): `npm run migration:run:prod`
3. If PostGIS/Timescale packages missing, migration continues with btree indexes only — install extensions on DB when ready and re-run or apply geography/hypertable manually.
4. Do **not** publish TCP `5023` publicly; compose binds `127.0.0.1` only.
5. Entitle tenants: parent `tracking_live` plus optional children.

## Local demo

1. Enable modules for tenant (pro plan includes them after migration).
2. Open Live Tracking → POPIA → Simulate.
3. Optional: `cd gps-ingest && GPS_INGEST_SECRET=... node src/server.js` then `IMEI=... npm run simulate`.
