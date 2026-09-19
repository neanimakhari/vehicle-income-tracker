"use client";

import { buildBrandTokens, VIT_PRIMARY } from "@/lib/brand-tokens";

type Kit = {
  id: string;
  name: string;
  description: string | null;
  isStarter: boolean;
  payload: { primaryHex?: string; accentHex?: string; sidebarStyle?: string };
};

export function BrandKitsClient({ initialKits }: { initialKits: Kit[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {initialKits.map((kit) => {
        const primary = kit.payload?.primaryHex || VIT_PRIMARY;
        const tokens = buildBrandTokens(primary, kit.payload?.accentHex);
        return (
          <div
            key={kit.id}
            className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden bg-white dark:bg-zinc-900"
          >
            <div className="h-16 flex" style={{ background: tokens.primary700 }}>
              <div className="flex-1" style={{ background: tokens.primary500 }} />
              <div className="w-1/3" style={{ background: tokens.accent }} />
            </div>
            <div className="p-3 space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="font-medium text-zinc-900 dark:text-zinc-50">{kit.name}</h2>
                {kit.isStarter ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    starter
                  </span>
                ) : null}
              </div>
              {kit.description ? (
                <p className="text-xs text-zinc-500">{kit.description}</p>
              ) : null}
              <p className="text-[10px] font-mono text-zinc-400">{primary}</p>
            </div>
          </div>
        );
      })}
      {initialKits.length === 0 ? (
        <p className="text-sm text-zinc-500 col-span-full">No kits yet. Save one from a tenant Brand tab.</p>
      ) : null}
    </div>
  );
}
