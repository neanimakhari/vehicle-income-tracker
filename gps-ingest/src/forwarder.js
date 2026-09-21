/**
 * ACK-first coalesce forwarder: latest-wins per IMEI, flush on interval.
 */

function createForwarder(opts) {
  const {
    postIngest,
    flushMs = Number(process.env.INGEST_FLUSH_MS ?? 5000),
    maxInflight = Number(process.env.INGEST_MAX_INFLIGHT ?? 20),
    stats,
  } = opts;

  /** @type {Map<string, object>} */
  const pending = new Map();
  let inflight = 0;
  /** @type {ReturnType<typeof setInterval> | null} */
  let timer = null;

  const localStats = stats ?? {
    flushed: 0,
    droppedStale: 0,
    apiErrors: 0,
    enqueued: 0,
    rejectedImei: 0,
  };

  function enqueue(point) {
    if (!point?.imei) return;
    const key = String(point.imei);
    if (pending.has(key)) localStats.droppedStale += 1;
    pending.set(key, stripInternal(point));
    localStats.enqueued += 1;
    ensureTimer();
  }

  function stripInternal(point) {
    const out = { ...point };
    delete out._alarm;
    delete out._altitude;
    delete out._additionalTags;
    // Keep Nest ingest fields; drop decoder-only extras not in DTO
    delete out.gpsSatellites;
    delete out.beidouSatellites;
    delete out.glonassSatellites;
    delete out.intakeAirC;
    delete out.mafGps;
    delete out.intakeMapKpa;
    delete out.throttlePercent;
    delete out.oilLevelPercent;
    delete out.dtcHex;
    return out;
  }

  function ensureTimer() {
    if (timer) return;
    timer = setInterval(() => {
      flush().catch(() => {});
    }, flushMs);
    if (typeof timer.unref === "function") timer.unref();
  }

  async function flush() {
    if (pending.size === 0) return;
    const batch = [...pending.entries()];
    pending.clear();

    for (const [, point] of batch) {
      while (inflight >= maxInflight) {
        await sleep(25);
      }
      inflight += 1;
      postIngest(point)
        .then(() => {
          localStats.flushed += 1;
        })
        .catch((err) => {
          localStats.apiErrors += 1;
          const msg = String(err?.message ?? err);
          if (msg.includes("TRACKER_REJECTED") || msg.includes("403")) {
            localStats.rejectedImei += 1;
          }
        })
        .finally(() => {
          inflight -= 1;
        });
    }
  }

  async function flushSync() {
    await flush();
    while (inflight > 0) await sleep(20);
  }

  function queueDepth() {
    return pending.size;
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  return {
    enqueue,
    flush,
    flushSync,
    queueDepth,
    stop,
    stats: localStats,
  };
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { createForwarder };
