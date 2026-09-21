const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  parsePacket,
  buildPacket,
  extractFrames,
} = require("../src/micodus/frame");
const { decodePacket, decodeLocationBody, decodeAdditional, bcdTimeToIso } = require("../src/micodus/decoder");
const { buildGeneralAck, buildRegisterAck } = require("../src/micodus/ack");
const {
  buildCommand,
  buildTextMessage,
  buildSetParams,
  PRESETS,
} = require("../src/micodus/downlink");
const { createSessionRegistry } = require("../src/session-registry");
const { createForwarder } = require("../src/forwarder");

describe("micodus frame", () => {
  it("round-trips build/parse", () => {
    const raw = buildPacket(0x0002, "19172682984", 0x015e, Buffer.alloc(0));
    assert.equal(raw[0], 0x7e);
    assert.equal(raw[raw.length - 1], 0x7e);
    const pkt = parsePacket(raw);
    assert.ok(pkt);
    assert.equal(pkt.msgId, 0x0002);
    assert.equal(pkt.serial, 0x015e);
    assert.equal(pkt.terminalId, "19172682984");
  });

  it("parses Traccar-style auth hex", () => {
    const hex = "7e01020007019172682984015e470000000000003b7e";
    const raw = Buffer.from(hex, "hex");
    const pkt = parsePacket(raw);
    assert.ok(pkt);
    assert.equal(pkt.msgId, 0x0102);
    assert.equal(pkt.bodyLen, 7);
    assert.equal(pkt.terminalId, "19172682984");
  });

  it("extractFrames splits multiple", () => {
    const a = buildPacket(0x0002, "1", 1, Buffer.alloc(0));
    const b = buildPacket(0x0002, "1", 2, Buffer.alloc(0));
    const { frames, rest } = extractFrames(Buffer.concat([a, b]));
    assert.equal(frames.length, 2);
    assert.equal(rest.length, 0);
  });
});

