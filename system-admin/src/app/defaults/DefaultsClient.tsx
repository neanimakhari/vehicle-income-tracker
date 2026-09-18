"use client";

import { useState, useTransition } from "react";

type Defaults = {
  applyScope?: string;
  defaultPolicyHints?: {
    recommendMfa?: boolean;
    recommendDriverMfa?: boolean;
    recommendBiometrics?: boolean;
  };
  defaultLimits?: { maxDrivers: number | null; maxStorageMb: number | null };
  defaultPlanCode?: string | null;
};

type Plan = { code: string; name: string; isActive?: boolean };

export function DefaultsClient({
  initial,
  plans,
  saveDefaults,
}: {
  initial: Defaults | null;
  plans: Plan[];
  saveDefaults: (patch: Record<string, unknown>) => Promise<{ ok: boolean; data?: Defaults; error?: string }>;
}) {
  const [data, setData] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const hints = data?.defaultPolicyHints ?? {};
  const limits = data?.defaultLimits ?? { maxDrivers: null, maxStorageMb: null };

  function save(patch: Record<string, unknown>) {
    start(async () => {
      setMsg(null);
      setErr(null);
      const res = await saveDefaults(patch);
      if (!res.ok) {
        setErr(res.error ?? "Failed to save");
        return;
      }
      if (res.data) setData(res.data);
      setMsg("Saved. Applies to new tenants only.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
        These defaults apply to <strong>new tenants only</strong>. Existing fleets are not changed.
      </div>
      {msg ? <p className="text-sm text-emerald-700 dark:text-emerald-400">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Policy for new tenants</h2>
        {(
          [
            ["recommendMfa", "Admin MFA", hints.recommendMfa !== false],
            ["recommendDriverMfa", "Driver MFA", hints.recommendDriverMfa !== false],
            ["recommendBiometrics", "Biometrics", !!hints.recommendBiometrics],
          ] as const
        ).map(([key, label, on]) => (
          <label key={key} className="flex items-center justify-between gap-4 text-sm">
            <span>{label}</span>
            <input
              type="checkbox"
              checked={on}
              disabled={pending}
              onChange={(e) => save({ [key]: e.target.checked })}
            />
          </label>
        ))}
      </div>

      <div className="card space-y-4 p-6">
        <h2 className="text-lg font-semibold">Default limits (new tenants)</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Max drivers
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              defaultValue={limits.maxDrivers ?? ""}
              placeholder="Unlimited"
              disabled={pending}
              onBlur={(e) => {
                const v = e.target.value.trim();
                save({ maxDrivers: v ? Number(v) : null });
              }}
            />
          </label>
          <label className="text-sm">
            Max storage (MB)
            <input
              type="number"
              min={1}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
              defaultValue={limits.maxStorageMb ?? ""}
              placeholder="Unlimited"
              disabled={pending}
              onBlur={(e) => {
                const v = e.target.value.trim();
                save({ maxStorageMb: v ? Number(v) : null });
              }}
            />
          </label>
        </div>
        <label className="block text-sm">
          Default plan
          <select
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            value={data?.defaultPlanCode ?? ""}
            disabled={pending}
            onChange={(e) => save({ defaultPlanCode: e.target.value || null })}
          >
            <option value="">None</option>
            {plans.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
