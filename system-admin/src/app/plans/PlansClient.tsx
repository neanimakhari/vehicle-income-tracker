"use client";

import { useMemo, useState, useTransition } from "react";

type Module = { key: string; name?: string; label?: string };
type Plan = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  maxDriversDefault?: number | null;
  maxStorageMbDefault?: number | null;
  isActive: boolean;
  moduleKeys: string[];
  tenantCount?: number;
};

export function PlansClient({
  initialPlans,
  modules,
  savePlanModules,
  createPlan,
  updatePlan,
}: {
  initialPlans: Plan[];
  modules: Module[];
  savePlanModules: (
    planId: string,
    moduleKeys: string[],
  ) => Promise<{ ok: boolean; error?: string; plan?: Plan }>;
  createPlan: (payload: {
    code: string;
    name: string;
    description?: string;
    moduleKeys: string[];
  }) => Promise<{ ok: boolean; error?: string }>;
  updatePlan: (
    planId: string,
    payload: { name?: string; isActive?: boolean; description?: string | null },
  ) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [plans, setPlans] = useState(initialPlans);
  const [selectedId, setSelectedId] = useState(plans[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const selected = useMemo(
    () => plans.find((p) => p.id === selectedId) ?? null,
    [plans, selectedId],
  );

  function toggleModule(key: string) {
    if (!selected) return;
    const next = selected.moduleKeys.includes(key)
      ? selected.moduleKeys.filter((k) => k !== key)
      : [...selected.moduleKeys, key];
    const count = selected.tenantCount ?? 0;
    if (
      count > 0 &&
      selected.moduleKeys.includes(key) &&
      !window.confirm(
        `This plan is used by ${count} tenant(s). Turning off "${key}" may hide that feature for them immediately. Continue?`,
      )
    ) {
      return;
    }
    start(async () => {
      setErr(null);
      setMsg(null);
      const res = await savePlanModules(selected.id, next);
      if (!res.ok) {
        setErr(res.error ?? "Failed");
        return;
      }
      if (res.plan) {
        setPlans((prev) => prev.map((p) => (p.id === res.plan!.id ? res.plan! : p)));
      } else {
        setPlans((prev) =>
          prev.map((p) => (p.id === selected.id ? { ...p, moduleKeys: next } : p)),
        );
      }
      setMsg("Plan modules updated.");
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Changing modules on a plan affects every tenant on that plan (unless overridden).
        </p>
        <button
          type="button"
          className="btn-primary"
          onClick={() => setShowCreate(true)}
        >
          New plan
        </button>
      </div>
      {msg ? <p className="text-sm text-emerald-700">{msg}</p> : null}
      {err ? <p className="text-sm text-red-600">{err}</p> : null}

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="card p-3 space-y-1">
          {plans.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm ${
                p.id === selectedId
                  ? "bg-teal-600 text-white"
                  : "hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              <div className="font-medium">{p.name}</div>
              <div className="text-xs opacity-80">
                {p.code} · {p.tenantCount ?? 0} tenants
                {!p.isActive ? " · inactive" : ""}
              </div>
            </button>
          ))}
        </div>

        {selected ? (
          <div className="card space-y-4 p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{selected.name}</h2>
                <p className="text-sm text-zinc-500">{selected.description || selected.code}</p>
              </div>
              <label className="flex items-center gap-2 text-sm">
                Active
                <input
                  type="checkbox"
                  checked={selected.isActive}
                  disabled={pending}
                  onChange={(e) => {
                    const isActive = e.target.checked;
                    start(async () => {
                      const res = await updatePlan(selected.id, { isActive });
                      if (!res.ok) setErr(res.error ?? "Failed");
                      else {
                        setPlans((prev) =>
                          prev.map((p) =>
                            p.id === selected.id ? { ...p, isActive } : p,
                          ),
                        );
                      }
                    });
                  }}
                />
              </label>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Modules
              </h3>
              {modules.map((m) => {
                const key = m.key;
                const on = selected.moduleKeys.includes(key);
                return (
                  <label
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                  >
                    <span>{m.name || m.label || key}</span>
                    <input
                      type="checkbox"
                      checked={on}
                      disabled={pending}
                      onChange={() => toggleModule(key)}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">No plans yet.</p>
        )}
      </div>

      {showCreate ? (
        <CreatePlanModal
          modules={modules}
          onClose={() => setShowCreate(false)}
          onCreate={async (payload) => {
            const res = await createPlan(payload);
            if (!res.ok) return res.error ?? "Failed";
            window.location.reload();
            return null;
          }}
        />
      ) : null}
    </div>
  );
}

function CreatePlanModal({
  modules,
  onClose,
  onCreate,
}: {
  modules: Module[];
  onClose: () => void;
  onCreate: (payload: {
    code: string;
    name: string;
    description?: string;
    moduleKeys: string[];
  }) => Promise<string | null>;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [keys, setKeys] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-950">
        <h3 className="text-lg font-semibold">New plan</h3>
        <div className="mt-4 space-y-3">
          <input
            className="w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Code (e.g. growth)"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <input
            className="w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="w-full rounded-lg border px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {modules.map((m) => (
              <label key={m.key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={keys.includes(m.key)}
                  onChange={(e) =>
                    setKeys((prev) =>
                      e.target.checked
                        ? [...prev, m.key]
                        : prev.filter((k) => k !== m.key),
                    )
                  }
                />
                {m.name || m.key}
              </label>
            ))}
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              const e = await onCreate({
                code: code.trim().toLowerCase(),
                name: name.trim(),
                description: description.trim() || undefined,
                moduleKeys: keys,
              });
              setBusy(false);
              if (e) setError(e);
            }}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
