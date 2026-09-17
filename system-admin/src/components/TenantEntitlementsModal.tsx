"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

type Plan = {
  id: string;
  code: string;
  name: string;
  moduleKeys: string[];
  maxDriversDefault: number | null;
};

type ModuleRow = { key: string; name: string; description: string | null };

type Entitlement = {
  tenantId: string;
  planId: string | null;
  moduleOverrides: Record<string, boolean>;
  entitlements: string[];
  legacyUnrestricted: boolean;
  notes: string | null;
  trialEndsAt: string | null;
};

type Props = {
  tenantSlug: string;
  tenantName: string;
  open: boolean;
  onClose: () => void;
  loadCatalog: () => Promise<{ modules: ModuleRow[]; plans: Plan[] }>;
  loadEntitlement: (slug: string) => Promise<Entitlement | null>;
  saveEntitlement: (
    slug: string,
    data: {
      planId: string | null;
      moduleOverrides: Record<string, boolean>;
      notes?: string | null;
      syncLimitsFromPlan?: boolean;
    },
  ) => Promise<{ success: boolean; error?: string }>;
};

export function TenantEntitlementsModal({
  tenantSlug,
  tenantName,
  open,
  onClose,
  loadCatalog,
  loadEntitlement,
  saveEntitlement,
}: Props) {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [planId, setPlanId] = useState<string>("");
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [entitlements, setEntitlements] = useState<string[]>([]);
  const [legacy, setLegacy] = useState(false);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const catalog = await loadCatalog();
      setModules(catalog.modules);
      setPlans(catalog.plans);
      const ent = await loadEntitlement(tenantSlug);
      if (ent) {
        setPlanId(ent.planId ?? "");
        setOverrides(ent.moduleOverrides ?? {});
        setEntitlements(ent.entitlements ?? []);
        setLegacy(ent.legacyUnrestricted);
        setNotes(ent.notes ?? "");
      }
    })();
  }, [open, tenantSlug]);

  if (!open) return null;

  async function save() {
    setBusy(true);
    setMessage(null);
    const result = await saveEntitlement(tenantSlug, {
      planId: planId || null,
      moduleOverrides: overrides,
      notes: notes || null,
      syncLimitsFromPlan: true,
    });
    setBusy(false);
    if (!result.success) {
      setMessage(result.error ?? "Save failed");
      return;
    }
    setMessage("Saved.");
    const ent = await loadEntitlement(tenantSlug);
    if (ent) {
      setEntitlements(ent.entitlements);
      setLegacy(ent.legacyUnrestricted);
    }
  }

  function toggleOverride(key: string, enabled: boolean) {
    setOverrides((prev) => ({ ...prev, [key]: enabled }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b px-4 py-3 dark:border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold">Plan & modules</h2>
            <p className="text-sm text-zinc-500">{tenantName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-4 p-4">
          {legacy && (
            <p className="rounded bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
              Legacy unrestricted: all modules enabled until a plan is assigned.
            </p>
          )}
          <label className="block text-sm">
            Plan
            <select
              className="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              <option value="">Custom / none</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.code})
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="mb-2 text-sm font-medium">Module overrides</p>
            <ul className="space-y-2">
              {modules.map((m) => {
                const effective = entitlements.includes(m.key);
                const override = overrides[m.key];
                return (
                  <li
                    key={m.key}
                    className="flex items-center justify-between gap-3 rounded border px-3 py-2 dark:border-zinc-700"
                  >
                    <div>
                      <p className="text-sm font-medium">{m.name}</p>
                      <p className="text-xs text-zinc-500">{m.key}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500">
                        {effective ? "on" : "off"}
                      </span>
                      <select
                        className="rounded border px-2 py-1 text-xs dark:bg-zinc-800"
                        value={
                          override === true
                            ? "force_on"
                            : override === false
                              ? "force_off"
                              : "default"
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === "default") {
                            setOverrides((prev) => {
                              const next = { ...prev };
                              delete next[m.key];
                              return next;
                            });
                          } else {
                            toggleOverride(m.key, v === "force_on");
                          }
                        }}
                      >
                        <option value="default">Plan default</option>
                        <option value="force_on">Force on</option>
                        <option value="force_off">Force off</option>
                      </select>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <label className="block text-sm">
            Notes
            <textarea
              className="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          {message && <p className="text-sm text-teal-700">{message}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={save}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save entitlements"}
          </button>
        </div>
      </div>
    </div>
  );
}
