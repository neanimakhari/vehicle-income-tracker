"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fetchJsonClient } from "@/lib/api-client";
import { useNotificationLive } from "@/components/notification-live";

type InboxRow = {
  id: string;
  title: string;
  message: string;
  source: string;
  deepLink: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationsInbox() {
  const { refreshUnread } = useNotificationLive();
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const data = await fetchJsonClient<InboxRow[]>(
      "/api/proxy/tenant/notifications",
      { tolerate401: true },
    );
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const onCreated = () => void load();
    window.addEventListener("vit:incident-created", onCreated);
    return () => window.removeEventListener("vit:incident-created", onCreated);
  }, []);

  async function markRead(id: string) {
    await fetchJsonClient(`/api/proxy/tenant/notifications/${id}/read`, {
      method: "POST",
      tolerate401: true,
    });
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, read: true } : r)),
    );
    refreshUnread();
  }

  async function markAll() {
    await fetchJsonClient("/api/proxy/tenant/notifications/read-all", {
      method: "POST",
      tolerate401: true,
    });
    setRows((prev) => prev.map((r) => ({ ...r, read: true })));
    refreshUnread();
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Inbox
        </h2>
        <button
          type="button"
          onClick={() => void markAll()}
          className="text-xs font-medium text-teal-700 hover:underline dark:text-teal-300"
        >
          Mark all read
        </button>
      </div>
      {loading ? (
        <p className="text-sm text-zinc-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">No inbox messages yet.</p>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rows.map((row) => {
            const href =
              row.deepLink?.startsWith("/")
                ? row.deepLink
                : row.source === "incident"
                  ? "/incidents"
                  : null;
            return (
              <li
                key={row.id}
                className={`py-3 ${row.read ? "opacity-70" : ""}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {row.title}
                      </span>
                      {!row.read ? (
                        <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                          New
                        </span>
                      ) : null}
                      <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                        {row.source}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                      {row.message}
                    </p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {new Date(row.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    {href ? (
                      <Link
                        href={href}
                        className="font-medium text-teal-700 hover:underline dark:text-teal-300"
                      >
                        Open
                      </Link>
                    ) : null}
                    {!row.read ? (
                      <button
                        type="button"
                        onClick={() => void markRead(row.id)}
                        className="font-medium text-zinc-600 hover:underline dark:text-zinc-300"
                      >
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
