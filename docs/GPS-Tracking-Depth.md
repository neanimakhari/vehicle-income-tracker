# GPS tracking depth (PostGIS + Timescale + OBD + commercial submodules)

Branch: `feature/gps-tracking-postgis-timescale` (merged); geofencing on `feature/tracking-geofence`.

## What shipped

- Migration `1700000000039`: PostGIS/Timescale best-effort, `parent_key` on feature modules, submodules `tracking_history|obd|geofence|alerts`, `platform.tracker_devices`, OBD columns + optional geography on tenant `gps_tracking_points`, `vehicles.tracker_imei`
- Nest `TenantTrackingModule`: latest/history/metrics, simulate (basic|obd), IMEI bind/unbind/active, WS `/tracking`, internal ingest
- Tenant-admin `/tracking`: Leaflet+OSM map, POPIA ack, simulate, IMEI bind, submodule upsell
- `gps-ingest/` TCP sidecar + mock simulator (localhost-bound in compose)
- Migration `1700000000040`: `vehicle_tracking_daily` + `vehicle_day_reconciliation`
- Migration `1700000000041`: geofences, assignments, events, state, daily geofence rollups, alert rules

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

## Tracker analytics + day reconciliation

Split surfaces (do not mix in one endpoint):

1. **Tracker analytics** (`GET /tenant/tracking/analytics`) — GPS/OBD-only daily KPIs from `vehicle_tracking_daily`.
2. **Day reconciliation** (`GET /tenant/tracking/reconciliation`) — income log vs tracker for the same Johannesburg calendar day.

Heavy math runs offline via Nest cron; live map / income submit stay insert-only.

UI: `/tracking/analytics`, `/tracking/reconciliation`.

## Geofencing

Modules: `tracking_geofence`, `tracking_alerts` (parent `tracking_live`).

- Zone types: rank, depot, fuel, forbidden, custom, corridor (polyline + buffer)
- Assign per vehicle (different routes get different corridors)
- Enter/exit evaluation on ingest with hysteresis; WS event `tracking:geofence`
- Daily `vehicle_geofence_daily` (rank dwell, off-corridor km, after-hours outside home)
- Alert rules + fires under `/tenant/tracking/alert-rules`

UI: `/tracking/geofences`, `/tracking/geofences/events`, `/tracking/alerts`.
