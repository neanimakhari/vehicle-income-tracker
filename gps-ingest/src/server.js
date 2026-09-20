/**
 * Private TCP GPS ingest sidecar.
 *
 * - Text TCP (TRACKING_TCP_PORT, default 5023): brand-agnostic JSON/CSV lines (mocks)
 * - Micodus TCP (MICODUS_TCP_PORT, default 7700): Huabao/JT808 binary + ACK-first coalesce
 *
 * Both forward to Nest POST /v1/internal/tracking/ingest with GPS_INGEST_SECRET.
 */

const net = require("net");
const http = require("http");
const { extractFrames, parsePacket } = require("./micodus/frame");
const { decodePacket } = require("./micodus/decoder");
const { buildGeneralAck, buildRegisterAck } = require("./micodus/ack");
const { MicodusSession } = require("./micodus/session");
const { createForwarder } = require("./forwarder");

const TCP_PORT = Number(process.env.TRACKING_TCP_PORT ?? 5023);
const MICODUS_PORT = Number(process.env.MICODUS_TCP_PORT ?? 7700);
const HEALTH_PORT = Number(process.env.HEALTH_PORT ?? 9088);
const API_BASE = (process.env.API_BASE_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
const INGEST_SECRET = process.env.GPS_INGEST_SECRET ?? process.env.TRACKING_INGEST_SECRET ?? "";
const BIND_HOST = process.env.TRACKING_TCP_BIND ?? "127.0.0.1";
const MICODUS_BIND = process.env.MICODUS_TCP_BIND ?? BIND_HOST;

const stats = {
  startedAt: new Date().toISOString(),
  tcpAccepted: 0,
  linesParsed: 0,
  ingestOk: 0,
  ingestFail: 0,
  lastError: null,
  lastIngestAt: null,
  micodusConnections: 0,
  micodusActive: 0,
  micodusFrames: 0,
  micodusUnknown: 0,
  lastMicodusAt: null,
};

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
  stats.ingestOk += 1;
  stats.lastIngestAt = new Date().toISOString();
  stats.lastError = null;
  return res.json();
}

const forwarder = createForwarder({
  postIngest: async (point) => {
    try {
      await postIngest(point);
    } catch (err) {
      stats.ingestFail += 1;
      stats.lastError = String(err?.message ?? err);
      throw err;
    }
  },
});

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

function handleTextSocket(socket) {
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

function handleMicodusSocket(socket) {
  stats.micodusConnections += 1;
  stats.micodusActive += 1;
  const session = new MicodusSession();
  let buf = Buffer.alloc(0);

  socket.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const { frames, rest } = extractFrames(buf);
    buf = Buffer.from(rest);

    for (const raw of frames) {
      stats.micodusFrames += 1;
      stats.lastMicodusAt = new Date().toISOString();
      try {
        const packet = parsePacket(raw);
        if (!packet) {
          stats.micodusUnknown += 1;
          console.warn(`[micodus] bad frame ${raw.toString("hex").slice(0, 64)}`);
          continue;
        }
        const decoded = decodePacket(packet);
        session.note(decoded);

        // ACK immediately — never wait on Nest
        if (decoded.kind === "register") {
          socket.write(buildRegisterAck(packet.terminalId, packet.serial, 0));
        } else if (decoded.kind === "heartbeat" || decoded.kind === "auth" || decoded.kind === "location") {
          socket.write(buildGeneralAck(packet.terminalId, packet.serial, packet.msgId, 0));
        } else {
          stats.micodusUnknown += 1;
          console.warn(`[micodus] unknown msgId=0x${packet.msgId.toString(16)} hex=${packet.rawHex.slice(0, 80)}`);
          socket.write(buildGeneralAck(packet.terminalId, packet.serial, packet.msgId, 0));
        }

        if (decoded.kind === "location" && decoded.point) {
          const imei = session.deviceImei() || decoded.point.imei;
          forwarder.enqueue({ ...decoded.point, imei });
        }
      } catch (err) {
        stats.lastError = String(err?.message ?? err);
        console.error("[micodus] frame error", stats.lastError);
      }
    }
  });

  socket.on("error", (err) => {
    stats.lastError = String(err?.message ?? err);
  });
  socket.on("close", () => {
    stats.micodusActive = Math.max(0, stats.micodusActive - 1);
  });
}

const textServer = net.createServer(handleTextSocket);
textServer.listen(TCP_PORT, BIND_HOST, () => {
  console.log(`[gps-ingest] text TCP on ${BIND_HOST}:${TCP_PORT}`);
  console.log(`[gps-ingest] API ${API_BASE}/v1/internal/tracking/ingest`);
});

const micodusServer = net.createServer(handleMicodusSocket);
micodusServer.listen(MICODUS_PORT, MICODUS_BIND, () => {
  console.log(`[gps-ingest] Micodus TCP on ${MICODUS_BIND}:${MICODUS_PORT}`);
});

const healthServer = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        textBind: `${BIND_HOST}:${TCP_PORT}`,
        micodusBind: `${MICODUS_BIND}:${MICODUS_PORT}`,
        apiBase: API_BASE,
        secretConfigured: Boolean(INGEST_SECRET),
        queueDepth: forwarder.queueDepth(),
        coalesce: forwarder.stats,
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

process.on("SIGTERM", async () => {
  forwarder.stop();
  await forwarder.flushSync().catch(() => {});
  textServer.close();
  micodusServer.close();
  healthServer.close();
  process.exit(0);
});

module.exports = {
  parseLine,
  postIngest,
  forwarder,
  stats,
};
