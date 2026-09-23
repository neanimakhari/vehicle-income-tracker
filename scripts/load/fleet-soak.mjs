#!/usr/bin/env node
/**
 * Multi-fleet load soak for VIT.
 *
 * Simulates several "clients" × many taxis each:
 *  1) Provision vehicles + bind synthetic IMEIs (optional)
 *  2) GPS ingest flood via POST /v1/internal/tracking/ingest
 *  3) Concurrent admin read load (latest, devices, summary, incomes)
 *  4) Optional cleanup of LOAD-* vehicles
 *
 * Example (40 taxis ≈ 4 clients × 10 vehicles, 3 minutes):
 *   API_BASE=https://vit-api.vehinc.co.za/v1 \
 *   TENANT=nei-m EMAIL=... PASS=... INGEST_SECRET=... \
 *   CLIENTS=4 VEHICLES_PER_CLIENT=10 DURATION_SEC=180 INTERVAL_MS=3000 \
 *   READ_CONCURRENCY=25 PROVISION=1 CLEANUP=1 \
 *   node scripts/load/fleet-soak.mjs
 *
 * Higher growth target (e.g. 10 clients × 25 = 250 vehicles):
 *   CLIENTS=10 VEHICLES_PER_CLIENT=25 DURATION_SEC=300 INTERVAL_MS=5000 ...
 */

const API_BASE = (process.env.API_BASE ?? "http://127.0.0.1:4000/v1").replace(
  /\/$/,
  "",
);
const TENANT = process.env.TENANT ?? "nei-m";
const EMAIL = process.env.EMAIL ?? "";
const PASS = process.env.PASS ?? "";
const INGEST_SECRET = process.env.INGEST_SECRET ?? "";
const CLIENTS = Math.max(1, Number(process.env.CLIENTS ?? 4));
const VEHICLES_PER_CLIENT = Math.max(
  1,
  Number(process.env.VEHICLES_PER_CLIENT ?? 10),
);
const DURATION_SEC = Math.max(30, Number(process.env.DURATION_SEC ?? 180));
const INTERVAL_MS = Math.max(500, Number(process.env.INTERVAL_MS ?? 3000));
const READ_CONCURRENCY = Math.max(1, Number(process.env.READ_CONCURRENCY ?? 20));
const PROVISION = process.env.PROVISION !== "0";
const CLEANUP = process.env.CLEANUP === "1";
const TAG = process.env.LOAD_TAG ?? `LOAD${Date.now().toString(36).toUpperCase()}`;

const totalVehicles = CLIENTS * VEHICLES_PER_CLIENT;

function pct(sorted, p) {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[i];
}

function stats(times) {
  const s = [...times].sort((a, b) => a - b);
  return {
    n: s.length,
    p50: pct(s, 50),
    p95: pct(s, 95),
    p99: pct(s, 99),
    max: s[s.length - 1] ?? 0,
  };
}

async function api(path, { method = "GET", token, body, headers = {} } = {}) {
  const t0 = Date.now();
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-Tenant-Id": TENANT,
      ...headers,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const ms = Date.now() - t0;
  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { ok: res.ok, status: res.status, ms, json, bytes: text.length };
}

async function login() {
  const r = await api("/auth/login", {
    method: "POST",
    body: { email: EMAIL, password: PASS, tenantSlug: TENANT },
  });
  if (!r.ok || !r.json?.accessToken) {
    throw new Error(`Login failed ${r.status}: ${JSON.stringify(r.json)}`);
  }
  return r.json.accessToken;
}

