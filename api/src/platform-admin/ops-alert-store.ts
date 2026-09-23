export type OpsAlertRecord = {
  type: 'ops_5xx';
  at: string;
  message: string;
  metadata: {
    method: string;
    path: string;
    status: number;
    detail: string;
  };
};

/** In-memory ring buffer of recent 5xx ops events (process-local). */
const MAX = 50;
const buffer: OpsAlertRecord[] = [];

export const OpsAlertStore = {
  push(entry: Omit<OpsAlertRecord, 'type' | 'at'> & { at?: string }) {
    const record: OpsAlertRecord = {
      type: 'ops_5xx',
      at: entry.at ?? new Date().toISOString(),
      message: entry.message,
      metadata: entry.metadata,
    };
    buffer.unshift(record);
    if (buffer.length > MAX) buffer.length = MAX;
  },

  list(limit = 25): OpsAlertRecord[] {
    return buffer.slice(0, Math.max(1, Math.min(limit, MAX)));
  },
};
