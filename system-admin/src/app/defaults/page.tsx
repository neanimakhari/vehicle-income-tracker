import { requireAuth } from "@/lib/auth";
import { fetchJson } from "@/lib/api";
import { Shield, Settings, ArrowRight } from "lucide-react";
import Link from "next/link";

type Defaults = {
  defaultPolicyHints?: { recommendMfa?: boolean; recommendDriverMfa?: boolean; recommendBiometrics?: boolean };
  defaultLimits?: { maxDrivers: number | null; maxStorageMb: number | null };
};

async function fetchDefaults(): Promise<Defaults | null> {
  return fetchJson<Defaults>("/platform/defaults");
}

export default async function DefaultsPage() {
  await requireAuth();
  const data = await fetchDefaults();
  const hints = data?.defaultPolicyHints ?? {};
  const limits = data?.defaultLimits ?? { maxDrivers: null, maxStorageMb: null };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
          Global & Tenant Defaults
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Default policy hints and optional per-tenant feature limits. Apply per tenant in Tenants → Edit.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
              <Shield className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Default policy hints</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Recommended settings for new tenants</p>
            </div>
          </div>
          <ul className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <li className="flex items-center gap-2">
              {hints.recommendMfa !== false ? (
                <span className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Recommended</span>
              ) : (
                <span className="inline-flex rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-700">Off</span>
              )}
              Admin MFA
            </li>
            <li className="flex items-center gap-2">
              {hints.recommendDriverMfa !== false ? (
                <span className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Recommended</span>
              ) : (
                <span className="inline-flex rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-700">Off</span>
              )}
              Driver MFA
            </li>
            <li className="flex items-center gap-2">
              {hints.recommendBiometrics ? (
                <span className="inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">Recommended</span>
              ) : (
                <span className="inline-flex rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-700">Optional</span>
              )}
              Biometrics
            </li>
          </ul>
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Configure via platform env (e.g. PLATFORM_DEFAULTS_RECOMMEND_MFA). Per-tenant limits can be set when editing a tenant.
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <Settings className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Default limits</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Optional per-tenant caps</p>
            </div>
          </div>
          <div className="space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            <p>Max drivers per tenant: {limits.maxDrivers ?? "—"}</p>
            <p>Max storage (MB) per tenant: {limits.maxStorageMb ?? "—"}</p>
          </div>
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Set per tenant in Tenants → Edit. Platform defaults shown here when configured via env.
          </p>
        </div>
      </div>

      <div className="card p-6">
        <Link
          href="/tenants"
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Manage Tenants
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
