/**
 * Live Micodus TCP sessions keyed by IMEI / terminal ID.
 * Supports immediate downlink and a short pending queue while offline.
 */

const MAX_PENDING = 5;
const PENDING_TTL_MS = 5 * 60 * 1000;

function createSessionRegistry() {
  /** @type {Map<string, { socket: import('net').Socket, terminalId: string, nextSerial: number, imei: string, lastSeenAt: number }>} */
  const byKey = new Map();
  /** @type {Map<string, Array<{ frame: Buffer, enqueuedAt: number, meta: object }>>} */
  const pending = new Map();

  function keysFor(imei, terminalId) {
    const keys = new Set();
    if (imei) keys.add(String(imei));
    if (terminalId) keys.add(String(terminalId));
    return [...keys];
  }

  function register(socket, { imei, terminalId }) {
    const entry = {
      socket,
      terminalId: String(terminalId || imei),
      imei: String(imei || terminalId),
      nextSerial: (Date.now() & 0xffff) || 1,
      lastSeenAt: Date.now(),
    };
    for (const k of keysFor(entry.imei, entry.terminalId)) {
      byKey.set(k, entry);
    }
    flushPending(entry);
    return entry;
  }

  function touch(imei, terminalId) {
    for (const k of keysFor(imei, terminalId)) {
      const e = byKey.get(k);
      if (e) e.lastSeenAt = Date.now();
    }
  }

  function unregister(socket) {
    for (const [k, e] of byKey.entries()) {
      if (e.socket === socket) byKey.delete(k);
    }
  }

  function lookup(imei) {
    return byKey.get(String(imei)) ?? null;
  }

  function nextSerial(entry) {
    entry.nextSerial = (entry.nextSerial + 1) & 0xffff;
    if (entry.nextSerial === 0) entry.nextSerial = 1;
    return entry.nextSerial;
  }

  function enqueuePending(imei, frame, meta = {}) {
    const key = String(imei);
    const list = pending.get(key) ?? [];
    list.push({ frame, enqueuedAt: Date.now(), meta });
    while (list.length > MAX_PENDING) list.shift();
    pending.set(key, list);
  }

  function flushPending(entry) {
    const keys = keysFor(entry.imei, entry.terminalId);
    const now = Date.now();
    for (const k of keys) {
      const list = pending.get(k);
      if (!list?.length) continue;
      const keep = [];
      for (const item of list) {
        if (now - item.enqueuedAt > PENDING_TTL_MS) continue;
        try {
          if (!entry.socket.destroyed) {
            entry.socket.write(item.frame);
          } else {
            keep.push(item);
          }
        } catch {
          keep.push(item);
        }
      }
      if (keep.length) pending.set(k, keep);
      else pending.delete(k);
    }
  }

  /**
   * @returns {{ ok: boolean, queued?: boolean, online?: boolean, error?: string, serial?: number }}
   */
  function send(imei, frameBuilder) {
    const entry = lookup(imei);
    if (!entry || entry.socket.destroyed) {
      try {
        const serial = (Date.now() & 0xffff) || 1;
        const built = frameBuilder(String(imei), serial);
        enqueuePending(imei, built.frame, { kind: built.kind });
        return { ok: true, queued: true, online: false, serial };
      } catch (err) {
        return { ok: false, error: String(err?.message ?? err) };
      }
    }
    try {
      const serial = nextSerial(entry);
      const built = frameBuilder(entry.terminalId, serial);
      entry.socket.write(built.frame);
      return {
        ok: true,
        queued: false,
        online: true,
        serial,
        kind: built.kind,
        text: built.text,
      };
    } catch (err) {
      return { ok: false, error: String(err?.message ?? err), online: true };
    }
  }

  function stats() {
    const sessions = new Set();
    for (const e of byKey.values()) sessions.add(e.socket);
    let pendingCount = 0;
    for (const list of pending.values()) pendingCount += list.length;
    return {
      sessionKeys: byKey.size,
      activeSockets: sessions.size,
      pendingCommands: pendingCount,
    };
  }

  return {
    register,
    touch,
    unregister,
    lookup,
    send,
    stats,
  };
}

module.exports = { createSessionRegistry };
