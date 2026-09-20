# gps-ingest

Private TCP sidecar that accepts GPS/OBD data and forwards to Nest:

`POST /v1/internal/tracking/ingest` with header `x-ingest-secret`.

## Listeners

| Port | Env | Protocol | Audience |
|------|-----|----------|----------|
| 5023 | `TRACKING_TCP_PORT` | Newline JSON/CSV | Mocks / lab |
| 7700 | `MICODUS_TCP_PORT` | Micodus Huabao/JT808 binary | Real MV55G devices |
| 9088 | `HEALTH_PORT` | HTTP `/health` | Ops |

Micodus path is **ACK-first**: the device gets a protocol ACK immediately. Location points are **coalesced per IMEI** (latest wins) and flushed every `INGEST_FLUSH_MS` (default 5000) so a chatty fleet does not hammer Nest.

## Run locally

```bash
export API_BASE_URL=http://127.0.0.1:3000
export GPS_INGEST_SECRET=local-dev-ingest-secret
node src/server.js
```

Health: `http://127.0.0.1:9088/health`

## Mock simulator (text TCP)

Bind an IMEI in tenant-admin first, then:

```bash
IMEI=356938035643809 PROFILE=obd npm run simulate
```

## Line formats (port 5023)

JSON:

```json
{"imei":"...","lat":-26.2,"lng":28.0,"speed":40,"heading":90,"rpm":2000,"fuelRate":3.1,"fuelPct":70,"voltage":13.6}
```

CSV: `imei,lat,lng,speed,heading,ignition,rpm,fuelRate,fuelPct,voltage`

## Micodus MV55G (port 7700)

1. Bind the device IMEI (or terminal ID the unit sends in the JT808 header) in tenant-admin.
2. Insert Micro SIM; set APN via SMS for your SA carrier.
3. Point the unit at this host: `SERVER,0,<public-ip>,7700#`
4. Prefer a 10–30s report interval (SMS timer) — Nest already keeps at most one point / vehicle / 5s.
5. Watch `/health` for `micodusActive`, `queueDepth`, `coalesce.*`.

Keep text port **5023** on localhost only. Publish **7700** only when ready for cellular devices (UFW + droplet firewall).

## Tests

```bash
npm test
```
