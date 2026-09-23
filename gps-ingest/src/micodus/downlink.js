/**
 * JT808 platform → terminal downlink builders.
 *
 * 0x8300 — text / SMS-style Micodus commands (SPEED, TIMER, SENALM, …)
 * 0x8103 — set terminal parameters (speed limit, report intervals, heartbeat)
 */

const { buildPacket } = require("./frame");

/** JT808 0x8300 text message. flag: bit0=urgent, bit1=terminal display, bit2=TTS. */
function buildTextMessage(terminalId, serial, text, flag = 0x01) {
  const bodyText = Buffer.from(String(text), "utf8");
  const body = Buffer.alloc(1 + bodyText.length);
  body.writeUInt8(flag & 0xff, 0);
  bodyText.copy(body, 1);
  return buildPacket(0x8300, terminalId, serial, body);
}

/**
 * JT808 0x8103 set parameters.
 * @param {Array<{ id: number, value: Buffer }>} params
 */
function buildSetParams(terminalId, serial, params) {
  const chunks = [Buffer.from([params.length & 0xff])];
  for (const p of params) {
    const idBuf = Buffer.alloc(4);
    idBuf.writeUInt32BE(p.id >>> 0, 0);
    const val = Buffer.isBuffer(p.value) ? p.value : Buffer.from(p.value);
    const lenBuf = Buffer.from([val.length & 0xff]);
    chunks.push(idBuf, lenBuf, val);
  }
  return buildPacket(0x8103, terminalId, serial, Buffer.concat(chunks));
}

function dword(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(Number(n) >>> 0, 0);
  return b;
}

/** Micodus SMS-style command strings (device must accept over TCP text). */
const PRESETS = {
  speed_alarm: (v) => `SPEED,${Number(v) || 80}#`,
  upload_interval: (v) => `TIMER,${Number(v) || 30}#`,
  vibration: (v) => `SENALM,${v ? 1 : 0}#`,
  engine_alarm: (v) => `ACCALM,${v ? 1 : 0}#`,
  power_alarm: (v) => `PWRALM,${v ? 1 : 0}#`,
  arm: () => "ARM#",
  disarm: () => "DISARM#",
  status: () => "STATUS#",
  mileage: () => "MILEAGE#",
};

/**
 * Build a downlink frame from a high-level command.
 * @returns {{ frame: Buffer, kind: string, text?: string, params?: object[] }}
 */
function buildCommand(terminalId, serial, cmd) {
  const type = String(cmd?.type || cmd?.command || "text").toLowerCase();

  if (type === "params" || type === "set_params") {
    const params = [];
    if (cmd.maxSpeedKph != null) {
      params.push({ id: 0x0055, value: dword(cmd.maxSpeedKph) });
    }
    if (cmd.overspeedDurationSec != null) {
      params.push({ id: 0x0056, value: dword(cmd.overspeedDurationSec) });
    }
    if (cmd.reportIntervalSec != null) {
      params.push({ id: 0x0029, value: dword(cmd.reportIntervalSec) });
    }
    if (cmd.heartbeatIntervalSec != null) {
      params.push({ id: 0x0001, value: dword(cmd.heartbeatIntervalSec) });
    }
    if (Array.isArray(cmd.params)) {
      for (const p of cmd.params) {
        params.push({
          id: Number(p.id),
          value: Buffer.isBuffer(p.value)
            ? p.value
            : dword(p.value ?? 0),
        });
      }
    }
    if (!params.length) {
      throw new Error("params command requires at least one parameter");
    }
    return {
      frame: buildSetParams(terminalId, serial, params),
      kind: "params",
      params,
    };
  }

  let text = cmd?.text != null ? String(cmd.text) : null;
  if (!text && PRESETS[type]) {
    text = PRESETS[type](cmd.value ?? cmd.enabled);
  }
  if (!text || !text.trim()) {
    throw new Error(`Unknown or empty command type: ${type}`);
  }
  return {
    frame: buildTextMessage(terminalId, serial, text.trim()),
    kind: "text",
    text: text.trim(),
  };
}

module.exports = {
  buildTextMessage,
  buildSetParams,
  buildCommand,
  PRESETS,
  dword,
};
