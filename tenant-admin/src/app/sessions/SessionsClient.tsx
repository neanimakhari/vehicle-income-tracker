"use client";

import { useState } from "react";
import { Smartphone, LogOut, Trash2 } from "lucide-react";

type Device = {
  id: string;
  userId: string;
  userRole: string;
  deviceId: string;
  deviceName: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  isTrusted: boolean;
  createdAt: string;
};

type SessionsClientProps = {
  devices: Device[];
  revokeDevice: (formData: FormData) => Promise<void>;
  revokeAllSessions: () => Promise<void>;
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return d.toLocaleString();
  } catch {
    return "—";
  }
}

export function SessionsClient({ devices, revokeDevice, revokeAllSessions }: SessionsClientProps) {
  const [revokingAll, setRevokingAll] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const activeCount = devices.filter((d) => !d.revokedAt).length;

  async function handleRevokeAll() {
    setRevokingAll(true);
    try {
      await revokeAllSessions();
    } finally {
      setRevokingAll(false);
    }
  }

  async function handleRevokeOne(id: string) {
    setRevokingId(id);
    try {
      const fd = new FormData();
      fd.set("id", id);
      await revokeDevice(fd);
    } finally {
      setRevokingId(null);
    }
  }

  return (
    <div className="card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {devices.length} device(s) registered · {activeCount} active
        </p>
        <button
          type="button"
          onClick={handleRevokeAll}
          disabled={revokingAll || activeCount === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/30"
        >
          <LogOut className="h-4 w-4" />
          {revokingAll ? "Revoking…" : "Log out all devices"}
        </button>
      </div>
      {devices.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No devices or sessions recorded yet.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-700">
                <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Device</th>
                <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">User ID</th>
                <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Role</th>
                <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Last seen</th>
                <th className="px-3 py-3 text-left font-medium text-zinc-700 dark:text-zinc-300">Status</th>
                <th className="px-3 py-3 text-right font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
              </tr>
            </thead>
            <tbody>
              {devices.map((d) => {
                const isRevoked = !!d.revokedAt;
                const revoking = revokingId === d.id;
                return (
                  <tr
                    key={d.id}
                    className="border-b border-zinc-100 dark:border-zinc-800"
                  >
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-2 text-zinc-900 dark:text-zinc-50">
                        <Smartphone className="h-4 w-4 text-zinc-400" />
                        {d.deviceName || d.deviceId || "—"}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400 font-mono text-xs">
                      {d.userId}
                    </td>
                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{d.userRole}</td>
                    <td className="px-3 py-3 text-zinc-600 dark:text-zinc-400">{formatDate(d.lastSeenAt)}</td>
                    <td className="px-3 py-3">
                      {isRevoked ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400">
                          Revoked
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {!isRevoked && (
                        <button
                          type="button"
                          onClick={() => handleRevokeOne(d.id)}
                          disabled={revoking}
                          className="inline-flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                          <Trash2 className="h-3 w-3" />
                          {revoking ? "Revoking…" : "Revoke"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
