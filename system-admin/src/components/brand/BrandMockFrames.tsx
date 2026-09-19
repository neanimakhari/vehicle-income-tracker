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
};

function ScreenTabs<T extends string>({
  options,
  value,
  onChange,
  activeStyle,
}: {
  options: readonly T[];
  value: T;
  onChange?: (s: T) => void;
  activeStyle?: React.CSSProperties;
}) {
  return (
    <div className="flex flex-wrap gap-1 p-1.5 border-b border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-950">
      {options.map((s) => {
        const active = value === s;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange?.(s)}
            className={`rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition-colors ${
              active
                ? "text-white"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
            style={active ? activeStyle : undefined}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

export function BrandMockFrames({
  draft,
  tenantName,
  adminScreen = "dashboard",
  phoneScreen = "home",
  onAdminScreen,
  onPhoneScreen,
  watermark,
}: Props) {
  const primary = draft.primaryHex || VIT_PRIMARY;
  const accent = draft.accentHex || VIT_ACCENT;
  const tokens = buildBrandTokens(primary, accent);
  const name = draft.displayName || tenantName || "Fleet";
  const sidebarColored = draft.sidebarStyle !== "neutral";

  const cssVars = {
    ["--mock-p"]: tokens.primary600,
    ["--mock-p6"]: tokens.primary700,
    ["--mock-p7"]: tokens.primary700,
    ["--mock-a"]: tokens.accent,
  } as React.CSSProperties;

  const tabActive = { background: "var(--mock-p6)" };
  const radius =
    draft.borderRadius === "sm" ? 8 : draft.borderRadius === "lg" ? 20 : 12;

  return (
    <div className="space-y-3" style={cssVars}>
      {watermark ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {watermark}
        </p>
      ) : null}
      {draft.loginBackgroundUrl ? (
        <p className="text-xs text-zinc-500">
          Login background set · Font: {draft.fontFamily || "inter"} · Radius:{" "}
          {draft.borderRadius || "md"} ({radius}px)
        </p>
      ) : (
        <p className="text-xs text-zinc-500">
          Font: {draft.fontFamily || "inter"} · Radius: {draft.borderRadius || "md"} ({radius}px)
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_220px]">
        {/* Admin */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Tenant admin
          </p>
          <div className="overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center gap-1.5 bg-zinc-200/80 px-3 py-2 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-2 truncate font-medium">{name}</span>
            </div>
            <ScreenTabs
              options={["login", "dashboard", "drivers", "reports"] as const}
              value={adminScreen}
              onChange={onAdminScreen}
              activeStyle={tabActive}
            />
            <div className="flex h-52 text-[11px]">
              {adminScreen === "login" ? (
                <div className="flex flex-1 items-center justify-center bg-zinc-50 p-4 dark:bg-zinc-950">
                  <div className="w-44 space-y-2 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
                    {draft.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.logoUrl} alt="" className="mx-auto h-9 object-contain" />
                    ) : (
                      <div
                        className="mx-auto h-9 w-9 rounded-lg"
                        style={{ background: "var(--mock-p6)" }}
                      />
                    )}
                    <p className="text-center text-xs font-semibold text-zinc-800 dark:text-zinc-100">
                      {name}
                    </p>
                    <div className="h-7 rounded-md bg-zinc-100 dark:bg-zinc-800" />
                    <div className="h-7 rounded-md bg-zinc-100 dark:bg-zinc-800" />
                    <div
                      className="flex h-8 items-center justify-center rounded-md text-xs font-semibold text-white"
                      style={{ background: "var(--mock-p6)" }}
                    >
                      Sign in
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <aside
                    className="w-[4.5rem] shrink-0 space-y-1.5 p-2 text-white"
                    style={{
                      background: sidebarColored ? "var(--mock-p7)" : "#18181b",
                    }}
                  >
                    {draft.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={draft.logoUrl}
                        alt=""
                        className="mb-2 h-7 w-full object-contain"
                      />
                    ) : (
                      <div className="mb-2 h-7 rounded-md bg-white/20" />
                    )}
                    <div className="h-4 rounded bg-white/30" />
                    <div className="h-4 rounded bg-white/10" />
                    <div className="h-4 rounded bg-white/10" />
                  </aside>
                  <div className="flex-1 space-y-2 bg-zinc-50 p-2.5 dark:bg-zinc-950">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold capitalize text-zinc-800 dark:text-zinc-100">
                        {adminScreen}
                      </span>
                      <span
                        className="rounded-md px-2 py-0.5 text-[10px] font-semibold text-white"
                        style={{ background: "var(--mock-p6)" }}
                      >
                        New
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="rounded-lg border border-zinc-200 bg-white p-1.5 dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <div
                            className="mb-1.5 h-1 w-5 rounded"
                            style={{ background: "var(--mock-p)" }}
                          />
                          <div className="h-2 w-8 rounded bg-zinc-200 dark:bg-zinc-700" />
                        </div>
                      ))}
                    </div>
                    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                      <div
                        className="flex h-6 items-center px-2 text-[10px] font-medium text-white"
                        style={{ background: "var(--mock-p7)" }}
                      >
                        Records
                      </div>
                      <div className="m-1.5 h-2.5 rounded bg-zinc-100 dark:bg-zinc-800" />
                      <div className="m-1.5 h-2.5 rounded bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Phone */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Driver app <span className="font-normal">(after login)</span>
          </p>
          <div className="mx-auto w-[200px] overflow-hidden rounded-[1.75rem] border-[5px] border-zinc-800 bg-zinc-900 shadow-md dark:border-zinc-600">
            <div className="flex h-5 items-end justify-center bg-zinc-900 pb-0.5">
              <div className="h-1 w-14 rounded-full bg-zinc-700" />
            </div>
            <div className="min-h-[260px] bg-white dark:bg-zinc-950">
              <ScreenTabs
                options={["home", "income", "history", "drawer"] as const}
                value={phoneScreen}
                onChange={onPhoneScreen}
                activeStyle={tabActive}
              />
              {phoneScreen === "drawer" ? (
                <div className="flex h-48">
                  <div
                    className="w-28 space-y-1.5 p-2.5 text-[10px] text-white"
                    style={{ background: "var(--mock-p7)" }}
                  >
                    {draft.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={draft.logoUrl} alt="" className="mb-2 h-6 object-contain" />
                    ) : null}
                    <p className="truncate font-semibold">{name}</p>
                    <div className="h-3 rounded bg-white/25" />
                    <div className="h-3 rounded bg-white/10" />
                    <div className="h-3 rounded bg-white/10" />
                  </div>
                  <div className="flex-1 bg-zinc-100 dark:bg-zinc-900" />
                </div>
              ) : (
                <div className="space-y-2.5 p-2.5">
                  <div
                    className="flex h-9 items-center rounded-lg px-2.5 text-xs font-semibold text-white"
                    style={{ background: "var(--mock-p6)" }}
                  >
                    {phoneScreen === "home"
                      ? "Home"
                      : phoneScreen === "income"
                        ? "Log income"
                        : "History"}
                  </div>
                  <div className="rounded-xl border border-zinc-200 p-2.5 dark:border-zinc-700">
                    <div
                      className="mb-2 h-2 w-16 rounded"
                      style={{ background: "var(--mock-p)" }}
                    />
                    <div className="h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                  </div>
                  <div
                    className="flex h-9 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ background: "var(--mock-p6)" }}
                  >
                    {phoneScreen === "income" ? "Submit" : "Continue"}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
