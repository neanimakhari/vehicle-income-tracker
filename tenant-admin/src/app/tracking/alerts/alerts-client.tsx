"use client";

import { useEffect, useState } from "react";

type Rule = {
  id: string;
  name: string;
  trigger: string;
  thresholdMinutes: number;
  channels: string[];
  isActive: boolean;
  cooldownMinutes: number;
};

type Recipient = {
  id: string;
  email: string;
  label?: string | null;
  isActive: boolean;
};

type Settings = {
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  overspeedKph?: number;
  offlineMinutes?: number;
  lowVoltageThreshold?: number;
};

const TRIGGERS = [
  "overspeed",
  "engine_start",
  "engine_stop",
  "power_loss",
  "low_voltage",
  "offline",
  "enter_forbidden",
  "off_corridor_minutes",
  "rank_dwell_minutes",
  "enter_rank",
];

export function AlertsClient({
  initialRules,
  initialFires,
  initialEvents = [],
}: {
  initialRules: Rule[];
  initialFires: Array<Record<string, unknown>>;
  initialEvents?: Array<Record<string, unknown>>;
}) {
  const [rules, setRules] = useState(initialRules);
  const [fires, setFires] = useState(initialFires);
  const [events, setEvents] = useState(initialEvents);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [settings, setSettings] = useState<Settings>({});
  const [name, setName] = useState("Overspeed alert");
  const [trigger, setTrigger] = useState("overspeed");
  const [threshold, setThreshold] = useState(5);
  const [email, setEmail] = useState("");
  const [emailLabel, setEmailLabel] = useState("");
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [recRes, setRes] = await Promise.all([
          fetch("/api/proxy/tenant/tracking/alert-recipients"),
          fetch("/api/proxy/tenant/tracking/geofences/settings"),
        ]);
        if (recRes.ok) {
          const rows = await recRes.json();
          setRecipients(Array.isArray(rows) ? rows : []);
        }
        if (setRes.ok) {
          const s = (await setRes.json()) as Settings;
          setSettings(s);
          setQuietStart(s.quietHoursStart ?? "");
          setQuietEnd(s.quietHoursEnd ?? "");
        }
      } catch {
        /* ignore bootstrap errors */
      }
    })();
  }, []);

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

  async function addRecipient() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/proxy/tenant/tracking/alert-recipients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          label: emailLabel || null,
          isActive: true,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          typeof body.message === "string"
            ? body.message
            : `Add failed (${res.status})`,
        );
      }
      const row = await res.json();
      setRecipients((prev) => [...prev, row]);
      setEmail("");
      setEmailLabel("");
      setInfo("Recipient added (also used for monthly reports).");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function removeRecipient(id: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/tenant/tracking/alert-recipients/${id}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error(`Remove failed (${res.status})`);
      setRecipients((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveQuietHours() {
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/proxy/tenant/tracking/geofences/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quietHoursStart: quietStart || null,
          quietHoursEnd: quietEnd || null,
        }),
      });
      if (!res.ok) throw new Error(`Save failed (${res.status})`);
      const s = (await res.json()) as Settings;
      setSettings(s);
      setQuietStart(s.quietHoursStart ?? "");
      setQuietEnd(s.quietHoursEnd ?? "");
      setInfo(
        s.quietHoursStart && s.quietHoursEnd
          ? `Quiet hours ${s.quietHoursStart}–${s.quietHoursEnd} (Africa/Johannesburg). Fires still log; email pauses.`
          : "Quiet hours cleared — alert emails send anytime.",
      );
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

  async function refreshEvents() {
    const res = await fetch("/api/proxy/tenant/tracking/events?limit=40");
    if (res.ok) setEvents(await res.json());
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-zinc-500">Tracking alerts</p>
        <h1 className="text-2xl font-semibold">Tracking alert rules</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Geofence rules plus overspeed, engine, power, and voltage alerts from live tracker data.
        </p>
      </div>
      {error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : null}
      {info ? (
        <p className="text-sm text-teal-700 dark:text-teal-300">{info}</p>
      ) : null}

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Alert email recipients</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Same list as monthly report recipients. Empty list falls back to ops mail.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@example.com"
          />
          <input
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            value={emailLabel}
            onChange={(e) => setEmailLabel(e.target.value)}
            placeholder="Label (optional)"
          />
          <button
            type="button"
            disabled={busy || !email.trim()}
            onClick={addRecipient}
            className="rounded-md bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Add recipient
          </button>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {recipients.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded-md border border-zinc-100 px-3 py-2 dark:border-zinc-800"
            >
              <span>
                {r.email}
                {r.label ? (
                  <span className="text-zinc-500"> · {r.label}</span>
                ) : null}
                {!r.isActive ? (
                  <span className="ml-2 text-xs text-amber-600">inactive</span>
                ) : null}
              </span>
              <button
                type="button"
                className="text-xs text-red-600 underline"
                disabled={busy}
                onClick={() => removeRecipient(r.id)}
              >
                Remove
              </button>
            </li>
          ))}
          {!recipients.length ? (
            <li className="text-zinc-500">No recipients yet.</li>
          ) : null}
        </ul>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="font-medium">Quiet hours</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Africa/Johannesburg. Leave blank to send anytime. Overspeed threshold:{" "}
          {settings.overspeedKph ?? "—"} km/h · offline after{" "}
          {settings.offlineMinutes ?? "—"} min.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-xs text-zinc-500">
            Start
            <input
              type="time"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={quietStart}
              onChange={(e) => setQuietStart(e.target.value)}
            />
          </label>
          <label className="text-xs text-zinc-500">
            End
            <input
              type="time"
              className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              value={quietEnd}
              onChange={(e) => setQuietEnd(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={saveQuietHours}
            className="self-end rounded-md bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900"
          >
            Save quiet hours
          </button>
        </div>
      </div>

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
        <h2 className="font-medium">Live tracker events</h2>
        <button type="button" className="text-sm underline" onClick={refreshEvents}>
          Refresh
        </button>
      </div>
      <ul className="max-h-64 space-y-2 overflow-auto text-sm">
        {events.map((e) => (
          <li
            key={String(e.id)}
            className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
          >
            <span className="font-mono text-xs text-zinc-500">{String(e.eventType)}</span>{" "}
            <span className="text-zinc-500">
              {e.recordedAt ? new Date(String(e.recordedAt)).toLocaleString() : ""}
            </span>
            <div>{String(e.message ?? "")}</div>
          </li>
        ))}
        {!events.length ? (
          <li className="text-zinc-500">No tracker events yet — wait for live ingest.</li>
        ) : null}
      </ul>

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
