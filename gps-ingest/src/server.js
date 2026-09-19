/**
 * Private TCP GPS ingest sidecar.
 * Listens on TRACKING_TCP_PORT (default 5023), parses brand-agnostic lines,
 * POSTs to Nest /v1/internal/tracking/ingest with GPS_INGEST_SECRET.
 *
 * Line formats accepted:
 *   JSON: {"imei":"...","lat":-26.2,"lng":28.0,"speed":42,"heading":90,...}
 *   CSV:  imei,lat,lng,speed,heading,ignition,rpm,fuelRate,fuelPct,voltage
 */

const net = require("net");
const http = require("http");

const TCP_PORT = Number(process.env.TRACKING_TCP_PORT ?? 5023);
const HEALTH_PORT = Number(process.env.HEALTH_PORT ?? 9088);
const API_BASE = (process.env.API_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const INGEST_SECRET = process.env.GPS_INGEST_SECRET ?? process.env.TRACKING_INGEST_SECRET ?? "";
const BIND_HOST = process.env.TRACKING_TCP_BIND ?? "127.0.0.1";

const stats = {
  startedAt: new Date().toISOString(),
  tcpAccepted: 0,
  linesParsed: 0,
  ingestOk: 0,
  ingestFail: 0,
  lastError: null,
  lastIngestAt: null,
};

function parseLine(raw) {
  const line = String(raw).trim();
  if (!line) return null;
  if (line.startsWith("{")) {
    const j = JSON.parse(line);
    const imei = String(j.imei ?? j.deviceId ?? "").trim();
    const latitude = Number(j.lat ?? j.latitude);
    const longitude = Number(j.lng ?? j.lon ?? j.longitude);
    if (!imei || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("invalid json point");
    }
    return {
      imei,
      latitude,
      longitude,
      speedKph: j.speed != null ? Number(j.speed) : j.speedKph != null ? Number(j.speedKph) : undefined,
      heading: j.heading != null ? Number(j.heading) : undefined,
      ignitionOn: j.ignition != null ? Boolean(j.ignition) : j.ignitionOn,
      engineRpm: j.rpm != null ? Number(j.rpm) : j.engineRpm != null ? Number(j.engineRpm) : undefined,
      fuelRateLph: j.fuelRate != null ? Number(j.fuelRate) : j.fuelRateLph != null ? Number(j.fuelRateLph) : undefined,
      fuelLevelPercent:
        j.fuelPct != null ? Number(j.fuelPct) : j.fuelLevelPercent != null ? Number(j.fuelLevelPercent) : undefined,
      externalVoltage: j.voltage != null ? Number(j.voltage) : j.externalVoltage != null ? Number(j.externalVoltage) : undefined,
      source: j.source ?? "tcp",
      rawPayload: line,
    };
  }
  const parts = line.split(",");
  if (parts.length < 3) throw new Error("invalid csv point");
  const [imei, lat, lng, speed, heading, ignition, rpm, fuelRate, fuelPct, voltage] = parts;
  return {
    imei: imei.trim(),
    latitude: Number(lat),
    longitude: Number(lng),
    speedKph: speed !== undefined && speed !== "" ? Number(speed) : undefined,
    heading: heading !== undefined && heading !== "" ? Number(heading) : undefined,
    ignitionOn: ignition === "1" || ignition === "true",
    engineRpm: rpm !== undefined && rpm !== "" ? Number(rpm) : undefined,
    fuelRateLph: fuelRate !== undefined && fuelRate !== "" ? Number(fuelRate) : undefined,
    fuelLevelPercent: fuelPct !== undefined && fuelPct !== "" ? Number(fuelPct) : undefined,
    externalVoltage: voltage !== undefined && voltage !== "" ? Number(voltage) : undefined,
    source: "tcp",
    rawPayload: line,
  };
}

async function postIngest(body) {
  if (!INGEST_SECRET) {
    throw new Error("GPS_INGEST_SECRET not set");
  }
  const res = await fetch(`${API_BASE}/v1/internal/tracking/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ingest-secret": INGEST_SECRET,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`ingest ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

function handleSocket(socket) {
  stats.tcpAccepted += 1;
  let buf = "";
  socket.setEncoding("utf8");
  socket.on("data", async (chunk) => {
    buf += chunk;
    const parts = buf.split(/\r?\n/);
    buf = parts.pop() ?? "";
    for (const part of parts) {
      try {
        const point = parseLine(part);
        if (!point) continue;
        stats.linesParsed += 1;
        await postIngest(point);
        stats.ingestOk += 1;
        stats.lastIngestAt = new Date().toISOString();
        stats.lastError = null;
        socket.write("OK\n");
      } catch (err) {
        stats.ingestFail += 1;
        stats.lastError = String(err?.message ?? err);
        socket.write(`ERR ${stats.lastError}\n`);
      }
    }
  });
  socket.on("error", (err) => {
    stats.lastError = String(err?.message ?? err);
  });
}

const tcpServer = net.createServer(handleSocket);
tcpServer.listen(TCP_PORT, BIND_HOST, () => {
  console.log(`[gps-ingest] TCP listening on ${BIND_HOST}:${TCP_PORT}`);
  console.log(`[gps-ingest] API ${API_BASE}/v1/internal/tracking/ingest`);
});

const healthServer = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        bind: `${BIND_HOST}:${TCP_PORT}`,
        apiBase: API_BASE,
        secretConfigured: Boolean(INGEST_SECRET),
        ...stats,
      }),
    );
    return;
  }
  res.writeHead(404);
  res.end();
});
healthServer.listen(HEALTH_PORT, BIND_HOST, () => {
  console.log(`[gps-ingest] health on ${BIND_HOST}:${HEALTH_PORT}/health`);
});

process.on("SIGTERM", () => {
  tcpServer.close();
  healthServer.close();
  process.exit(0);
});
