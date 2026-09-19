"use client";

import { useCallback, useEffect, useState } from "react";
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

type Kit = {
  id: string;
  name: string;
  isStarter: boolean;
};

type Snapshot = { id: string; label: string };
type PreviewToken = { id: string; token: string; revokedAt: string | null };

export function BrandStudioPanel({ tenantId }: { tenantId: string }) {
  const [studio, setStudio] = useState<Studio | null>(null);
  const [kits, setKits] = useState<Kit[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [tokens, setTokens] = useState<PreviewToken[]>([]);
  const [error, setError] = useState<string | null>(null);
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

  const load = useCallback(async () => {
    setError(null);
    const [s, k, snap, t] = await Promise.all([
      brandGetStudio(tenantId),
      brandListKits(),
      brandListSnapshots(tenantId),
      brandListPreviewTokens(tenantId),
    ]);
    if (!s.ok || !s.data) {
      setError(s.error || "Failed to load brand studio");
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

  async function run(fn: () => Promise<{ ok: boolean; error: string | null }>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fn();
      if (!res.ok) setError(res.error || "Request failed");
      else await load();
    } finally {
      setBusy(false);
    }
  }

  if (!studio) {
    return <p className="text-sm text-slate-500">{error || "Loading brand studio…"}</p>;
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">{error}</p>
      ) : null}

      <div className="flex flex-wrap gap-2 text-xs">
        <span
          className={`px-2 py-0.5 rounded ${
            studio.entitled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"
          }`}
        >
          {studio.entitled ? "Branding module ON" : "Branding module OFF — draft only"}
        </span>
        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700">
          Live: {studio.brandMode}
        </span>
      </div>

      <BrandMockFrames
        draft={draftView}
        tenantName={studio.tenantName}
        adminScreen={adminScreen}
        phoneScreen={phoneScreen}
        onAdminScreen={setAdminScreen}
        onPhoneScreen={setPhoneScreen}
        watermark={
          studio.entitled ? undefined : "Enable White-label branding to publish to live apps"
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <label className="block space-y-1">
          <span className="text-slate-600">Display name</span>
          <input
            className="input w-full"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={studio.tenantName}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-slate-600">Sidebar</span>
          <select
            className="input w-full"
            value={sidebarStyle}
            onChange={(e) => setSidebarStyle(e.target.value as "colored" | "neutral")}
          >
            <option value="colored">Colored</option>
            <option value="neutral">Neutral</option>
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-slate-600">Primary</span>
          <div className="flex gap-2">
            <input
              type="color"
              value={primaryHex}
              onChange={(e) => setPrimaryHex(e.target.value)}
              className="h-9 w-12"
            />
            <input
              className="input flex-1 font-mono"
              value={primaryHex}
              onChange={(e) => setPrimaryHex(e.target.value)}
            />
          </div>
        </label>
        <label className="block space-y-1">
          <span className="text-slate-600">Accent</span>
          <div className="flex gap-2">
            <input
              type="color"
              value={accentHex}
              onChange={(e) => setAccentHex(e.target.value)}
              className="h-9 w-12"
            />
            <input
              className="input flex-1 font-mono"
              value={accentHex}
              onChange={(e) => setAccentHex(e.target.value)}
            />
          </div>
        </label>
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-slate-600">Logo (png/jpeg/webp ≤1MB)</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const fd = new FormData();
              fd.append("file", f);
              void run(() => brandUploadLogo(tenantId, fd));
            }}
          />
        </label>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={busy}
          onClick={() =>
            void run(() =>
              brandSaveDraft(tenantId, {
                displayName: displayName || null,
                primaryHex,
                accentHex,
                sidebarStyle,
              }),
            )
          }
        >
          Save draft
        </button>
        <button
          type="button"
          className="btn-primary text-sm"
          disabled={busy || !studio.entitled}
          onClick={() => void run(() => brandPublish(tenantId))}
        >
          Publish to live
        </button>
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={busy}
          onClick={() => {
            if (confirm("Reset live brand to VIT default?")) {
              void run(() => brandReset(tenantId, false));
            }
          }}
        >
          Use VIT default
        </button>
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={busy}
          onClick={() =>
            void run(() =>
              brandSaveSnapshot(
                tenantId,
                `Snapshot ${new Date().toISOString().slice(0, 16)}`,
              ),
            )
          }
        >
          Save snapshot
        </button>
        <button
          type="button"
          className="btn-secondary text-sm"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const res = await brandCreatePreview(tenantId, "draft");
              if (res.ok && res.data && typeof res.data === "object" && "token" in res.data) {
                const url = `${window.location.origin}/brand-preview/${(res.data as { token: string }).token}`;
                await navigator.clipboard.writeText(url);
                alert(`Preview link copied:\n${url}`);
              }
              return res;
            })
          }
        >
          Copy preview link
        </button>
      </div>

      <div className="border-t border-slate-200 pt-3 space-y-2">
        <p className="text-sm font-medium text-slate-800">Brand kits</p>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm space-y-1">
            <span className="text-slate-600">Load kit</span>
            <select
              className="input"
              value={selectedKit}
              onChange={(e) => setSelectedKit(e.target.value)}
            >
              <option value="">Select…</option>
              {kits.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.name}
                  {k.isStarter ? " (starter)" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={!selectedKit || busy}
            onClick={() =>
              void run(() =>
                brandApplyKit(tenantId, selectedKit, {
                  includeLogo: false,
                  setDisplayName: false,
                  publish: false,
                }),
              )
            }
          >
            Apply to draft
          </button>
          <label className="text-sm space-y-1">
            <span className="text-slate-600">Save as kit</span>
            <input
              className="input"
              value={kitName}
              onChange={(e) => setKitName(e.target.value)}
              placeholder="Kit name"
            />
          </label>
          <button
            type="button"
            className="btn-secondary text-sm"
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
              })
            }
          >
            Save kit
          </button>
        </div>
      </div>

      {snapshots.length > 0 ? (
        <div className="border-t border-slate-200 pt-3">
          <p className="text-sm font-medium text-slate-800 mb-1">Snapshots</p>
          <ul className="text-xs space-y-1 max-h-28 overflow-auto">
            {snapshots.map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span className="truncate">{s.label}</span>
                <button
                  type="button"
                  className="text-teal-700 hover:underline"
                  onClick={() => {
                    if (confirm("Restore this snapshot?")) {
                      void run(() => brandRestoreSnapshot(tenantId, s.id));
                    }
                  }}
                >
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {tokens.filter((t) => !t.revokedAt).length > 0 ? (
        <div className="border-t border-slate-200 pt-3 text-xs text-slate-500">
          Active preview links: {tokens.filter((t) => !t.revokedAt).length}
        </div>
      ) : null}
    </div>
  );
}
