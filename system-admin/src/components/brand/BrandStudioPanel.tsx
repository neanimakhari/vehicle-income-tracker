"use client";

import { useCallback, useEffect, useState } from "react";
import { Upload, Link2, Camera, Trash2 } from "lucide-react";
import { BrandMockFrames } from "@/components/brand/BrandMockFrames";
import {
  BrandInlineToast,
  type BrandToast,
  validateBrandImageFile,
} from "@/components/brand/BrandInlineToast";
import {
  DENSITY_OPTIONS,
  FONT_OPTIONS,
  RADIUS_OPTIONS,
  VIT_ACCENT,
  VIT_PRIMARY,
  type BrandBorderRadius,
  type BrandDensity,
  type BrandDraft,
  type BrandFontFamily,
} from "@/lib/brand-tokens";
import {
  brandApplyKit,
  brandClearLoginBg,
  brandClearLogo,
  brandCreatePreview,
  brandDeleteSnapshot,
  brandGetStudio,
  brandListKits,
  brandListPreviewTokens,
  brandListSnapshots,
  brandPublish,
  brandReplace,
  brandReset,
  brandRestoreSnapshot,
  brandRevokePreview,
  brandSaveDraft,
  brandSaveKit,
  brandSaveSnapshot,
  brandUploadLoginBg,
  brandUploadLogo,
} from "@/app/tenants/brand-actions";

/** Auth-gated draft assets must go through same-origin Next proxy (img tags cannot send Bearer). */
function studioAssetUrl(
  tenantId: string,
  kind: "logo-file" | "login-bg-file",
  apiUrl?: string | null,
): string | undefined {
  if (!apiUrl) return undefined;
  let v: string | null = null;
  try {
    v = new URL(apiUrl).searchParams.get("v");
  } catch {
    v = null;
  }
  const qs = v ? `?v=${encodeURIComponent(v)}` : `?v=${Date.now()}`;
  return `/api/tenants/${encodeURIComponent(tenantId)}/brand/${kind}${qs}`;
}

type Studio = {
  entitled: boolean;
  brandMode: string;
  draft: BrandDraft & { logoUrl?: string; loginBackgroundUrl?: string };
  tenantName: string;
  tenantSlug: string;
  primaryContrastWarning?: string | null;
};

type Kit = { id: string; name: string; isStarter: boolean };
type Snapshot = { id: string; label: string; createdAt?: string };
type PreviewToken = {
  id: string;
  token: string;
  source?: string;
  expiresAt?: string;
  revokedAt: string | null;
  createdAt?: string;
};

