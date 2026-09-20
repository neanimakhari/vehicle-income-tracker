const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  parsePacket,
  buildPacket,
  extractFrames,
} = require("../src/micodus/frame");
const { decodePacket, decodeLocationBody, decodeAdditional, bcdTimeToIso } = require("../src/micodus/decoder");
const { buildGeneralAck, buildRegisterAck } = require("../src/micodus/ack");
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
