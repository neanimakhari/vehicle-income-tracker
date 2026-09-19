"use client";

import { buildBrandTokens, VIT_ACCENT, VIT_PRIMARY, type BrandDraft } from "@/lib/brand-tokens";

type Props = {
  draft: BrandDraft;
  tenantName: string;
  adminScreen?: "login" | "dashboard" | "drivers" | "reports";
  phoneScreen?: "home" | "income" | "history" | "drawer";
  onAdminScreen?: (s: "login" | "dashboard" | "drivers" | "reports") => void;
  onPhoneScreen?: (s: "home" | "income" | "history" | "drawer") => void;
  watermark?: string;
  dark?: boolean;
};

export function BrandMockFrames({
  draft,
  tenantName,
  adminScreen = "dashboard",
  phoneScreen = "home",
  onAdminScreen,
  onPhoneScreen,
  watermark,
  dark = false,
}: Props) {
  const primary = draft.primaryHex || VIT_PRIMARY;
  const accent = draft.accentHex || VIT_ACCENT;
  const tokens = buildBrandTokens(primary, accent);
  const name = draft.displayName || tenantName || "Fleet";
  const sidebarColored = draft.sidebarStyle !== "neutral";

  const cssVars = {
    ["--mock-p"]: tokens.primary500,
    ["--mock-p6"]: tokens.primary600,
    ["--mock-p7"]: tokens.primary700,
    ["--mock-a"]: tokens.accent,
  } as React.CSSProperties;

  return (
    <div className="space-y-3" style={cssVars}>
      {watermark ? (
        <p className="text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded px-2 py-1">
          {watermark}
        </p>
      ) : null}
      <div className={`grid grid-cols-1 xl:grid-cols-2 gap-4 ${dark ? "dark" : ""}`}>
        {/* Admin frame */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-900">
          <div className="flex items-center gap-1 px-2 py-1.5 bg-slate-200 dark:bg-slate-800 text-[10px] text-slate-600">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="ml-2 truncate">{name} · tenant-admin</span>
          </div>
          <div className="flex gap-1 p-1.5 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-[10px]">
            {(["login", "dashboard", "drivers", "reports"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onAdminScreen?.(s)}
                className={`px-2 py-0.5 rounded capitalize ${
                  adminScreen === s ? "text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
                style={adminScreen === s ? { background: "var(--mock-p6)" } : undefined}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="h-56 flex text-[10px]">
            {adminScreen === "login" ? (
              <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-4">
                <div className="w-40 rounded-lg bg-white dark:bg-slate-900 shadow p-3 space-y-2 border border-slate-200">
                  {draft.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.logoUrl} alt="" className="h-8 mx-auto object-contain" />
                  ) : (
                    <div
                      className="h-8 w-8 mx-auto rounded"
                      style={{ background: "var(--mock-p6)" }}
                    />
                  )}
                  <p className="text-center font-semibold text-slate-800 dark:text-slate-100">{name}</p>
                  <div className="h-5 rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-5 rounded bg-slate-100 dark:bg-slate-800" />
                  <div
                    className="h-6 rounded text-white flex items-center justify-center font-medium"
                    style={{ background: "var(--mock-p6)" }}
                  >
                    Sign in
                  </div>
                </div>
              </div>
            ) : (
              <>
                <aside
                  className="w-16 shrink-0 p-1.5 space-y-1 text-white"
                  style={{
                    background: sidebarColored ? "var(--mock-p7)" : "#1e293b",
                  }}
                >
                  {draft.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.logoUrl} alt="" className="h-6 w-full object-contain mb-2" />
                  ) : (
                    <div className="h-6 rounded bg-white/20 mb-2" />
                  )}
                  <div className="h-4 rounded bg-white/25" />
                  <div className="h-4 rounded bg-white/10" />
                  <div className="h-4 rounded bg-white/10" />
                </aside>
                <div className="flex-1 p-2 bg-slate-50 dark:bg-slate-950 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-800 dark:text-slate-100 capitalize">
                      {adminScreen}
                    </span>
                    <button
                      type="button"
                      className="px-2 py-0.5 rounded text-white"
                      style={{ background: "var(--mock-p6)" }}
                    >
                      New
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="h-12 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-1"
                      >
                        <div
                          className="h-1 w-6 rounded mb-1"
                          style={{ background: "var(--mock-p)" }}
                        />
                        <div className="h-2 w-10 rounded bg-slate-200 dark:bg-slate-700" />
                      </div>
                    ))}
                  </div>
                  <div className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                    <div
                      className="h-5 flex items-center px-1 text-white"
                      style={{ background: "var(--mock-p7)" }}
                    >
                      Table
                    </div>
                    <div className="h-3 m-1 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-3 m-1 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Phone frame */}
        <div className="flex justify-center">
          <div className="w-[200px] rounded-[1.5rem] border-4 border-slate-800 dark:border-slate-600 bg-slate-900 overflow-hidden shadow-lg">
            <div className="h-4 bg-slate-900 flex justify-center items-end pb-0.5">
              <div className="w-12 h-1 rounded-full bg-slate-700" />
            </div>
            <div className="bg-white dark:bg-slate-950 min-h-[280px]">
              <div className="flex gap-0.5 p-1 border-b text-[9px] overflow-x-auto">
                {(["home", "income", "history", "drawer"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onPhoneScreen?.(s)}
                    className={`px-1.5 py-0.5 rounded capitalize shrink-0 ${
                      phoneScreen === s ? "text-white" : "text-slate-500"
                    }`}
                    style={phoneScreen === s ? { background: "var(--mock-p6)" } : undefined}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-[8px] text-center text-slate-400 py-0.5">
                Splash &amp; login stay VIT
              </p>
              {phoneScreen === "drawer" ? (
                <div className="flex h-52">
                  <div
                    className="w-28 p-2 text-white space-y-1 text-[9px]"
                    style={{ background: "var(--mock-p7)" }}
                  >
                    {draft.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.logoUrl} alt="" className="h-6 object-contain mb-2" />
                    ) : null}
                    <p className="font-semibold truncate">{name}</p>
                    <div className="h-3 rounded bg-white/20" />
                    <div className="h-3 rounded bg-white/10" />
                    <div className="h-3 rounded bg-white/10" />
                  </div>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-900" />
                </div>
              ) : (
                <div className="p-2 space-y-2">
                  <div
                    className="h-8 rounded flex items-center px-2 text-white text-[10px] font-medium"
                    style={{ background: "var(--mock-p6)" }}
                  >
                    {phoneScreen === "home"
                      ? "Home"
                      : phoneScreen === "income"
                        ? "Log income"
                        : "History"}
                  </div>
                  <div className="h-16 rounded-lg border border-slate-200 p-2">
                    <div
                      className="h-2 w-16 rounded mb-2"
                      style={{ background: "var(--mock-p)" }}
                    />
                    <div className="h-8 rounded bg-slate-100" />
                  </div>
                  <button
                    type="button"
                    className="w-full h-8 rounded-full text-white text-[10px] font-semibold"
                    style={{ background: "var(--mock-p6)" }}
                  >
                    {phoneScreen === "income" ? "Submit" : "Action"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
