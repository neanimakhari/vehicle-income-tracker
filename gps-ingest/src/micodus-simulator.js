/**
 * Micodus/Huabao TCP simulator — login + location frames to port 7700.
 *
 * Usage:
 *   IMEI=356938035643809 HOST=104.248.42.192 npm run simulate:micodus
 */

const net = require("net");
const { buildPacket } = require("./micodus/frame");

const HOST = process.env.TRACKING_TCP_HOST ?? process.env.HOST ?? "127.0.0.1";
const PORT = Number(process.env.MICODUS_TCP_PORT ?? 7700);
const IMEI = (process.env.IMEI ?? "356938035643809").replace(/\D/g, "");
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 2000);
const POINTS = Number(process.env.POINTS ?? 5);

let lat = -26.2041;
let lng = 28.0473;
let serial = 1;
let sent = 0;

function nextSerial() {
  serial = (serial + 1) & 0xffff;
  return serial;
}

function bcdTimeNow() {
  const d = new Date();
  const parts = [
    d.getUTCFullYear() % 100,
    d.getUTCMonth() + 1,
    d.getUTCDate(),
    d.getUTCHours(),
    d.getUTCMinutes(),
    d.getUTCSeconds(),
  ];
  const buf = Buffer.alloc(6);
  for (let i = 0; i < 6; i++) {
    const n = parts[i];
    buf[i] = ((Math.floor(n / 10) & 0xf) << 4) | (n % 10);
  }
  return buf;
}

function buildLocation() {
  const extras = Buffer.alloc(10);
  let e = 0;
  extras[e++] = 0x81;
  extras[e++] = 2;
  extras.writeUInt16BE(1800 + Math.floor(Math.random() * 400), e);
  e += 2;
  extras[e++] = 0x84;
  extras[e++] = 1;
  extras[e++] = 130; // 90C
  extras[e++] = 0x31;
  extras[e++] = 1;
  extras[e++] = 12;

  const body = Buffer.alloc(28 + e);
  let o = 0;
  body.writeUInt32BE(0, o);
  o += 4; // alarm
  body.writeUInt32BE(0x07, o);
  o += 4; // ACC + GPS fix + south
  body.writeUInt32BE(Math.round(Math.abs(lat) * 1e6), o);
  o += 4;
  body.writeUInt32BE(Math.round(Math.abs(lng) * 1e6), o);
  o += 4;
  body.writeUInt16BE(1600, o);
  o += 2;
  body.writeUInt16BE(Math.round((35 + Math.random() * 20) * 10), o);
  o += 2;
  body.writeUInt16BE(Math.floor(Math.random() * 360), o);
  o += 2;
  bcdTimeNow().copy(body, o);
  o += 6;
  extras.subarray(0, e).copy(body, o);
  return buildPacket(0x0200, IMEI, nextSerial(), body);
}

function buildHeartbeat() {
  return buildPacket(0x0002, IMEI, nextSerial(), Buffer.alloc(0));
}

function buildAuth() {
  const auth = Buffer.from("VIT", "ascii");
  return buildPacket(0x0102, IMEI, nextSerial(), auth);
}

const socket = net.connect({ host: HOST, port: PORT }, () => {
  console.log(`[micodus-sim] connected ${HOST}:${PORT} imei=${IMEI}`);
  socket.write(buildAuth());
  console.log("[micodus-sim] sent auth");

  const timer = setInterval(() => {
    if (sent >= POINTS) {
      clearInterval(timer);
      socket.write(buildHeartbeat());
      setTimeout(() => socket.end(), 500);
      return;
    }
    const heading = (sent * 40) % 360;
    const rad = (heading * Math.PI) / 180;
    lat += Math.cos(rad) * 0.0004;
    lng += Math.sin(rad) * 0.0004;
    // keep southern hemisphere negative for display; encoding uses abs + south bit
    socket.write(buildLocation());
    sent += 1;
    console.log(`[micodus-sim] location #${sent} ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
  }, INTERVAL_MS);
});

socket.on("data", (d) => {
  console.log(`[micodus-sim] ACK ${d.length}b hex=${d.toString("hex").slice(0, 40)}…`);
});
socket.on("error", (err) => {
  console.error("[micodus-sim] error", err.message);
  process.exit(1);
});
socket.on("end", () => {
  console.log("[micodus-sim] done");
  process.exit(0);
});
