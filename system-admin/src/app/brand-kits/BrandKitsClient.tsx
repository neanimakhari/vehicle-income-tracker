"use client";

import { useCallback, useMemo, useState } from "react";
import { BrandInlineToast, type BrandToast } from "@/components/brand/BrandInlineToast";
import { buildBrandTokens, VIT_PRIMARY } from "@/lib/brand-tokens";
import {
  brandApplyKitBulk,
  brandCloneKit,
  brandCreateKit,
  brandDeleteKit,
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
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [toast, setToast] = useState<BrandToast | null>(null);
  const [bulkKitId, setBulkKitId] = useState("");
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [publishLive, setPublishLive] = useState(false);
  const [includeLogo, setIncludeLogo] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrimary, setNewPrimary] = useState(VIT_PRIMARY);

  const tenantById = useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);
  const dismissToast = useCallback(() => setToast(null), []);

  async function refresh() {
    const res = await brandListKits();
    if (res.ok && Array.isArray(res.data)) setKits(res.data as Kit[]);
    else if (!res.ok) setToast({ type: "error", message: res.error || "Failed to refresh kits" });
  }

  async function withBusy(
    label: string,
    fn: () => Promise<void>,
  ) {
    setBusy(true);
    setBusyLabel(label);
    setToast(null);
    try {
      await fn();
    } catch (e) {
      setToast({
        type: "error",
        message: e instanceof Error ? e.message : "Something went wrong",
      });
    } finally {
      setBusy(false);
      setBusyLabel(null);
    }
  }

  async function onExport(kitId: string, name: string) {
    await withBusy("Exporting…", async () => {
      const res = await brandExportKit(kitId);
      if (!res.ok || !res.data) {
        setToast({ type: "error", message: res.error || "Export failed" });
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
      setToast({ type: "success", message: "Kit exported" });
    });
  }

  async function onImportFile(file: File) {
    await withBusy("Importing…", async () => {
      try {
        const text = await file.text();
        const json = JSON.parse(text) as Record<string, unknown>;
        const res = await brandImportKit(json);
        if (!res.ok) {
          setToast({ type: "error", message: res.error || "Import failed" });
          return;
        }
        await refresh();
        setToast({ type: "success", message: "Kit imported" });
      } catch (e) {
        setToast({
          type: "error",
          message: e instanceof Error ? e.message : "Invalid JSON",
        });
      }
    });
  }

  async function onBulkApply() {
    if (!bulkKitId || selectedTenants.length === 0) {
      setToast({ type: "error", message: "Select a kit and at least one tenant" });
      return;
    }
    await withBusy("Applying kit…", async () => {
      const res = await brandApplyKitBulk(bulkKitId, {
        tenantIds: selectedTenants,
        target: publishLive ? "live" : "draft",
        includeLogo,
        setDisplayName: false,
      });
      if (!res.ok || !res.data) {
        setToast({ type: "error", message: res.error || "Bulk apply failed" });
        return;
      }
      const data = res.data as { applied: number; failed: number };
      if (data.failed > 0) {
        setToast({
          type: "error",
          message: `Applied to ${data.applied}; ${data.failed} failed`,
        });
      } else {
        setToast({
          type: "success",
          message: `Applied to ${data.applied} tenant(s)`,
        });
      }
    });
  }

  async function onCreate() {
    if (!newName.trim()) {
      setToast({ type: "error", message: "Kit name is required" });
      return;
    }
    await withBusy("Creating kit…", async () => {
      const res = await brandCreateKit({
        name: newName.trim(),
        primaryHex: newPrimary,
      });
      if (!res.ok) {
        setToast({ type: "error", message: res.error || "Create failed" });
        return;
      }
      setNewName("");
      await refresh();
      setToast({ type: "success", message: "Kit created" });
    });
  }

  async function onClone(id: string) {
    await withBusy("Cloning…", async () => {
      const res = await brandCloneKit(id);
      if (!res.ok) {
        setToast({ type: "error", message: res.error || "Clone failed" });
        return;
      }
      await refresh();
      setToast({ type: "success", message: "Kit cloned" });
    });
  }

  async function onDelete(id: string, name: string) {
    if (!confirm(`Delete kit “${name}”?`)) return;
    await withBusy("Deleting…", async () => {
      const res = await brandDeleteKit(id);
      if (!res.ok) {
        setToast({ type: "error", message: res.error || "Delete failed" });
        return;
      }
      await refresh();
      setToast({ type: "success", message: "Kit deleted" });
    });
  }

  function toggleTenant(id: string) {
    setSelectedTenants((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  return (
    <div className="space-y-6">
      <BrandInlineToast toast={toast} onDismiss={dismissToast} />
      {busy && busyLabel ? (
        <p className="text-xs font-medium text-teal-700 dark:text-teal-300">{busyLabel}</p>
      ) : null}

      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Create kit
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Name</span>
            <input
              className="input px-3 py-2 text-sm"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Fleet Blue"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500">Primary</span>
            <input
              type="color"
              className="h-10 w-12 cursor-pointer rounded border"
              value={newPrimary}
              onChange={(e) => setNewPrimary(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary px-4 py-2"
            disabled={busy}
            onClick={() => void onCreate()}
          >
            Create
          </button>
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
      </section>

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
        <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
          {tenants.map((t) => (
            <label
              key={t.id}
              className="flex items-center gap-2 px-2 py-1 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <input
                type="checkbox"
                checked={selectedTenants.includes(t.id)}
                onChange={() => toggleTenant(t.id)}
              />
              {t.name}{" "}
              <span className="text-xs text-zinc-400">({t.slug})</span>
            </label>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-primary mt-3 px-4 py-2"
          disabled={busy}
          onClick={() => void onBulkApply()}
        >
          {busy && busyLabel?.includes("Applying") ? "Applying…" : "Apply to selected"}
        </button>
        {selectedTenants.length > 0 ? (
          <p className="mt-2 text-xs text-zinc-500">
            Selected:{" "}
            {selectedTenants
              .map((id) => tenantById.get(id)?.slug)
              .filter(Boolean)
              .join(", ")}
          </p>
        ) : null}
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {kits.map((k) => {
          const primary = k.payload?.primaryHex || VIT_PRIMARY;
          const tokens = buildBrandTokens(primary, k.payload?.accentHex);
          return (
            <div
              key={k.id}
              className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
            >
              <div
                className="mb-3 h-10 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${tokens.primary600}, ${tokens.accent})`,
                }}
              />
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-50">{k.name}</h3>
              <p className="text-xs text-zinc-500">
                {k.isStarter ? "Starter · " : ""}
                {k.payload?.sidebarStyle || "colored"}
              </p>
              {k.description ? (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{k.description}</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-secondary px-3 py-1.5 text-xs"
                  disabled={busy}
                  onClick={() => void onExport(k.id, k.name)}
                >
                  Export
                </button>
                <button
                  type="button"
                  className="btn btn-secondary px-3 py-1.5 text-xs"
                  disabled={busy}
                  onClick={() => void onClone(k.id)}
                >
                  Clone
                </button>
                {!k.isStarter ? (
                  <button
                    type="button"
                    className="btn btn-secondary px-3 py-1.5 text-xs text-red-700"
                    disabled={busy}
                    onClick={() => void onDelete(k.id, k.name)}
                  >
                    Delete
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
