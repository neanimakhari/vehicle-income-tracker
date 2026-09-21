/**
 * Decode Micodus / JT808 message bodies into ingest points.
 *
 * Message IDs:
 *   0x0002 heartbeat
 *   0x0100 register
 *   0x0102 auth
 *   0x0200 / 0x0201 / 0x0202 / 0x0203 location (+ trip start/stop variants)
 *   0x0704 location batch
 *
 * Additional-info tag map (flespi Micodus + live MV55G capture):
 *   0x01 mileage (0.1 km)
 *   0x30 GSM signal level
 *   0x31 / 0x32 / 0x33 / 0x34 satellite counts
 *   0x80 CAN vehicle speed (km/h)
 *   0x81 RPM
 *   0x82 battery / OBD rail voltage (0.1 V) — live MV55G sends this every fix
 *   0x83 engine load %
 *   0x84 coolant (°C = raw − 40)
 *   0x85 fuel rate (0.1 L/h)
 *   0x86 intake air temp (°C = raw − 40)
 *   0x87 MAF (0.01 g/s)
 *   0x88 intake MAP (kPa)
 *   0x89 throttle %
 *   0x8C CAN total mileage (0.1 km)
 *   0x8E oil level
 *   0xE1 internal battery level %
 */

const MSG = {
  HEARTBEAT: 0x0002,
  REGISTER: 0x0100,
  AUTH: 0x0102,
  LOCATION: 0x0200,
  LOCATION_BATCH: 0x0704,
  LOCATION_QUERY_RESP: 0x0201,
  LOCATION_TRIP_START: 0x0202,
  LOCATION_TRIP_STOP: 0x0203,
};

const seenAdditionalIds = new Set();

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
    case MSG.LOCATION_QUERY_RESP:
    case MSG.LOCATION_TRIP_START:
    case MSG.LOCATION_TRIP_STOP: {
      const point = decodeLocationBody(packet.body, packet.terminalId, packet.rawHex);
      if (point) point.msgId = packet.msgId;
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
  let speedKph = speedRaw / 10;
  const recordedAt = bcdTimeToIso(timeBcd);

  const extras = decodeAdditional(body.subarray(28));

  // Prefer GNSS speed; fall back to CAN speed when GNSS reports 0 but CAN has a value.
  if ((speedKph == null || speedKph === 0) && extras.canSpeedKph != null && extras.canSpeedKph > 0) {
    speedKph = extras.canSpeedKph;
  }

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
    backupBatteryLevel: extras.backupBatteryLevel,
    coolantC: extras.coolantC,
    odometerKm: extras.odometerKm,
    engineLoadPercent: extras.engineLoadPercent,
    satellites: extras.satellites,
    alarmFlags: alarm,
    alarmExt: extras.alarmExt ?? undefined,
    gsmSignal: extras.gsmSignal,
    canOdometerKm: extras.canOdometerKm,
    canSpeedKph: extras.canSpeedKph,
    source: "micodus",
    rawPayload: rawHex,
    _alarm: alarm,
    _altitude: altitude,
    _additionalTags: extras._tags,
  };
}

/**
 * JT808 additional info: repeating [id:1][len:1][value:len]
 */
function decodeAdditional(buf) {
  const out = { _tags: [] };
  let i = 0;
  while (i + 2 <= buf.length) {
    const id = buf[i];
    const len = buf[i + 1];
    i += 2;
    if (i + len > buf.length) break;
    const val = buf.subarray(i, i + len);
    i += len;

    const tagHex = val.toString("hex");
    out._tags.push({ id, len, hex: tagHex });
    if (!seenAdditionalIds.has(id)) {
      seenAdditionalIds.add(id);
      console.log(
        `[micodus] new additional tag id=0x${id.toString(16).padStart(2, "0")} len=${len} sample=${tagHex.slice(0, 32)}`,
      );
    }

    switch (id) {
      case 0x01: // device / calculated mileage (0.1 km)
        if (len >= 4) out.odometerKm = val.readUInt32BE(0) / 10;
        break;
      case 0x30: // GSM signal
        if (len >= 1) out.gsmSignal = val[0];
        break;
      case 0x31: // total GNSS sats used
        if (len >= 1) out.satellites = val[0];
        break;
      case 0x32:
        if (len >= 1) out.gpsSatellites = val[0];
        break;
      case 0x33:
        if (len >= 1) out.beidouSatellites = val[0];
        break;
      case 0x34:
        if (len >= 1) out.glonassSatellites = val[0];
        break;
      case 0x80: // CAN vehicle speed (km/h) — NOT voltage
        if (len >= 2) out.canSpeedKph = val.readUInt16BE(0);
        else if (len === 1) out.canSpeedKph = val[0];
        break;
      case 0x81: // RPM
        if (len >= 2) out.engineRpm = val.readUInt16BE(0);
        break;
      case 0x82: // battery / OBD rail voltage (0.1 V) — live MV55G
        if (len >= 2) out.externalVoltage = val.readUInt16BE(0) / 10;
        else if (len === 1) out.externalVoltage = val[0] / 10;
        break;
      case 0x83: // engine load %
        if (len >= 1) out.engineLoadPercent = val[0];
        break;
      case 0x84: // coolant °C = raw − 40
        if (len >= 1) out.coolantC = val[0] - 40;
        break;
      case 0x85: // fuel rate 0.1 L/h
        if (len >= 2) out.fuelRateLph = val.readUInt16BE(0) / 10;
        break;
      case 0x86: // intake air temp
        if (len >= 1) out.intakeAirC = val[0] - 40;
        break;
      case 0x87: // MAF 0.01 g/s
        if (len >= 2) out.mafGps = val.readUInt16BE(0) / 100;
        break;
      case 0x88: // intake MAP kPa
        if (len >= 1) out.intakeMapKpa = val[0];
        break;
      case 0x89: // throttle %
        if (len >= 1) out.throttlePercent = val[0];
        break;
      case 0x8c: // CAN total mileage (0.1 km); keep 0x01 as primary when present
        if (len >= 4) {
          const canKm = val.readUInt32BE(0) / 10;
          out.canOdometerKm = canKm;
          if (out.odometerKm == null) out.odometerKm = canKm;
        }
        break;
      case 0x8e: // oil level
        if (len >= 1) out.oilLevelPercent = val[0];
        break;
      case 0x2b: // some JT808 units: voltage in 0.01 V
        if (len >= 2 && out.externalVoltage == null) {
          out.externalVoltage = val.readUInt16BE(0) / 100;
        }
        break;
      case 0xe1: // internal battery %
        if (len >= 1) out.backupBatteryLevel = val[0];
        break;
      case 0x57: // Micodus alarm extension bitmask
        out.alarmExt = tagHex;
        break;
      case 0xa0: // DTC array (may be empty)
        out.dtcHex = tagHex;
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