describe("micodus decoder", () => {
  it("decodes location with CAN extras", () => {
    // Build a 28-byte location + additional info
    const body = Buffer.alloc(28 + 2 + 2 + 2 + 2 + 2 + 1 + 2 + 2);
    let o = 0;
    body.writeUInt32BE(0, o);
    o += 4; // alarm
    body.writeUInt32BE(0x03, o);
    o += 4; // status: ACC + GPS fix
    body.writeUInt32BE(Math.round(26.2041 * 1e6), o);
    o += 4; // lat (will be south if bit set — not set → north)
    body.writeUInt32BE(Math.round(28.0473 * 1e6), o);
    o += 4;
    body.writeUInt16BE(1600, o);
    o += 2; // alt
    body.writeUInt16BE(420, o);
    o += 2; // 42.0 km/h
    body.writeUInt16BE(90, o);
    o += 2;
    // time 26-03-20 12:00:00 BCD
    Buffer.from("260320120000", "hex").copy(body, o);
    o += 6;
    // extras: rpm 0x81 len2 = 2000, coolant 0x84 len1 = 130 → 90C
    body[o++] = 0x81;
    body[o++] = 2;
    body.writeUInt16BE(2000, o);
    o += 2;
    body[o++] = 0x84;
    body[o++] = 1;
    body[o++] = 130;
    body[o++] = 0x31;
    body[o++] = 1;
    body[o++] = 12;

    const point = decodeLocationBody(body, "356938035643809", "aabb");
    assert.ok(point);
    assert.ok(Math.abs(point.latitude - 26.2041) < 0.0002);
    assert.ok(Math.abs(point.longitude - 28.0473) < 0.0002);
    assert.equal(point.speedKph, 42);
    assert.equal(point.heading, 90);
    assert.equal(point.ignitionOn, true);
    assert.equal(point.gpsFixOk, true);
    assert.equal(point.engineRpm, 2000);
    assert.equal(point.coolantC, 90);
    assert.equal(point.satellites, 12);
    assert.equal(point.source, "micodus");
  });

  it("bcdTimeToIso", () => {
    const iso = bcdTimeToIso(Buffer.from("260320120000", "hex"));
    assert.equal(iso, "2026-03-20T12:00:00.000Z");
  });

  it("decodeAdditional fuel rate", () => {
    const buf = Buffer.alloc(4);
    buf[0] = 0x85;
    buf[1] = 2;
    buf.writeUInt16BE(31, 2); // 3.1 L/h
    const ex = decodeAdditional(buf);
    assert.equal(ex.fuelRateLph, 3.1);
  });

  it("decodes live MV55G location hex (voltage + odo + sats)", () => {
    // Captured 2026-09-21 from terminal 19210227058
    const hex =
      "7e02000047019210227058018c00000000001c00070188d21a01aec33a0004001200c62609211752430104000f497c30011331010c3201093301053401058202008a570800000000000000008c040050d2b4a000c27e";
    const pkt = parsePacket(Buffer.from(hex, "hex"));
    assert.ok(pkt);
    assert.equal(pkt.msgId, 0x0200);
    const d = decodePacket(pkt);
    assert.equal(d.kind, "location");
    assert.ok(d.point);
    assert.equal(d.point.externalVoltage, 13.8);
    assert.equal(d.point.odometerKm, 100185.2);
    assert.equal(d.point.satellites, 12);
    assert.equal(d.point.speedKph, 1.8);
    assert.equal(d.point.ignitionOn, true);
    assert.equal(d.point.gpsFixOk, true);
    assert.equal(d.point.source, "micodus");
  });

  it("treats 0x0202 as location", () => {
    const body = Buffer.alloc(28);
    body.writeUInt32BE(0x03, 4); // ACC + fix
    body.writeUInt32BE(Math.round(25.7 * 1e6), 8);
    body.writeUInt32BE(Math.round(28.2 * 1e6), 12);
    Buffer.from("260921180000", "hex").copy(body, 22);
    const raw = buildPacket(0x0202, "19210227058", 1, body);
    const d = decodePacket(parsePacket(raw));
    assert.equal(d.kind, "location");
    assert.ok(d.point);
  });

  it("forwards alarmFlags and alarmExt from live MV55G hex", () => {
    const hex =
      "7e02000047019210227058018c00000000001c00070188d21a01aec33a0004001200c62609211752430104000f497c30011331010c3201093301053401058202008a570800000000000000008c040050d2b4a000c27e";
    const d = decodePacket(parsePacket(Buffer.from(hex, "hex")));
    assert.equal(d.point.alarmFlags, 0);
    assert.equal(d.point.alarmExt, "0000000000000000");
    assert.equal(d.point.gsmSignal, 0x13);
    assert.equal(d.point.externalVoltage, 13.8);
    assert.ok(d.point.canOdometerKm != null);
  });

  it("maps 0x82 voltage and 0x80 as CAN speed not voltage", () => {
    const buf = Buffer.alloc(8);
    buf[0] = 0x82;
    buf[1] = 2;
    buf.writeUInt16BE(140, 2); // 14.0 V
    buf[4] = 0x80;
    buf[5] = 2;
    buf.writeUInt16BE(55, 6); // 55 km/h CAN
    const ex = decodeAdditional(buf);
    assert.equal(ex.externalVoltage, 14);
    assert.equal(ex.canSpeedKph, 55);
  });

  it("decodePacket heartbeat", () => {
    const raw = buildPacket(0x0002, "123", 9, Buffer.alloc(0));
    const pkt = parsePacket(raw);
    const d = decodePacket(pkt);
    assert.equal(d.kind, "heartbeat");
  });
});

