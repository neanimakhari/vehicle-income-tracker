"use client";

import { useState, useTransition } from "react";

type Announcement = {
  enabled: boolean;
  severity: "info" | "maintenance";
  message: string;
  startsAt: string | null;
  endsAt: string | null;
  blockWrites: boolean;
};

export function AnnouncementClient({
  initial,
  save,
}: {
  initial: Announcement;
  save: (patch: Partial<Announcement>) => Promise<{ ok: boolean; data?: Announcement; error?: string }>;
}) {
  const [data, setData] = useState(initial);
  const [msg, setMsg] = useState(data.message);
  const [pending, start] = useTransition();
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function persist(patch: Partial<Announcement>) {
    start(async () => {
      setStatus(null);
      setErr(null);
      const res = await save(patch);
      if (!res.ok) {
        setErr(res.error ?? "Failed");
        return;
      }
      if (res.data) setData(res.data);
      setStatus("Saved.");
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-900">
        Info banners are dismissible notices. Maintenance can optionally soft-block writes in tenant-admin (when enabled).
        Always set an end time for maintenance.
      </div>
      {status ? <p className="text-sm text-emerald-700">{status}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="card space-y-4 p-6">
        <label className="flex items-center justify-between text-sm">
          Enabled
          <input
            type="checkbox"
            checked={data.enabled}
            disabled={pending}
            onChange={(e) => persist({ enabled: e.target.checked, message: msg })}
          />
        </label>
        <label className="block text-sm">
          Severity
          <select
            className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            value={data.severity}
            disabled={pending}
            onChange={(e) =>
              persist({ severity: e.target.value as "info" | "maintenance", message: msg })
            }
          >
            <option value="info">Info</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </label>
        <label className="block text-sm">
          Message
          <textarea
            className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            rows={3}
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onBlur={() => persist({ message: msg })}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            Starts at (ISO optional)
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="2026-09-18T18:00:00Z"
              defaultValue={data.startsAt ?? ""}
              onBlur={(e) => persist({ startsAt: e.target.value.trim() || null, message: msg })}
            />
          </label>
          <label className="block text-sm">
            Ends at (ISO optional)
            <input
              className="mt-1 w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              placeholder="2026-09-18T20:00:00Z"
              defaultValue={data.endsAt ?? ""}
              onBlur={(e) => persist({ endsAt: e.target.value.trim() || null, message: msg })}
            />
          </label>
        </div>
        <label className="flex items-center justify-between text-sm">
          Soft-block writes during maintenance
          <input
            type="checkbox"
            checked={data.blockWrites}
            disabled={pending || data.severity !== "maintenance"}
            onChange={(e) => persist({ blockWrites: e.target.checked, message: msg })}
          />
        </label>
      </div>
    </div>
  );
}
