"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";

type Rule = {
  id: string;
  scope: "tenant" | "driver";
  driverUserId: string | null;
  ruleType: "weekday" | "date_range" | "exact_date" | "closed";
  amount: number | null;
  weekdays: number[] | null;
  startDate: string | null;
  endDate: string | null;
  exactDate: string | null;
  priority: number;
  isActive: boolean;
};

type DriverOption = { id: string; label: string };

const WEEKDAYS = [
  { v: 0, l: "Sun" },
  { v: 1, l: "Mon" },
  { v: 2, l: "Tue" },
  { v: 3, l: "Wed" },
  { v: 4, l: "Thu" },
  { v: 5, l: "Fri" },
  { v: 6, l: "Sat" },
];

function describeRule(r: Rule) {
  const scope = r.scope === "tenant" ? "All drivers" : "One driver";
  if (r.ruleType === "closed") {
    if (r.exactDate) return `${scope}: Closed on ${r.exactDate}`;
    if (r.startDate && r.endDate)
      return `${scope}: Closed ${r.startDate} → ${r.endDate}`;
    if (r.weekdays?.length)
      return `${scope}: Closed on ${r.weekdays.map((d) => WEEKDAYS.find((w) => w.v === d)?.l).join(", ")}`;
    return `${scope}: Closed`;
  }
  const amt = r.amount != null ? `R ${Number(r.amount).toLocaleString()}` : "—";
  if (r.ruleType === "weekday")
    return `${scope}: ${amt} on ${(r.weekdays ?? []).map((d) => WEEKDAYS.find((w) => w.v === d)?.l).join(", ")}`;
  if (r.ruleType === "exact_date") return `${scope}: ${amt} on ${r.exactDate}`;
  return `${scope}: ${amt} ${r.startDate} → ${r.endDate}`;
}

