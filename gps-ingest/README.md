# gps-ingest

Private TCP sidecar that accepts brand-agnostic GPS/OBD lines and forwards them to Nest:

`POST /v1/internal/tracking/ingest` with header `x-ingest-secret`.

## Run locally

```bash
export API_BASE_URL=http://127.0.0.1:3000
export GPS_INGEST_SECRET=local-dev-ingest-secret
node src/server.js
```

Health: `http://127.0.0.1:9088/health`

## Mock simulator

Bind an IMEI in tenant-admin first, then:

```bash
IMEI=356938035643809 PROFILE=obd npm run simulate
```

## Line formats

JSON:

```json
{"imei":"...","lat":-26.2,"lng":28.0,"speed":40,"heading":90,"rpm":2000,"fuelRate":3.1,"fuelPct":70,"voltage":13.6}
```

CSV: `imei,lat,lng,speed,heading,ignition,rpm,fuelRate,fuelPct,voltage`

Bind TCP to localhost / private network only in production.