function makeImei(i) {
  // 15-digit synthetic IMEIs — unique per soak run via TAG hash
  const base = 990000000000000 + (Math.abs(hash(TAG)) % 1000000) * 1000 + i;
  return String(base).slice(0, 15);
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

async function provision(token) {
  const fleet = [];
  console.log(`Provisioning ${totalVehicles} vehicles (${CLIENTS}×${VEHICLES_PER_CLIENT}) tag=${TAG}`);
  for (let c = 0; c < CLIENTS; c++) {
    for (let v = 0; v < VEHICLES_PER_CLIENT; v++) {
      const n = c * VEHICLES_PER_CLIENT + v;
      const label = `${TAG}-C${c + 1}-V${v + 1}`;
      const reg = `${TAG}${String(n).padStart(3, "0")}`;
      const created = await api("/tenant/vehicles", {
        method: "POST",
        token,
        body: { label, registrationNumber: reg },
      });
      if (!created.ok) {
        console.error("vehicle create failed", created.status, created.json);
        continue;
      }
      const id = created.json.id;
      const imei = makeImei(n);
      const bind = await api(`/tenant/tracking/devices/${id}/bind`, {
        method: "POST",
        token,
        body: { imei },
      });
      if (!bind.ok) {
        console.error("bind failed", imei, bind.status, bind.json);
      }
      fleet.push({ id, label, imei, client: c + 1 });
      if ((n + 1) % 10 === 0) console.log(`  provisioned ${n + 1}/${totalVehicles}`);
    }
  }
  return fleet;
}

async function loadExistingDevices(token) {
  const r = await api("/tenant/tracking/devices", { token });
  if (!r.ok || !Array.isArray(r.json)) return [];
  return r.json
    .filter((d) => d.isActive && d.imei)
    .map((d) => ({ id: d.vehicleId, imei: d.imei, label: d.imei }));
}

async function cleanup(token, fleet) {
  console.log(`Cleanup ${fleet.length} vehicles…`);
  for (const v of fleet) {
    await api(`/tenant/tracking/devices/${v.id}/unbind`, {
      method: "POST",
      token,
    }).catch(() => {});
    await api(`/tenant/vehicles/${v.id}`, { method: "DELETE", token }).catch(
      () => {},
    );
  }
}

async function gpsWorker(device, stopAt, counters, latencies) {
  let lat = -26.2 + Math.random() * 0.05;
  let lng = 28.0 + Math.random() * 0.05;
  while (Date.now() < stopAt) {
    const heading = Math.random() * 360;
    const rad = (heading * Math.PI) / 180;
    lat += Math.cos(rad) * 0.00025;
    lng += Math.sin(rad) * 0.00025;
    const body = {
      imei: device.imei,
      latitude: lat,
      longitude: lng,
      speedKph: 20 + Math.random() * 60,
      heading,
      ignitionOn: true,
      externalVoltage: 12.5 + Math.random() * 1.5,
      engineRpm: 1200 + Math.random() * 2000,
      fuelLevelPercent: 40 + Math.random() * 50,
      source: "fleet-soak",
      recordedAt: new Date().toISOString(),
    };
    const r = await api("/internal/tracking/ingest", {
      method: "POST",
      headers: { "x-ingest-secret": INGEST_SECRET },
      body,
    });
    latencies.gps.push(r.ms);
    if (r.ok) counters.gpsOk += 1;
    else {
      counters.gpsFail += 1;
      if (counters.gpsFail <= 5) {
        console.warn("ingest fail", r.status, JSON.stringify(r.json).slice(0, 160));
      }
    }
    await sleep(INTERVAL_MS);
  }
}

async function readWorker(token, stopAt, counters, latencies) {
  const paths = [
    "/tenant/tracking/latest",
    "/tenant/tracking/devices",
    "/tenant/reports/summary",
    "/tenant/incomes",
    "/tenant/vehicles",
  ];
  while (Date.now() < stopAt) {
    const path = paths[Math.floor(Math.random() * paths.length)];
    const r = await api(path, { token });
    latencies.reads.push(r.ms);
    latencies.byPath[path] = latencies.byPath[path] || [];
    latencies.byPath[path].push(r.ms);
    if (r.ok) {
      counters.readOk += 1;
      counters.readBytes += r.bytes;
    } else counters.readFail += 1;
    await sleep(200 + Math.random() * 400);
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!EMAIL || !PASS) throw new Error("EMAIL and PASS required");
  if (!INGEST_SECRET) throw new Error("INGEST_SECRET required");

  console.log(
    JSON.stringify(
      {
        API_BASE,
        TENANT,
        CLIENTS,
        VEHICLES_PER_CLIENT,
        totalVehicles,
        DURATION_SEC,
        INTERVAL_MS,
        READ_CONCURRENCY,
        PROVISION,
        CLEANUP,
        TAG,
      },
      null,
      2,
    ),
  );

  const token = await login();
  console.log("Logged in");

  let fleet = [];
  if (PROVISION) {
    fleet = await provision(token);
  } else {
    fleet = await loadExistingDevices(token);
    console.log(`Using ${fleet.length} existing devices`);
  }
  if (!fleet.length) throw new Error("No devices to soak");

  const stopAt = Date.now() + DURATION_SEC * 1000;
  const counters = {
    gpsOk: 0,
    gpsFail: 0,
    readOk: 0,
    readFail: 0,
    readBytes: 0,
  };
  const latencies = { gps: [], reads: [], byPath: {} };

  console.log(
    `Soaking ${fleet.length} devices for ${DURATION_SEC}s @ ${INTERVAL_MS}ms + ${READ_CONCURRENCY} readers…`,
  );
  const workers = [
    ...fleet.map((d) => gpsWorker(d, stopAt, counters, latencies)),
    ...Array.from({ length: READ_CONCURRENCY }, () =>
      readWorker(token, stopAt, counters, latencies),
    ),
  ];
  await Promise.all(workers);

  const report = {
    durationSec: DURATION_SEC,
    devices: fleet.length,
    gps: { ...counters, latencyMs: stats(latencies.gps) },
    reads: {
      ok: counters.readOk,
      fail: counters.readFail,
      bytes: counters.readBytes,
      latencyMs: stats(latencies.reads),
      byPath: Object.fromEntries(
        Object.entries(latencies.byPath).map(([k, v]) => [k, stats(v)]),
      ),
    },
    projected: {
      note: "GPS coalesced in sidecar at ~5s; this harness hits Nest directly (worst case).",
      clients: CLIENTS,
      vehiclesPerClient: VEHICLES_PER_CLIENT,
      ingestPerMin: Math.round((fleet.length * 60000) / INTERVAL_MS),
    },
  };
  console.log("=== REPORT ===");
  console.log(JSON.stringify(report, null, 2));

  if (CLEANUP && PROVISION) await cleanup(token, fleet);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