export function TargetCalendarClient({
  initialRules,
  drivers,
}: {
  initialRules: Rule[];
  drivers: DriverOption[];
}) {
  const [rules, setRules] = useState(initialRules);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [ruleType, setRuleType] = useState<Rule["ruleType"]>("weekday");
  const [scope, setScope] = useState<"tenant" | "driver">("tenant");
  const [driverUserId, setDriverUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [exactDate, setExactDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [priority, setPriority] = useState("0");

  const driverLabel = useMemo(() => {
    const m = new Map(drivers.map((d) => [d.id, d.label]));
    return (id: string | null) => (id ? m.get(id) ?? id.slice(0, 8) : "");
  }, [drivers]);

  function toggleWeekday(v: number) {
    setWeekdays((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v].sort(),
    );
  }

  async function refresh() {
    const res = await fetch("/api/proxy/tenant/target-rules");
    if (res.ok) {
      const data = (await res.json()) as Rule[];
      setRules(data);
    }
  }

  async function createRule(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const body: Record<string, unknown> = {
        scope,
        ruleType,
        priority: Number(priority) || 0,
        isActive: true,
      };
      if (scope === "driver") body.driverUserId = driverUserId;
      if (ruleType !== "closed") {
        const n = Number(amount);
        if (Number.isNaN(n) || n < 0) {
          setMessage("Enter a valid amount.");
          return;
        }
        body.amount = n;
      }
      if (ruleType === "weekday" || (ruleType === "closed" && weekdays.length && !exactDate && !startDate)) {
        body.weekdays = weekdays;
      }
      if (ruleType === "exact_date" || (ruleType === "closed" && exactDate)) {
        body.exactDate = exactDate;
      }
      if (ruleType === "date_range" || (ruleType === "closed" && startDate && endDate)) {
        body.startDate = startDate;
        body.endDate = endDate;
      }

      const res = await fetch("/api/proxy/tenant/target-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { message?: string | string[] }).message;
        setMessage(Array.isArray(msg) ? msg.join(", ") : msg ?? "Could not create rule");
        return;
      }
      setMessage("Rule saved.");
      setAmount("");
      await refresh();
    } catch {
      setMessage("Could not create rule.");
    } finally {
      setBusy(false);
    }
  }

  async function removeRule(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/proxy/tenant/target-rules/${id}`, { method: "DELETE" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
          <CalendarDays className="h-6 w-6 text-teal-600 dark:text-teal-400" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            Target calendar
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Weekday amounts, date ranges, exact-day overrides, and closed days (no target enforced).
            Driver rules override tenant rules. Flat defaults still apply when no rule matches.
          </p>
        </div>
      </div>

      <form onSubmit={createRule} className="card space-y-4 p-6">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Add rule</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="text-sm">
            Type
            <select
              className="input mt-1 w-full"
              value={ruleType}
              onChange={(e) => setRuleType(e.target.value as Rule["ruleType"])}
            >
              <option value="weekday">Weekday amount</option>
              <option value="date_range">Date range amount</option>
              <option value="exact_date">Exact date amount</option>
              <option value="closed">Closed (no target)</option>
            </select>
          </label>
          <label className="text-sm">
            Scope
            <select
              className="input mt-1 w-full"
              value={scope}
              onChange={(e) => setScope(e.target.value as "tenant" | "driver")}
            >
              <option value="tenant">All drivers</option>
              <option value="driver">One driver</option>
            </select>
          </label>
          {scope === "driver" && (
            <label className="text-sm">
              Driver
              <select
                className="input mt-1 w-full"
                required
                value={driverUserId}
                onChange={(e) => setDriverUserId(e.target.value)}
              >
                <option value="">Select…</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {ruleType !== "closed" && (
            <label className="text-sm">
              Amount (R)
              <input
                className="input mt-1 w-full"
                inputMode="decimal"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
          )}
          <label className="text-sm">
            Priority
            <input
              className="input mt-1 w-full"
              type="number"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            />
          </label>
        </div>

        {(ruleType === "weekday" ||
          (ruleType === "closed" && !exactDate && !startDate)) && (
          <div>
            <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">Weekdays</p>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((w) => (
                <button
                  key={w.v}
                  type="button"
                  onClick={() => toggleWeekday(w.v)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    weekdays.includes(w.v)
                      ? "bg-teal-600 text-white"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {w.l}
                </button>
              ))}
            </div>
          </div>
        )}

        {(ruleType === "exact_date" || ruleType === "closed") && (
          <label className="block text-sm max-w-xs">
            Exact date {ruleType === "closed" ? "(or use weekdays / range below)" : ""}
            <input
              type="date"
              className="input mt-1 w-full"
              value={exactDate}
              onChange={(e) => setExactDate(e.target.value)}
              required={ruleType === "exact_date"}
            />
          </label>
        )}

        {(ruleType === "date_range" || ruleType === "closed") && (
          <div className="flex flex-wrap gap-4">
            <label className="text-sm">
              Start
              <input
                type="date"
                className="input mt-1"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required={ruleType === "date_range"}
              />
            </label>
            <label className="text-sm">
              End
              <input
                type="date"
                className="input mt-1"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                required={ruleType === "date_range"}
              />
            </label>
          </div>
        )}

        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Plus className="mr-1 inline h-4 w-4" />
          {busy ? "Saving…" : "Add rule"}
        </button>
        {message && (
          <p className="text-sm text-teal-700 dark:text-teal-300">{message}</p>
        )}
      </form>

      <div className="card overflow-hidden">
        <div className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-700">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-50">
            Active rules ({rules.length})
          </h2>
        </div>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {rules.length === 0 && (
            <li className="px-6 py-8 text-sm text-zinc-500">No calendar rules yet.</li>
          )}
          {rules.map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between gap-3 px-6 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {describeRule(r)}
                </p>
                <p className="text-xs text-zinc-500">
                  {r.ruleType}
                  {r.scope === "driver" && r.driverUserId
                    ? ` · ${driverLabel(r.driverUserId)}`
                    : ""}
                  {` · priority ${r.priority}`}
                  {!r.isActive ? " · inactive" : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => removeRule(r.id)}
                className="rounded p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                aria-label="Delete rule"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