describe("micodus ack", () => {
  it("builds general ack parseable", () => {
    const ack = buildGeneralAck("19172682984", 0x015e, 0x0102, 0);
    const pkt = parsePacket(ack);
    assert.ok(pkt);
    assert.equal(pkt.msgId, 0x8001);
    assert.equal(pkt.body.readUInt16BE(0), 0x015e);
    assert.equal(pkt.body.readUInt16BE(2), 0x0102);
    assert.equal(pkt.body[4], 0);
  });

  it("builds register ack", () => {
    const ack = buildRegisterAck("19172682984", 1, 0, "VIT");
    const pkt = parsePacket(ack);
    assert.equal(pkt.msgId, 0x8100);
    assert.equal(pkt.body.subarray(3).toString("ascii"), "VIT");
  });
});

describe("micodus downlink", () => {
  it("builds SPEED text 0x8300", () => {
    const built = buildCommand("19172682984", 7, { type: "speed_alarm", value: 80 });
    assert.equal(built.kind, "text");
    assert.equal(built.text, "SPEED,80#");
    const pkt = parsePacket(built.frame);
    assert.ok(pkt);
    assert.equal(pkt.msgId, 0x8300);
    assert.equal(pkt.body[0], 0x01);
    assert.equal(pkt.body.subarray(1).toString("utf8"), "SPEED,80#");
  });

  it("builds set-params 0x8103 for max speed", () => {
    const built = buildCommand("19172682984", 8, {
      type: "params",
      maxSpeedKph: 90,
      reportIntervalSec: 30,
    });
    assert.equal(built.kind, "params");
    const pkt = parsePacket(built.frame);
    assert.equal(pkt.msgId, 0x8103);
    assert.equal(pkt.body[0], 2); // two params
  });

  it("exposes Micodus SMS presets", () => {
    assert.equal(PRESETS.vibration(1), "SENALM,1#");
    assert.equal(PRESETS.status(), "STATUS#");
  });

  it("round-trips text message frame", () => {
    const frame = buildTextMessage("1", 1, "TIMER,30#");
    const pkt = parsePacket(frame);
    assert.equal(pkt.msgId, 0x8300);
  });

  it("buildSetParams packs dword values", () => {
    const { dword } = require("../src/micodus/downlink");
    const frame = buildSetParams("1", 2, [{ id: 0x0055, value: dword(60) }]);
    const pkt = parsePacket(frame);
    assert.equal(pkt.msgId, 0x8103);
    assert.equal(pkt.body[0], 1);
  });
});

describe("session registry", () => {
  it("queues command when offline and flushes on register", () => {
    const reg = createSessionRegistry();
    const writes = [];
    const result = reg.send("356938035643809", (terminalId, serial) =>
      buildCommand(terminalId, serial, { type: "status" }),
    );
    assert.equal(result.ok, true);
    assert.equal(result.queued, true);
    assert.equal(result.online, false);

    const fakeSocket = {
      destroyed: false,
      write(buf) {
        writes.push(buf);
      },
    };
    reg.register(fakeSocket, {
      imei: "356938035643809",
      terminalId: "356938035643809",
    });
    assert.ok(writes.length >= 1);
    const pkt = parsePacket(writes[0]);
    assert.equal(pkt.msgId, 0x8300);
  });
});

describe("forwarder coalesce", () => {
  it("latest-wins: N enqueue → 1 flush POST", async () => {
    const posts = [];
    const f = createForwarder({
      flushMs: 10_000,
      maxInflight: 5,
      postIngest: async (p) => {
        posts.push(p);
      },
    });
    for (let i = 0; i < 5; i++) {
      f.enqueue({
        imei: "111",
        latitude: -26,
        longitude: 28,
        speedKph: i,
        source: "micodus",
      });
    }
    assert.equal(f.queueDepth(), 1);
    assert.equal(f.stats.droppedStale, 4);
    await f.flush();
    await new Promise((r) => setTimeout(r, 50));
    assert.equal(posts.length, 1);
    assert.equal(posts[0].speedKph, 4);
    f.stop();
  });
});
