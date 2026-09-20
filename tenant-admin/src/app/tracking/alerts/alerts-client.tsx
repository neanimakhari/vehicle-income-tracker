"use client";

import { useState } from "react";

type Rule = {
  id: string;
  name: string;
  trigger: string;
  thresholdMinutes: number;
  channels: string[];
  isActive: boolean;
  cooldownMinutes: number;
};

const TRIGGERS = [
  "enter_forbidden",
  "off_corridor_minutes",
  "rank_dwell_minutes",
  "enter_rank",
  "exit_home_after_hours",
];

export function AlertsClient({
  initialRules,
  initialFires,
}: {
  initialRules: Rule[];
  initialFires: Array<Record<string, unknown>>;
}) {
  const [rules, setRules] = useState(initialRules);
  const [fires, setFires] = useState(initialFires);
  const [name, setName] = useState("Forbidden enter");
  const [trigger, setTrigger] = useState(TRIGGERS[0]);
  const [threshold, setThreshold] = useState(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/proxy/tenant/tracking/alert-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          trigger,
          thresholdMinutes: threshold,
          channels: ["in_app", "email"],
          cooldownMinutes: 30,
        }),
      });
      if (!res.ok) throw new Error(`Create failed (${res.status})`);
      const rule = await res.json();
      setRules((prev) => [...prev, rule]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function refreshFires() {
    const res = await fetch("/api/proxy/tenant/tracking/alert-rules/fires/recent");
    if (res.ok) setFires(await res.json());
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Tracking alerts</p>
        <h1 className="text-2xl font-semibold">Geofence alert rules</h1>
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
      <div className="grid gap-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 sm:grid-cols-4">
        <input
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rule name"
        />
        <select
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={trigger}
          onChange={(e) => setTrigger(e.target.value)}
        >
          {TRIGGERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          placeholder="Threshold minutes"
        />
        <button
          type="button"
          disabled={busy}
          onClick={create}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
        >
          Add rule
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="px-3 py-2 text-left">Name</th>
              <th className="px-3 py-2 text-left">Trigger</th>
              <th className="px-3 py-2 text-left">Threshold</th>
              <th className="px-3 py-2 text-left">Active</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.trigger}</td>
                <td className="px-3 py-2">{r.thresholdMinutes} min</td>
                <td className="px-3 py-2">{r.isActive ? "yes" : "no"}</td>
              </tr>
            ))}
            {!rules.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                  No rules yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-medium">Recent fires</h2>
        <button type="button" className="text-sm underline" onClick={refreshFires}>
          Refresh
        </button>
      </div>
      <ul className="space-y-2 text-sm">
        {fires.map((f) => (
          <li
            key={String(f.id)}
            className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
          >
            <span className="text-zinc-500">
              {f.fired_at ? new Date(String(f.fired_at)).toLocaleString() : ""}
            </span>{" "}
            — {String(f.message)}
          </li>
        ))}
        {!fires.length ? (
          <li className="text-zinc-500">No alert fires yet.</li>
        ) : null}
      </ul>
    </div>
  );
}
