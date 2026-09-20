/**
 * Per-socket Micodus session: terminalId / IMEI after register or first packet.
 */

class MicodusSession {
  constructor() {
    /** @type {string | null} */
    this.terminalId = null;
    /** @type {string | null} */
    this.imei = null;
    this.authed = false;
    this.connectedAt = new Date().toISOString();
    this.lastMsgAt = null;
    this.msgCount = 0;
  }

  /**
   * @param {{ kind: string, terminalId: string, imei?: string }} decoded
   */
  note(decoded) {
    this.lastMsgAt = new Date().toISOString();
    this.msgCount += 1;
    this.terminalId = decoded.terminalId || this.terminalId;
    if (decoded.imei) this.imei = String(decoded.imei);
    if (decoded.kind === "register" || decoded.kind === "auth" || decoded.kind === "location") {
      this.authed = true;
    }
  }

  /** IMEI used for Nest bind lookup */
  deviceImei() {
    return this.imei || this.terminalId;
  }
}

module.exports = { MicodusSession };
