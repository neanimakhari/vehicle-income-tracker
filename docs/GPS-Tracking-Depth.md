# GPS tracking depth (PostGIS + Timescale + OBD + commercial submodules)

Branch: `feature/gps-tracking-postgis-timescale` (merged); geofencing on `feature/tracking-geofence`; Micodus ingest on `feature/micodus-gps-ingest`.

## What shipped

- Migration `1700000000039`: PostGIS/Timescale best-effort, `parent_key` on feature modules, submodules `tracking_history|obd|geofence|alerts`, `platform.tracker_devices`, OBD columns + optional geography on tenant `gps_tracking_points`, `vehicles.tracker_imei`
- Nest `TenantTrackingModule`: latest/history/metrics, simulate (basic|obd), IMEI bind/unbind/active, WS `/tracking`, internal ingest
- Tenant-admin `/tracking`: Leaflet+OSM map, POPIA ack, simulate, IMEI bind, submodule upsell
- `gps-ingest/` TCP sidecar: text mocks (5023) + **Micodus Huabao/JT808** (7700) with ACK-first coalesce → Nest
- Migration `1700000000040`: `vehicle_tracking_daily` + `vehicle_day_reconciliation`
- Migration `1700000000041`: geofences, assignments, events, state, daily geofence rollups, alert rules

## Deploy notes

1. Set `GPS_INGEST_SECRET` on API + gps-ingest (same value).
2. Run migrations on **DB host** (not app droplet if split): `npm run migration:run:prod`
3. If PostGIS/Timescale packages missing, migration continues with btree indexes only — install extensions on DB when ready and re-run or apply geography/hypertable manually.
4. Text TCP `5023` stays `127.0.0.1` only. Micodus TCP `7700` is published for cellular devices — open UFW `7700/tcp` when ready.
5. Entitle tenants: parent `tracking_live` plus optional children.

## Capacity (fleet)

- Nest keeps at most **one point / vehicle / 5s**.
- gps-ingest **ACKs Micodus immediately**, skips Nest for heartbeat/login, and **coalesces** location per IMEI (`INGEST_FLUSH_MS`, default 5s).
- Prefer device report interval **10–30s** via SMS timer.
- Watch `/health`: `micodusActive`, `queueDepth`, `coalesce.flushed|droppedStale|apiErrors`.

## Local demo

1. Enable modules for tenant (pro plan includes them after migration).
2. Open Live Tracking → POPIA → bind a real IMEI (or set `TRACKING_SIMULATE_ENABLED=true` for lab-only simulate).
3. Optional: `cd gps-ingest && GPS_INGEST_SECRET=... node src/server.js` then `IMEI=... npm run simulate` (engineering only).
4. Micodus unit tests: `cd gps-ingest && npm test`.

## Micodus depth (alarms + events)

Migration `1700000000043`:

- Extra point columns: `alarm_flags`, `alarm_ext`, `gsm_signal`, `msg_id`, `can_odometer_km`, `can_speed_kph`
- `tracking_events` stream (engine start/stop, overspeed, power/low voltage, GPS lost/fix, device alarm bits, offline)
- Settings: `overspeed_kph` (default 60), `low_voltage_threshold`, `offline_minutes`, `idle_alert_minutes`
- Live ingest sets `overspeed` from tenant speed limit **and** JT808 alarm bits 1/13
- Alert rule triggers expanded: `overspeed`, `engine_start`, `engine_stop`, `power_loss`, `low_voltage`, `offline`
- WS event `tracking:alert`; API `GET /tenant/tracking/events`
- Offline cron every 5 minutes (uses `tracker_devices.last_seen_at`; heartbeats call `POST /v1/internal/tracking/device-seen`)
- Alert emails go to **tenant report recipients** (ops fallback if none)
- Trips & parking: `GET /tenant/tracking/trips-report` + UI `/tracking/trips`
- Simulation is **opt-in** (`TRACKING_SIMULATE_ENABLED=true`); default off in compose

### Device commands (Phase 5 downlink)

- gps-ingest keeps a live Micodus session registry and accepts `POST /internal/command` (shared `GPS_INGEST_SECRET`)
- Nest: `POST /tenant/tracking/devices/:imei/command` → gps-ingest (`GPS_INGEST_COMMAND_URL`, default `http://gps-ingest:9088`)
- JT808 `0x8300` text (Micodus SMS-style: `SPEED`, `TIMER`, `SENALM`, `ACCALM`, `PWRALM`, `STATUS`, `MILEAGE`) and `0x8103` params (max speed / intervals)
- Offline commands are queued briefly and flushed on reconnect; audited as `TRACKING_DEVICE_COMMAND`
- Tenant-admin Live Tracking shows a Device commands strip when an IMEI is bound

### Enable device-side alarm bits (SMS on unit, one-time)

So JT808 alarm DWORD bits actually fire (not only server overspeed):

```
SPEED,80#
ACCALM,1#
PWRALM,1#
SENALM,1#
```

Capability notes:

- GPS + ACC + voltage + odometer work on third-party JT808 today
- Full CAN (RPM/coolant/fuel rate) fills dynamically when tags `0x81+` appear
- Capacitive fuel / Micodus cloud-only instrument panels need hardware or vendor path

## Micodus MV55G onboarding

1. Bind IMEI (or JT808 terminal ID the unit sends) in tenant-admin → vehicle.
2. Micro SIM + carrier APN SMS.
3. `SERVER,0,<droplet-public-ip>,7700#`
4. Confirm live map / WS; if decode fails, check gps-ingest logs for hex dumps.
5. Optional: Micodus vendor app for side-by-side on the first unit only.

## Tracker analytics + day reconciliation

Split surfaces (do not mix in one endpoint):

1. **Tracker analytics** (`GET /tenant/tracking/analytics`) — GPS/OBD-only daily KPIs from `vehicle_tracking_daily`.
2. **Day reconciliation** (`GET /tenant/tracking/reconciliation`) — income log vs tracker for the same Johannesburg calendar day.

Heavy math runs offline via Nest cron; live map / income submit stay insert-only.

UI: `/tracking/analytics`, `/tracking/reconciliation`.

### Route playback + gauges

- Live Tracking: **Live | Playback** toggle; day load via `history?from=&to=&limit=2000`; scrubber + playhead; speed-vs-time chart; SVG dials for present values only.
- Trips page: Day / segment **Replay** deep-links into Playback.
- History API returns chronological points; recent (no range) still newest-first then reversed.
## Geofencing

Modules: `tracking_geofence`, `tracking_alerts` (parent `tracking_live`).

- Zone types: rank, depot, fuel, forbidden, custom, corridor (polyline + buffer)
- Assign per vehicle (different routes get different corridors)
- Enter/exit evaluation on ingest with hysteresis; WS event `tracking:geofence`
- Daily `vehicle_geofence_daily` (rank dwell, off-corridor km, after-hours outside home)
- Alert rules + fires under `/tenant/tracking/alert-rules`

UI: `/tracking/geofences`, `/tracking/geofences/events`, `/tracking/alerts`.
