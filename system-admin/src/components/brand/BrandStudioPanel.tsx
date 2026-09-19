"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, X, Upload, Link2, Camera } from "lucide-react";
import { BrandMockFrames } from "@/components/brand/BrandMockFrames";
import { VIT_ACCENT, VIT_PRIMARY, type BrandDraft } from "@/lib/brand-tokens";
import {
  brandApplyKit,
  brandCreatePreview,
  brandGetStudio,
  brandListKits,
  brandListPreviewTokens,
  brandListSnapshots,
  brandPublish,
  brandReset,
  brandRestoreSnapshot,
  brandSaveDraft,
  brandSaveKit,
  brandSaveSnapshot,
  brandUploadLogo,
} from "@/app/tenants/brand-actions";

type Studio = {
  entitled: boolean;
  brandMode: string;
  draft: BrandDraft & { logoUrl?: string };
  tenantName: string;
  tenantSlug: string;
};

type Kit = { id: string; name: string; isStarter: boolean };
type Snapshot = { id: string; label: string };
type PreviewToken = { id: string; token: string; revokedAt: string | null };

type Toast = { type: "success" | "error"; message: string };

function InlineToast({
  toast,
  onDismiss,
}: {
  toast: Toast | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);

  if (!toast) return null;
  const ok = toast.type === "success";
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-sm ${
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100"
          : "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100"
      }`}
      role="status"
    >
      {ok ? (
        <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <XCircle className="h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
      )}
      <p className="flex-1 text-sm font-medium">{toast.message}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="rounded p-1 hover:opacity-80"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function BrandStudioPanel({ tenantId }: { tenantId: string }) {
  const [studio, setStudio] = useState<Studio | null>(null);
  const [kits, setKits] = useState<Kit[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [tokens, setTokens] = useState<PreviewToken[]>([]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [busy, setBusy] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [primaryHex, setPrimaryHex] = useState(VIT_PRIMARY);
  const [accentHex, setAccentHex] = useState(VIT_ACCENT);
  const [sidebarStyle, setSidebarStyle] = useState<"colored" | "neutral">("colored");
  const [kitName, setKitName] = useState("");
  const [selectedKit, setSelectedKit] = useState("");
  const [adminScreen, setAdminScreen] = useState<"login" | "dashboard" | "drivers" | "reports">(
    "dashboard",
  );
  const [phoneScreen, setPhoneScreen] = useState<"home" | "income" | "history" | "drawer">("home");
  const [loadError, setLoadError] = useState<string | null>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const load = useCallback(async () => {
    setLoadError(null);
    const [s, k, snap, t] = await Promise.all([
      brandGetStudio(tenantId),
      brandListKits(),
      brandListSnapshots(tenantId),
      brandListPreviewTokens(tenantId),
    ]);
    if (!s.ok || !s.data) {
      setLoadError(s.error || "Failed to load brand studio");
      return;
    }
    const studioData = s.data as Studio;
    setStudio(studioData);
    const d = studioData.draft || {};
    setDisplayName(d.displayName || "");
    setPrimaryHex(d.primaryHex || VIT_PRIMARY);
    setAccentHex(d.accentHex || VIT_ACCENT);
    setSidebarStyle(d.sidebarStyle === "neutral" ? "neutral" : "colored");
    if (k.ok && Array.isArray(k.data)) setKits(k.data as Kit[]);
    if (snap.ok && Array.isArray(snap.data)) setSnapshots(snap.data as Snapshot[]);
    if (t.ok && Array.isArray(t.data)) setTokens(t.data as PreviewToken[]);
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const draftView: BrandDraft = {
    displayName: displayName || null,
    primaryHex,
    accentHex,
    sidebarStyle,
    logoUrl: studio?.draft?.logoUrl,
  };

  async function run(
    fn: () => Promise<{ ok: boolean; error: string | null; data?: unknown }>,
    successMessage: string,
  ) {
    setBusy(true);
    setToast(null);
    try {
      const res = await fn();
      if (!res.ok) {
        setToast({ type: "error", message: res.error || "Request failed" });
        return res;
      }
      await load();
      setToast({ type: "success", message: successMessage });
      return res;
    } catch (e) {
      setToast({
        type: "error",
        message: e instanceof Error ? e.message : "Something went wrong",
      });
      return { ok: false as const, error: "failed", data: null };
    } finally {
      setBusy(false);
    }
  }

  if (!studio) {
    return (
      <div className="space-y-3">
        {loadError ? (
          <InlineToast toast={{ type: "error", message: loadError }} onDismiss={() => setLoadError(null)} />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading brand studio…</p>
        )}
      </div>
    );
  }

  const activePreviews = tokens.filter((t) => !t.revokedAt).length;

  return (
    <div className="space-y-5">
      <InlineToast toast={toast} onDismiss={dismissToast} />

      {/* Status */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ${
            studio.entitled
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:ring-emerald-800"
              : "bg-amber-50 text-amber-900 ring-1 ring-amber-200 dark:bg-amber-900/30 dark:text-amber-100 dark:ring-amber-800"
          }`}
        >
          {studio.entitled ? "Module enabled" : "Module off — draft only"}
        </span>
        <span className="inline-flex items-center rounded-md bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:ring-zinc-700">
          Live: {studio.brandMode === "custom" ? "custom brand" : "VIT default"}
        </span>
      </div>

      {/* Theme settings */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-800/40">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Theme</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Display name
            </span>
            <input
              className="input w-full px-3 py-2 text-sm"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={studio.tenantName}
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Sidebar</span>
            <select
              className="input w-full px-3 py-2 text-sm"
              value={sidebarStyle}
              onChange={(e) => setSidebarStyle(e.target.value as "colored" | "neutral")}
            >
              <option value="colored">Colored</option>
              <option value="neutral">Neutral</option>
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Primary</span>
            <div className="flex gap-2">
              <input
                type="color"
                value={primaryHex}
                onChange={(e) => setPrimaryHex(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-300 bg-white dark:border-zinc-600"
                aria-label="Primary color picker"
              />
              <input
                className="input flex-1 px-3 py-2 font-mono text-sm"
                value={primaryHex}
                onChange={(e) => setPrimaryHex(e.target.value)}
              />
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Accent</span>
            <div className="flex gap-2">
              <input
                type="color"
                value={accentHex}
                onChange={(e) => setAccentHex(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-300 bg-white dark:border-zinc-600"
                aria-label="Accent color picker"
              />
              <input
                className="input flex-1 px-3 py-2 font-mono text-sm"
                value={accentHex}
                onChange={(e) => setAccentHex(e.target.value)}
              />
            </div>
          </label>
          <div className="sm:col-span-2 space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Logo (png / jpeg / webp, max 1 MB)
            </span>
            <label className="btn btn-secondary flex w-full cursor-pointer gap-2 px-4 py-2.5 sm:w-auto">
              <Upload className="h-4 w-4" />
              {studio.draft?.logoUrl ? "Replace logo" : "Upload logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (!f) return;
                  const fd = new FormData();
                  fd.append("file", f);
                  void run(() => brandUploadLogo(tenantId, fd), "Logo uploaded");
                }}
              />
            </label>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <button
            type="button"
            className="btn btn-primary px-4 py-2"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  brandSaveDraft(tenantId, {
                    displayName: displayName || null,
                    primaryHex,
                    accentHex,
                    sidebarStyle,
                  }),
                "Draft saved",
              )
            }
          >
            Save draft
          </button>
          <button
            type="button"
            className="btn btn-primary px-4 py-2"
            disabled={busy || !studio.entitled}
            title={!studio.entitled ? "Enable White-label branding on the plan first" : undefined}
            onClick={() => void run(() => brandPublish(tenantId), "Published to live apps")}
          >
            Publish to live
          </button>
          <button
            type="button"
            className="btn btn-secondary px-4 py-2"
            disabled={busy}
            onClick={() => {
              if (confirm("Reset live brand to the default VIT theme?")) {
                void run(() => brandReset(tenantId, false), "Reset to VIT default");
              }
            }}
          >
            Use VIT default
          </button>
        </div>
      </section>

      {/* Live preview */}
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Preview</h3>
        <BrandMockFrames
          draft={draftView}
          tenantName={studio.tenantName}
          adminScreen={adminScreen}
          phoneScreen={phoneScreen}
          onAdminScreen={setAdminScreen}
          onPhoneScreen={setPhoneScreen}
          watermark={
            studio.entitled
              ? undefined
              : "Enable White-label branding on Plan & modules to publish"
          }
        />
      </section>

      {/* Tools */}
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Snapshots &amp; share
        </h3>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn btn-secondary px-4 py-2"
            disabled={busy}
            onClick={() =>
              void run(
                () =>
                  brandSaveSnapshot(
                    tenantId,
                    `Snapshot ${new Date().toISOString().slice(0, 16)}`,
                  ),
                "Snapshot saved",
              )
            }
          >
            <Camera className="mr-1.5 h-4 w-4" />
            Save snapshot
          </button>
          <button
            type="button"
            className="btn btn-secondary px-4 py-2"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const res = await brandCreatePreview(tenantId, "draft");
                if (res.ok && res.data && typeof res.data === "object" && "token" in res.data) {
                  const url = `${window.location.origin}/brand-preview/${(res.data as { token: string }).token}`;
                  try {
                    await navigator.clipboard.writeText(url);
                  } catch {
                    /* ignore */
                  }
                }
                return res;
              }, "Preview link copied to clipboard")
            }
          >
            <Link2 className="mr-1.5 h-4 w-4" />
            Copy preview link
          </button>
        </div>
        {activePreviews > 0 ? (
          <p className="mt-2 text-xs text-zinc-500">{activePreviews} active preview link(s)</p>
        ) : null}

        {snapshots.length > 0 ? (
          <ul className="mt-3 max-h-28 space-y-1.5 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
            {snapshots.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-1">
                <span className="truncate text-zinc-700 dark:text-zinc-300">{s.label}</span>
                <button
                  type="button"
                  className="btn btn-secondary shrink-0 px-2.5 py-1 text-xs"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Restore this snapshot into draft/live?")) {
                      void run(
                        () => brandRestoreSnapshot(tenantId, s.id),
                        "Snapshot restored",
                      );
                    }
                  }}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      {/* Kits */}
      <section className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Brand kits</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Apply existing kit
            </span>
            <div className="flex flex-wrap gap-2">
              <select
                className="input min-w-0 flex-1 px-3 py-2 text-sm"
                value={selectedKit}
                onChange={(e) => setSelectedKit(e.target.value)}
              >
                <option value="">Select kit…</option>
                {kits.map((k) => (
                  <option key={k.id} value={k.id}>
                    {k.name}
                    {k.isStarter ? " (starter)" : ""}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn btn-secondary px-4 py-2"
                disabled={!selectedKit || busy}
                onClick={() =>
                  void run(
                    () =>
                      brandApplyKit(tenantId, selectedKit, {
                        includeLogo: false,
                        setDisplayName: false,
                        publish: false,
                      }),
                    "Kit applied to draft",
                  )
                }
              >
                Apply
              </button>
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Save current draft as kit
            </span>
            <div className="flex flex-wrap gap-2">
              <input
                className="input min-w-0 flex-1 px-3 py-2 text-sm"
                value={kitName}
                onChange={(e) => setKitName(e.target.value)}
                placeholder="Kit name"
              />
              <button
                type="button"
                className="btn btn-secondary px-4 py-2"
                disabled={busy || !kitName.trim()}
                onClick={() =>
                  void run(async () => {
                    await brandSaveDraft(tenantId, {
                      displayName: displayName || null,
                      primaryHex,
                      accentHex,
                      sidebarStyle,
                    });
                    const res = await brandSaveKit(tenantId, {
                      name: kitName.trim(),
                      includeLogo: true,
                    });
                    if (res.ok) setKitName("");
                    return res;
                  }, "Kit saved")
                }
              >
                Save kit
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
