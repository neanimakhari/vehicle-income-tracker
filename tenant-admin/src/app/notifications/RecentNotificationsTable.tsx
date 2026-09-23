"use client";

import { useState } from "react";

export type SentNotificationRow = {
  id: string;
  title: string;
  message: string;
  targetRole: string | null;
  status: string;
  source?: string;
  createdAt: string;
  audienceCount?: number;
  readCount?: number;
};

type Reader = {
  userId: string;
  displayName: string | null;
  email: string | null;
  role: string;
  readAt: string;
};

type DeliveryStats = {
  notificationId: string;
  audienceCount: number;
  readCount: number;
  unreadCount: number;
  reads: Reader[];
};

export function RecentNotificationsTable({
  notifications,
  loadReads,
}: {
  notifications: SentNotificationRow[];
  loadReads: (id: string) => Promise<DeliveryStats | { error: string }>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [stats, setStats] = useState<DeliveryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null);
      setStats(null);
      setError(null);
      return;
    }
    setOpenId(id);
    setStats(null);
    setError(null);
    setLoading(true);
    try {
      const res = await loadReads(id);
      if ("error" in res) {
        setError(res.error);
      } else {
        setStats(res);
      }
    } catch {
      setError("Failed to load readers");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
        <thead className="bg-zinc-50 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2 text-left text-xs font-semibold">Date</th>
            <th className="px-3 py-2 text-left text-xs font-semibold">Title</th>
            <th className="px-3 py-2 text-left text-xs font-semibold">Target</th>
            <th className="px-3 py-2 text-left text-xs font-semibold">Status</th>
            <th className="px-3 py-2 text-left text-xs font-semibold">Read</th>
            <th className="px-3 py-2 text-left text-xs font-semibold">Who</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {notifications.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-sm text-zinc-500">
                No notifications yet.
              </td>
            </tr>
          ) : (
            notifications.map((n) => {
              const audience = n.audienceCount ?? 0;
              const read = n.readCount ?? 0;
              const isOpen = openId === n.id;
              return (
                <>
                  <tr key={n.id}>
                    <td className="px-3 py-2 text-sm whitespace-nowrap">
                      {new Date(n.createdAt).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <div className="font-medium">{n.title}</div>
                      {n.source && n.source !== "manual" ? (
                        <div className="text-xs text-zinc-500">{n.source}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      {n.targetRole === "TENANT_USER"
                        ? "Drivers"
                        : n.targetRole === "TENANT_ADMIN"
                          ? "Admins"
                          : "All"}
                    </td>
                    <td className="px-3 py-2 text-sm font-mono text-xs">{n.status}</td>
                    <td className="px-3 py-2 text-sm tabular-nums">
                      {audience > 0 ? (
                        <span
                          className={
                            read >= audience
                              ? "text-emerald-700 dark:text-emerald-400"
                              : "text-zinc-800 dark:text-zinc-200"
                          }
                          title={`${read} of ${audience} audience marked read in-app`}
                        >
                          {read}/{audience}
                        </span>
                      ) : (
                        <span className="text-zinc-400">{read}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-sm">
                      <button
                        type="button"
                        className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-400"
                        onClick={() => void toggle(n.id)}
                      >
                        {isOpen ? "Hide" : "Who read"}
                      </button>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr key={`${n.id}-detail`}>
                      <td colSpan={6} className="bg-zinc-50 px-3 py-3 dark:bg-zinc-900/60">
                        {loading ? (
                          <p className="text-xs text-zinc-500">Loading readers…</p>
                        ) : error ? (
                          <p className="text-xs text-red-600">{error}</p>
                        ) : stats ? (
                          <div className="space-y-2">
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">
                              In-app reads: {stats.readCount} · Audience: {stats.audienceCount} ·
                              Unread: {stats.unreadCount}
                              <span className="ml-1 text-zinc-400">
                                (push delivery is separate from in-app open)
                              </span>
                            </p>
                            {stats.reads.length === 0 ? (
                              <p className="text-xs text-zinc-500">No one has opened this yet.</p>
                            ) : (
                              <ul className="max-h-48 space-y-1 overflow-auto text-sm">
                                {stats.reads.map((r) => (
                                  <li
                                    key={`${r.userId}-${r.readAt}`}
                                    className="flex flex-wrap items-baseline justify-between gap-2 rounded border border-zinc-200 px-2 py-1.5 dark:border-zinc-700"
                                  >
                                    <span>
                                      <span className="font-medium">
                                        {r.displayName || r.email || r.userId.slice(0, 8)}
                                      </span>
                                      {r.email && r.displayName && r.email !== r.displayName ? (
                                        <span className="ml-2 text-xs text-zinc-500">{r.email}</span>
                                      ) : null}
                                      <span className="ml-2 text-[10px] uppercase tracking-wide text-zinc-400">
                                        {r.role === "TENANT_ADMIN" ? "admin" : "driver"}
                                      </span>
                                    </span>
                                    <span className="text-xs text-zinc-500">
                                      {new Date(r.readAt).toLocaleString()}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
