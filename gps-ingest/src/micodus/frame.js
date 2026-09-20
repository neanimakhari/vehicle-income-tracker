/**
 * Huabao / JT808-style framing used by Micodus MV55G (0x7E … 0x7E).
 */

const FLAG = 0x7e;
const ESC = 0x7d;

/** Unescape and return inner bytes (without outer 0x7E). Null if incomplete/invalid. */
function unescapeFrame(buf) {
  const out = [];
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === ESC) {
      const n = buf[i + 1];
      if (n === 0x01) {
        out.push(ESC);
        i += 1;
      } else if (n === 0x02) {
        out.push(FLAG);
        i += 1;
      } else {
        return null;
      }
    } else {
      out.push(b);
    }
  }
  return Buffer.from(out);
}

function escapeBytes(buf) {
  const out = [];
  for (const b of buf) {
    if (b === FLAG) {
      out.push(ESC, 0x02);
    } else if (b === ESC) {
      out.push(ESC, 0x01);
    } else {
      out.push(b);
    }
  }
  return Buffer.from(out);
}

function xorChecksum(buf) {
  let x = 0;
  for (const b of buf) x ^= b;
  return x & 0xff;
}

/**
 * Extract complete frames from a growing binary buffer.
 * Returns { frames: Buffer[] (raw including 0x7E), rest: Buffer }
 */
function extractFrames(buffer) {
  const frames = [];
  let i = 0;
  while (i < buffer.length) {
    if (buffer[i] !== FLAG) {
      i += 1;
      continue;
    }
    let j = i + 1;
    while (j < buffer.length && buffer[j] !== FLAG) j += 1;
    if (j >= buffer.length) break;
    if (j > i + 1) {
      frames.push(buffer.subarray(i, j + 1));
    }
    i = j + 1;
  }
  return { frames, rest: buffer.subarray(i) };
}

/**
 * Parse one raw framed packet into header + body.
 * @returns {{ msgId, bodyProps, terminalId, serial, body, rawInner } | null}
 */
function parsePacket(rawFrame) {
  if (!rawFrame || rawFrame.length < 5 || rawFrame[0] !== FLAG || rawFrame[rawFrame.length - 1] !== FLAG) {
    return null;
  }
  const innerEscaped = rawFrame.subarray(1, rawFrame.length - 1);
  const inner = unescapeFrame(innerEscaped);
  if (!inner || inner.length < 13) return null;

  const payload = inner.subarray(0, inner.length - 1);
  const checksum = inner[inner.length - 1];
  if (xorChecksum(payload) !== checksum) return null;

  const msgId = payload.readUInt16BE(0);
  const bodyProps = payload.readUInt16BE(2);
  const bodyLen = bodyProps & 0x3ff;
  const hasSubpackage = (bodyProps & 0x2000) !== 0;
  let offset = 4;
  const terminalId = bcdToString(payload.subarray(offset, offset + 6));
  offset += 6;
  const serial = payload.readUInt16BE(offset);
  offset += 2;
  if (hasSubpackage) offset += 4;
  const body = payload.subarray(offset, offset + bodyLen);
  if (body.length < bodyLen) return null;

  return {
    msgId,
    bodyProps,
    bodyLen,
    terminalId,
    serial,
    body,
    rawInner: payload,
    rawHex: Buffer.from(rawFrame).toString("hex"),
  };
}

/** Build a framed packet (msgId, terminalId BCD string, serial, body Buffer). */
function buildPacket(msgId, terminalId, serial, body = Buffer.alloc(0)) {
  const term = stringToBcd(terminalId, 6);
  const bodyProps = body.length & 0x3ff;
  const header = Buffer.alloc(12);
  header.writeUInt16BE(msgId & 0xffff, 0);
  header.writeUInt16BE(bodyProps, 2);
  term.copy(header, 4);
  header.writeUInt16BE(serial & 0xffff, 10);
  const payload = Buffer.concat([header, body]);
  const cs = Buffer.from([xorChecksum(payload)]);
  const escaped = escapeBytes(Buffer.concat([payload, cs]));
  return Buffer.concat([Buffer.from([FLAG]), escaped, Buffer.from([FLAG])]);
}

function bcdToString(buf) {
  let s = "";
  for (const b of buf) {
    s += ((b >> 4) & 0xf).toString(16);
    s += (b & 0xf).toString(16);
  }
  return s.replace(/^0+/, "") || "0";
}

function stringToBcd(str, byteLen) {
  const digits = String(str).replace(/\D/g, "");
  const padded = digits.padStart(byteLen * 2, "0").slice(-byteLen * 2);
  const out = Buffer.alloc(byteLen);
  for (let i = 0; i < byteLen; i++) {
    const hi = parseInt(padded[i * 2], 16);
    const lo = parseInt(padded[i * 2 + 1], 16);
    out[i] = ((hi & 0xf) << 4) | (lo & 0xf);
  }
  return out;
}

module.exports = {
  FLAG,
  extractFrames,
  parsePacket,
  buildPacket,
  bcdToString,
  stringToBcd,
  xorChecksum,
  unescapeFrame,
  escapeBytes,
};
