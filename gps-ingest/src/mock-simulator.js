/**
 * Mock GPS/OBD simulator — sends JSON lines to gps-ingest TCP port.
 * Usage: IMEI=... npm run simulate
 */

const net = require("net");

const HOST = process.env.TRACKING_TCP_HOST ?? "127.0.0.1";
const PORT = Number(process.env.TRACKING_TCP_PORT ?? 5023);
const IMEI = process.env.IMEI ?? "356938035643809";
const INTERVAL_MS = Number(process.env.INTERVAL_MS ?? 6000);
const POINTS = Number(process.env.POINTS ?? 30);
const PROFILE = process.env.PROFILE ?? "obd"; // basic | obd

let lat = -26.2041 + (Math.random() - 0.5) * 0.01;
let lng = 28.0473 + (Math.random() - 0.5) * 0.01;
let fuel = 75;
let i = 0;

const socket = net.connect({ host: HOST, port: PORT }, () => {
  console.log(`[mock] connected ${HOST}:${PORT} imei=${IMEI} profile=${PROFILE}`);
  const timer = setInterval(() => {
    if (i >= POINTS) {
      clearInterval(timer);
      socket.end();
      return;
    }
    const heading = (i * 30) % 360;
    const rad = (heading * Math.PI) / 180;
    lat += Math.cos(rad) * 0.0003;
    lng += Math.sin(rad) * 0.0003;
    fuel = Math.max(5, fuel - 0.2);
    const speed = 20 + Math.random() * 40;
    const payload = {
      imei: IMEI,
      lat,
      lng,
      speed,
      heading,
      ignition: true,
      source: "mock-sim",
    };
    if (PROFILE === "obd") {
      payload.rpm = 1400 + Math.random() * 1600;
      payload.fuelRate = 2 + Math.random() * 5;
      payload.fuelPct = fuel;
      payload.voltage = 13.4 + Math.random() * 0.6;
    }
    const line = JSON.stringify(payload) + "\n";
    socket.write(line);
    console.log(`[mock] sent #${i + 1}`, payload.lat.toFixed(5), payload.lng.toFixed(5), `${speed.toFixed(1)}kph`);
    i += 1;
  }, INTERVAL_MS);
});

socket.on("data", (d) => process.stdout.write(`[ingest] ${d}`));
socket.on("error", (err) => {
  console.error("[mock] error", err.message);
  process.exit(1);
});
socket.on("end", () => {
  console.log("[mock] done");
  process.exit(0);
});
