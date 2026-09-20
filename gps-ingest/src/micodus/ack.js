/**
 * Micodus / JT808 platform responses.
 */

const { buildPacket } = require("./frame");

/** General response 0x8001 — result 0 = success. */
function buildGeneralAck(terminalId, serial, replyMsgId, result = 0) {
  const body = Buffer.alloc(5);
  body.writeUInt16BE(serial & 0xffff, 0);
  body.writeUInt16BE(replyMsgId & 0xffff, 2);
  body.writeUInt8(result & 0xff, 4);
  // Platform serial can be independent; reuse device serial for simplicity
  return buildPacket(0x8001, terminalId, serial, body);
}

/** Terminal register response 0x8100. */
function buildRegisterAck(terminalId, serial, result = 0, authCode = "VIT") {
  const auth = Buffer.from(String(authCode), "ascii");
  const body = Buffer.alloc(3 + auth.length);
  body.writeUInt16BE(serial & 0xffff, 0);
  body.writeUInt8(result & 0xff, 2);
  auth.copy(body, 3);
  return buildPacket(0x8100, terminalId, serial, body);
}

module.exports = {
  buildGeneralAck,
  buildRegisterAck,
};
