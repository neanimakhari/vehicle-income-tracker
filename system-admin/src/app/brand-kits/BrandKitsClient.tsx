"use client";

import { useMemo, useState } from "react";
import { buildBrandTokens, VIT_PRIMARY } from "@/lib/brand-tokens";
import {
  brandApplyKitBulk,
  brandExportKit,
  brandImportKit,
  brandListKits,
} from "@/app/tenants/brand-actions";

type Kit = {
  id: string;
  name: string;
  description: string | null;
  isStarter: boolean;
  payload: { primaryHex?: string; accentHex?: string; sidebarStyle?: string };
};

type TenantOpt = { id: string; name: string; slug: string };

export function BrandKitsClient({
  initialKits,
  tenants,
}: {
  initialKits: Kit[];
  tenants: TenantOpt[];
}) {
  const [kits, setKits] = useState(initialKits);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [bulkKitId, setBulkKitId] = useState("");
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [publishLive, setPublishLive] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(false);

  const tenantById = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);

  async function refresh() {
    const res = await brandListKits();
    if (res.ok && Array.isArray(res.data)) setKits(res.data as Kit[]);
  }

  async function onExport(kitId: string, name: string) {
    setBusy(true);
    setMessage(null);
    try {
      const res = await brandExportKit(kitId);
      if (!res.ok || !res.data) {
        setMessage(res.error || "Export failed");
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${name.replace(/\s+/g, "-").toLowerCase() || "kit"}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMessage("Kit exported");
    } finally {
      setBusy(false);
    }
  }

  async function onImportFile(file: File) {
    setBusy(true);
    setMessage(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text) as Record<string, unknown>;
      const res = await brandImportKit(json);
      if (!res.ok) {
        setMessage(res.error || "Import failed");
        return;
      }
      await refresh();
      setMessage("Kit imported");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Invalid JSON");
    } finally {
      setBusy(false);
    }
  }

  async function onBulkApply() {
    if (!bulkKitId || selectedTenants.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await brandApplyKitBulk(bulkKitId, {
        tenantIds: selectedTenants,
        target: publishLive ? "live" : "draft",
        includeLogo,
        setDisplayName: false,
      });
      if (!res.ok || !res.data) {
        setMessage(res.error || "Bulk apply failed");
        return;
      }
      const data = res.data as { applied: number; failed: number };
      setMessage(
        `Applied to ${data.applied} tenant(s)${data.failed ? `, ${data.failed} failed` : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function toggleTenant(id: string) {
    setSelectedTenants((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-6">
      {message ? (
        <p className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <label className="btn btn-secondary cursor-pointer px-4 py-2">
          Import kit JSON
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void onImportFile(f);
            }}
          />
        </label>
      </div>

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Multi-tenant apply
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Kit</span>
            <select
              className="input w-full px-3 py-2 text-sm"
              value={bulkKitId}
              onChange={(e) => setBulkKitId(e.target.value)}
            >
              <option value="">Select kit…</option>
              {kits.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                </option>
              ))}
            </select>
          </label>
          <div className="space-y-2 pt-6">
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={publishLive}
                onChange={(e) => setPublishLive(e.target.checked)}
              />
              Publish live (requires branding module)
            </label>
            <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
              <input
                type="checkbox"
                checked={includeLogo}
                onChange={(e) => setIncludeLogo(e.target.checked)}
              />
              Include kit logo
            </label>
          </div>
        </div>
        <div className="mt-3 max-h-40 overflow-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
          {tenants.map((t) => (
            <label
              key={t.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <input
                type="checkbox"
                checked={selectedTenants.includes(t.id)}
                onChange={() => toggleTenant(t.id)}
              />
              <span className="truncate">
                {t.name}{" "}
                <span className="font-mono text-xs text-zinc-400">({t.slug})</span>
              </span>
            </label>
          ))}
          {tenants.length === 0 ? (
            <p className="text-xs text-zinc-500">No tenants found</p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-primary mt-3 px-4 py-2"
          disabled={busy || !bulkKitId || selectedTenants.length === 0}
          onClick={() => void onBulkApply()}
        >
          Apply to {selectedTenants.length || 0} tenant
          {selectedTenants.length === 1 ? "" : "s"} as {publishLive ? "live" : "draft"}
        </button>
        {selectedTenants.length > 0 ? (
          <p className="mt-2 text-xs text-zinc-500">
            Selected:{" "}
            {selectedTenants
              .map((id) => tenantById.get(id)?.slug || id.slice(0, 8))
              .join(", ")}
          </p>
        ) : null}
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {kits.map((kit) => {
          const primary = kit.payload?.primaryHex || VIT_PRIMARY;
          const tokens = buildBrandTokens(primary, kit.payload?.accentHex);
          return (
            <div
              key={kit.id}
              className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900"
            >
              <div className="flex h-16" style={{ background: tokens.primary700 }}>
                <div className="flex-1" style={{ background: tokens.primary500 }} />
                <div className="w-1/3" style={{ background: tokens.accent }} />
              </div>
              <div className="space-y-2 p-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{kit.name}</h2>
                  {kit.isStarter ? (
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                      starter
                    </span>
                  ) : null}
                </div>
                {kit.description ? (
                  <p className="text-xs text-zinc-500">{kit.description}</p>
                ) : null}
                <p className="font-mono text-[10px] text-zinc-400">{primary}</p>
                <button
                  type="button"
                  className="btn btn-secondary px-3 py-1.5 text-xs"
                  disabled={busy}
                  onClick={() => void onExport(kit.id, kit.name)}
                >
                  Export JSON
                </button>
              </div>
            </div>
          );
        })}
        {kits.length === 0 ? (
          <p className="col-span-full text-sm text-zinc-500">
            No kits yet. Save one from a tenant Brand tab.
          </p>
        ) : null}
      </div>
    </div>
  );
}
