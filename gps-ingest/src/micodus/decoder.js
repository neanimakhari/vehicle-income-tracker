/**
 * Decode Micodus / JT808 message bodies into ingest points.
 *
 * Message IDs:
 *   0x0002 heartbeat
 *   0x0100 register
 *   0x0102 auth
 *   0x0200 / 0x0201 location
 */

const MSG = {
  HEARTBEAT: 0x0002,
  REGISTER: 0x0100,
  AUTH: 0x0102,
  LOCATION: 0x0200,
  LOCATION_BATCH: 0x0704,
  LOCATION_QUERY_RESP: 0x0201,
};

/**
 * @param {object} packet — from parsePacket
 * @returns {{ kind: string, imei?: string, point?: object, terminalId: string, serial: number, rawHex: string, msgId: number }}
 */
function decodePacket(packet) {
  const base = {
    terminalId: packet.terminalId,
    serial: packet.serial,
    rawHex: packet.rawHex,
    msgId: packet.msgId,
  };

  switch (packet.msgId) {
    case MSG.HEARTBEAT:
      return { ...base, kind: "heartbeat" };
    case MSG.REGISTER: {
      const imei = extractImeiFromRegister(packet.body) || packet.terminalId;
      return { ...base, kind: "register", imei };
    }
    case MSG.AUTH:
      return { ...base, kind: "auth", imei: packet.terminalId };
    case MSG.LOCATION:
    case MSG.LOCATION_QUERY_RESP: {
      const point = decodeLocationBody(packet.body, packet.terminalId, packet.rawHex);
      return { ...base, kind: "location", imei: packet.terminalId, point };
    }
    case MSG.LOCATION_BATCH: {
      if (packet.body.length < 6) return { ...base, kind: "unknown" };
      const itemLen = packet.body.readUInt16BE(2);
      const itemBody = packet.body.subarray(4, 4 + itemLen);
      const point = decodeLocationBody(itemBody, packet.terminalId, packet.rawHex);
      return { ...base, kind: "location", imei: packet.terminalId, point };
    }
    default:
      return { ...base, kind: "unknown" };
  }
}

function extractImeiFromRegister(body) {
  if (!body || body.length < 20) return null;
  const ascii = body.toString("latin1");
  const m = ascii.match(/\d{15}/);
  if (m) return m[0];
  const hex = body.toString("hex");
  const hm = hex.match(/(\d{15})/);
  return hm ? hm[1] : null;
}

function decodeLocationBody(body, terminalId, rawHex) {
  if (!body || body.length < 28) return null;

  const alarm = body.readUInt32BE(0);
  const status = body.readUInt32BE(4);
  const latRaw = body.readUInt32BE(8);
  const lonRaw = body.readUInt32BE(12);
  const altitude = body.readUInt16BE(16);
  const speedRaw = body.readUInt16BE(18);
  const heading = body.readUInt16BE(20);
  const timeBcd = body.subarray(22, 28);

  const south = (status & 0x04) !== 0;
  const west = (status & 0x08) !== 0;
  let latitude = latRaw / 1e6;
  let longitude = lonRaw / 1e6;
  if (south) latitude = -latitude;
  if (west) longitude = -longitude;

  const gpsFixOk = (status & 0x02) !== 0;
  const ignitionOn = (status & 0x01) !== 0;
  const speedKph = speedRaw / 10;
  const recordedAt = bcdTimeToIso(timeBcd);

  const extras = decodeAdditional(body.subarray(28));

  return {
    imei: String(terminalId),
    latitude,
    longitude,
    speedKph,
    heading,
    ignitionOn,
    gpsFixOk,
    recordedAt: recordedAt ?? undefined,
    engineRpm: extras.engineRpm,
    fuelRateLph: extras.fuelRateLph,
    fuelLevelPercent: extras.fuelLevelPercent,
    externalVoltage: extras.externalVoltage,
    coolantC: extras.coolantC,
    odometerKm: extras.odometerKm,
    engineLoadPercent: extras.engineLoadPercent,
    satellites: extras.satellites,
    source: "micodus",
    rawPayload: rawHex,
    _alarm: alarm,
    _altitude: altitude,
  };
}

/**
 * JT808 additional info: repeating [id:1][len:1][value:len]
 * Micodus CAN tags (flespi): 0x81 rpm, 0x83 load, 0x84 coolant, 0x85 fuel rate, …
 */
function decodeAdditional(buf) {
  const out = {};
  let i = 0;
  while (i + 2 <= buf.length) {
    const id = buf[i];
    const len = buf[i + 1];
    i += 2;
    if (i + len > buf.length) break;
    const val = buf.subarray(i, i + len);
    i += len;
    switch (id) {
      case 0x01:
        if (len >= 4) out.odometerKm = val.readUInt32BE(0) / 10;
        break;
      case 0x31:
        if (len >= 1) out.satellites = val[0];
        break;
      case 0x80:
        if (len >= 2) out.externalVoltage = val.readUInt16BE(0) / 10;
        else if (len === 1) out.externalVoltage = val[0] / 10;
        break;
      case 0x81:
        if (len >= 2) out.engineRpm = val.readUInt16BE(0);
        break;
      case 0x83:
        if (len >= 1) out.engineLoadPercent = val[0];
        break;
      case 0x84:
        if (len >= 1) out.coolantC = val[0] - 40;
        break;
      case 0x85:
        if (len >= 2) out.fuelRateLph = val.readUInt16BE(0) / 10;
        break;
      case 0x2b:
        if (len >= 2 && out.externalVoltage == null) {
          out.externalVoltage = val.readUInt16BE(0) / 100;
        }
        break;
      default:
        break;
    }
  }
  return out;
}

function bcdTimeToIso(bcd6) {
  if (!bcd6 || bcd6.length < 6) return null;
  const n = (b) => ((b >> 4) & 0xf) * 10 + (b & 0xf);
  try {
    const yy = n(bcd6[0]);
    const mo = n(bcd6[1]);
    const dd = n(bcd6[2]);
    const hh = n(bcd6[3]);
    const mi = n(bcd6[4]);
    const ss = n(bcd6[5]);
    const year = 2000 + yy;
    const d = new Date(Date.UTC(year, mo - 1, dd, hh, mi, ss));
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

module.exports = {
  MSG,
  decodePacket,
  decodeLocationBody,
  decodeAdditional,
  bcdTimeToIso,
};
