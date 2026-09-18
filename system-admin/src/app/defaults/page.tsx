import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "@/lib/api";
import { DefaultsClient } from "./DefaultsClient";

type Defaults = {
  applyScope?: string;
  defaultPolicyHints?: {
    recommendMfa?: boolean;
    recommendDriverMfa?: boolean;
    recommendBiometrics?: boolean;
  };
  defaultLimits?: { maxDrivers: number | null; maxStorageMb: number | null };
  defaultPlanCode?: string | null;
};

type Plan = { code: string; name: string; isActive?: boolean };

export default async function DefaultsPage() {
  await requireAuth();
  const [data, plans] = await Promise.all([
    fetchJson<Defaults>("/platform/defaults"),
    fetchJson<Plan[]>("/platform/commercial/plans?all=1"),
  ]);

  async function saveDefaults(patch: Record<string, unknown>) {
    "use server";
    try {
      const res = await fetch(`${getApiUrl()}/platform/defaults`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify(patch),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(body.message) ? body.message.join(" ") : body.message;
        return { ok: false, error: msg ?? "Failed to save" };
      }
      revalidatePath("/defaults");
      return { ok: true, data: body as Defaults };
    } catch {
      return { ok: false, error: "Request failed" };
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
          Global & Tenant Defaults
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          New-tenant defaults only. Per-tenant overrides stay on Tenants → Edit.
        </p>
      </div>
      <DefaultsClient
        initial={data}
        plans={(plans ?? []).filter((p) => p.isActive !== false)}
        saveDefaults={saveDefaults}
      />
    </div>
  );
}