export function BrandStudioPanel({ tenantId }: { tenantId: string }) {
  const [studio, setStudio] = useState<Studio | null>(null);
  const [kits, setKits] = useState<Kit[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [tokens, setTokens] = useState<PreviewToken[]>([]);
  const [toast, setToast] = useState<BrandToast | null>(null);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [primaryHex, setPrimaryHex] = useState(VIT_PRIMARY);
  const [accentHex, setAccentHex] = useState(VIT_ACCENT);
  const [primaryDarkHex, setPrimaryDarkHex] = useState("");
  const [sidebarStyle, setSidebarStyle] = useState<"colored" | "neutral">("colored");
  const [fontFamily, setFontFamily] = useState<BrandFontFamily>("inter");
  const [borderRadius, setBorderRadius] = useState<BrandBorderRadius>("md");
  const [density, setDensity] = useState<BrandDensity>("comfortable");
  const [kitName, setKitName] = useState("");
  const [selectedKit, setSelectedKit] = useState("");
  const [adminScreen, setAdminScreen] = useState<"login" | "dashboard" | "drivers" | "reports">(
    "dashboard",
  );
  const [phoneScreen, setPhoneScreen] = useState<"home" | "income" | "history" | "drawer">("home");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [wipeDraftOnReset, setWipeDraftOnReset] = useState(false);
  const [showReplaceConfirm, setShowReplaceConfirm] = useState(false);

  const dismissToast = useCallback(() => setToast(null), []);

  /** Soft client-side luminance check (mirrors API soft warning threshold). */
  function isPrimaryLight(hex: string): boolean {
    if (!/^#[0-9A-Fa-f]{6}$/i.test(hex)) return false;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b) > 0.7;
  }

  const contrastWarning =
    isPrimaryLight(primaryHex)
      ? "Primary color is quite light — buttons and links may be hard to read on white backgrounds."
      : studio?.primaryContrastWarning || null;

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
    setPrimaryDarkHex(d.primaryDarkHex || "");
    setSidebarStyle(d.sidebarStyle === "neutral" ? "neutral" : "colored");
    setFontFamily((d.fontFamily as BrandFontFamily) || "inter");
    setBorderRadius((d.borderRadius as BrandBorderRadius) || "md");
    setDensity((d.density as BrandDensity) || "comfortable");
    if (k.ok && Array.isArray(k.data)) {
      setKits(k.data as Kit[]);
    } else if (!k.ok) {
      setToast({ type: "error", message: k.error || "Failed to load brand kits" });
    }
    if (snap.ok && Array.isArray(snap.data)) {
      setSnapshots(snap.data as Snapshot[]);
    } else if (!snap.ok) {
      setToast({ type: "error", message: snap.error || "Failed to load snapshots" });
    }
    if (t.ok && Array.isArray(t.data)) {
      setTokens(t.data as PreviewToken[]);
    } else if (!t.ok) {
      setToast({ type: "error", message: t.error || "Failed to load preview links" });
    }
  }, [tenantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const draftFields = () => ({
    displayName: displayName || null,
    primaryHex,
    accentHex,
    primaryDarkHex: primaryDarkHex || null,
    sidebarStyle,
    fontFamily,
    borderRadius,
    density,
  });

  const draftView: BrandDraft = {
    ...draftFields(),
    logoUrl: studioAssetUrl(tenantId, "logo-file", studio?.draft?.logoUrl),
    loginBackgroundUrl: studioAssetUrl(
      tenantId,
      "login-bg-file",
      studio?.draft?.loginBackgroundUrl,
    ),
  };

  async function run(
    fn: () => Promise<{ ok: boolean; error: string | null; data?: unknown }>,
    successMessage: string,
    label?: string,
  ) {
    setBusy(true);
    setBusyLabel(label || "Working…");
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
      setBusyLabel(null);
    }
  }

  function onPickImage(
    file: File | undefined,
    upload: (fd: FormData) => Promise<{ ok: boolean; error: string | null }>,
    success: string,
    label: string,
  ) {
    if (!file) return;
    const err = validateBrandImageFile(file);
    if (err) {
      setToast({ type: "error", message: err });
      return;
    }
    const fd = new FormData();
    fd.append("file", file);
    void run(() => upload(fd), success, label);
  }

  if (!studio) {
    return (
      <div className="space-y-3">
        {loadError ? (
          <BrandInlineToast
            toast={{ type: "error", message: loadError }}
            onDismiss={() => setLoadError(null)}
          />
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading brand studio…</p>
        )}
      </div>
    );
  }

  const activePreviews = tokens.filter((t) => !t.revokedAt).length;

  return (
    <div className="space-y-5">
      <BrandInlineToast toast={toast} onDismiss={dismissToast} />
      {busy && busyLabel ? (
        <p className="text-xs font-medium text-teal-700 dark:text-teal-300">{busyLabel}</p>
      ) : null}

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
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Dark primary (optional)
            </span>
            <div className="flex gap-2">
              <input
                type="color"
                value={primaryDarkHex || "#0f172a"}
                onChange={(e) => setPrimaryDarkHex(e.target.value)}
                className="h-10 w-12 cursor-pointer rounded-lg border border-zinc-300 bg-white dark:border-zinc-600"
                aria-label="Dark primary color picker"
              />
              <input
                className="input flex-1 px-3 py-2 font-mono text-sm"
                value={primaryDarkHex}
                placeholder="#0f172a"
                onChange={(e) => setPrimaryDarkHex(e.target.value)}
              />
            </div>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Font</span>
            <select
              className="input w-full px-3 py-2 text-sm"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value as BrandFontFamily)}
            >
              {FONT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Corner radius
            </span>
            <select
              className="input w-full px-3 py-2 text-sm"
              value={borderRadius}
              onChange={(e) => setBorderRadius(e.target.value as BrandBorderRadius)}
            >
              {RADIUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Density</span>
            <select
              className="input w-full px-3 py-2 text-sm"
              value={density}
              onChange={(e) => setDensity(e.target.value as BrandDensity)}
            >
              {DENSITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2 space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Logo (png / jpeg / webp, max 2 MB)
            </span>
            <div className="flex flex-wrap gap-2">
              <label className="btn btn-secondary flex cursor-pointer gap-2 px-4 py-2.5">
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
                    onPickImage(
                      f,
                      (fd) => brandUploadLogo(tenantId, fd),
                      "Logo uploaded",
                      "Uploading logo…",
                    );
                  }}
                />
              </label>
              {studio.draft?.logoUrl ? (
                <button
                  type="button"
                  className="btn btn-secondary flex gap-2 px-4 py-2.5"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Remove the logo from draft and live brand?")) {
                      void run(
                        () => brandClearLogo(tenantId),
                        "Logo cleared",
                        "Clearing logo…",
                      );
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear logo
                </button>
              ) : null}
            </div>
            {draftView.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draftView.logoUrl}
                alt="Logo preview"
                className="mt-2 h-12 w-auto max-w-full rounded border border-zinc-200 bg-white object-contain p-1 dark:border-zinc-600"
              />
            ) : null}
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Login background (png / jpeg / webp, max 2 MB)
            </span>
            <div className="flex flex-wrap gap-2">
              <label className="btn btn-secondary flex cursor-pointer gap-2 px-4 py-2.5">
                <Upload className="h-4 w-4" />
                {studio.draft?.loginBackgroundUrl ? "Replace login BG" : "Upload login BG"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  disabled={busy}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    onPickImage(
                      f,
                      (fd) => brandUploadLoginBg(tenantId, fd),
                      "Login background uploaded",
                      "Uploading login background…",
                    );
                  }}
                />
              </label>
              {studio.draft?.loginBackgroundUrl ? (
                <button
                  type="button"
                  className="btn btn-secondary flex gap-2 px-4 py-2.5"
                  disabled={busy}
                  onClick={() => {
                    if (confirm("Remove the login background?")) {
                      void run(
                        () => brandClearLoginBg(tenantId),
                        "Login background cleared",
                        "Clearing…",
                      );
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                  Clear login BG
                </button>
              ) : null}
            </div>
            {draftView.loginBackgroundUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={draftView.loginBackgroundUrl}
                alt="Login background preview"
                className="mt-2 h-24 w-full max-w-md rounded border border-zinc-200 bg-zinc-100 object-cover dark:border-zinc-600 dark:bg-zinc-800"
              />
            ) : null}
          </div>
        </div>

        {contrastWarning ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
            {contrastWarning}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <button
            type="button"
            className="btn btn-primary px-4 py-2"
            disabled={busy}
            onClick={() =>
              void run(
                () => brandSaveDraft(tenantId, draftFields()),
                "Draft saved",
                "Saving draft…",
              )
            }
          >
            {busy && busyLabel?.includes("Saving") ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            className="btn btn-primary px-4 py-2"
            disabled={busy || !studio.entitled}
            title={!studio.entitled ? "Enable White-label branding on the plan first" : undefined}
            onClick={() =>
              void run(() => brandPublish(tenantId), "Published to live apps", "Publishing…")
            }
          >
            {busy && busyLabel?.includes("Publish") ? "Publishing…" : "Publish to live"}
          </button>
          <button
            type="button"
            className="btn btn-secondary px-4 py-2"
            disabled={busy}
            onClick={() => setShowReplaceConfirm(true)}
          >
            Replace brand
          </button>
          <button
            type="button"
            className="btn btn-secondary px-4 py-2"
            disabled={busy}
            onClick={() => {
              const msg = wipeDraftOnReset
                ? "Reset live brand to VIT default and wipe the draft?"
                : "Reset live brand to the default VIT theme?";
              if (confirm(msg)) {
                void run(
                  () => brandReset(tenantId, wipeDraftOnReset),
                  wipeDraftOnReset ? "Reset to VIT (draft wiped)" : "Reset to VIT default",
                  "Resetting…",
                );
              }
            }}
          >
            Use VIT default
          </button>
        </div>
        <label className="mt-3 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={wipeDraftOnReset}
            onChange={(e) => setWipeDraftOnReset(e.target.checked)}
            className="rounded border-zinc-300"
          />
          Also wipe draft when resetting to VIT
        </label>
      </section>

      {showReplaceConfirm ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
          <p className="text-sm font-medium text-amber-950 dark:text-amber-100">
            Replace live brand with the current theme settings? A snapshot will be saved first.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary px-4 py-2"
              disabled={busy}
              onClick={() => {
                void run(async () => {
                  const res = await brandReplace(tenantId, draftFields());
                  if (res.ok) setShowReplaceConfirm(false);
                  return res;
                }, studio.entitled ? "Brand replaced and published" : "Brand replaced (saved as draft — module off)", "Replacing…");
              }}
            >
              Confirm replace
            </button>
            <button
              type="button"
              className="btn btn-secondary px-4 py-2"
              disabled={busy}
              onClick={() => setShowReplaceConfirm(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

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
          <ul className="mt-3 max-h-36 space-y-1.5 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
            {tokens
              .filter((t) => !t.revokedAt)
              .map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 px-1">
                  <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">
                    {t.source || "draft"}
                    {t.expiresAt
                      ? ` · expires ${new Date(t.expiresAt).toLocaleDateString()}`
                      : ""}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      className="btn btn-secondary px-2.5 py-1 text-xs"
                      disabled={busy}
                      onClick={() => {
                        const url = `${window.location.origin}/brand-preview/${t.token}`;
                        void navigator.clipboard.writeText(url).then(
                          () => setToast({ type: "success", message: "Link copied" }),
                          () => setToast({ type: "error", message: "Could not copy link" }),
                        );
                      }}
                    >
                      Copy
                    </button>
                    <button
                      type="button"
                      className="btn btn-secondary px-2.5 py-1 text-xs"
                      disabled={busy}
                      onClick={() => {
                        if (confirm("Revoke this preview link?")) {
                          void run(() => brandRevokePreview(t.id), "Preview link revoked");
                        }
                      }}
                    >
                      Revoke
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-zinc-500">No active preview links</p>
        )}

        {snapshots.length > 0 ? (
          <ul className="mt-3 max-h-36 space-y-1.5 overflow-auto rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-sm dark:border-zinc-700 dark:bg-zinc-800/50">
            {snapshots.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 px-1">
                <span className="min-w-0 truncate text-zinc-700 dark:text-zinc-300">
                  {s.label}
                  {s.createdAt ? (
                    <span className="ml-1 text-xs text-zinc-500">
                      ({new Date(s.createdAt).toLocaleString()})
                    </span>
                  ) : null}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="btn btn-secondary px-2.5 py-1 text-xs"
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
                  <button
                    type="button"
                    className="btn btn-secondary px-2.5 py-1 text-xs"
                    disabled={busy}
                    onClick={() => {
                      if (confirm("Delete this snapshot permanently?")) {
                        void run(
                          () => brandDeleteSnapshot(tenantId, s.id),
                          "Snapshot deleted",
                        );
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
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
                    await brandSaveDraft(tenantId, draftFields());
                    const res = await brandSaveKit(tenantId, {
                      name: kitName.trim(),
                      includeLogo: true,
                    });
                    if (res.ok) setKitName("");
                    return res;
                  }, "Kit saved", "Saving kit…")
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
