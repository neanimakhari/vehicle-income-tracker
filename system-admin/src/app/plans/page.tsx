import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "@/lib/api";
import { PlansClient } from "./PlansClient";

type Module = { key: string; name?: string; label?: string };
type Plan = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  maxDriversDefault?: number | null;
  maxStorageMbDefault?: number | null;
  isActive: boolean;
  moduleKeys: string[];
  tenantCount?: number;
};

export default async function PlansPage() {
  await requirePlatformAdmin();
  const [plans, modules] = await Promise.all([
    fetchJson<Plan[]>("/platform/commercial/plans?all=1"),
    fetchJson<Module[]>("/platform/commercial/modules"),
  ]);

  async function savePlanModules(planId: string, moduleKeys: string[]) {
    "use server";
    const res = await fetch(`${getApiUrl()}/platform/commercial/plans/${planId}/modules`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ moduleKeys }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false as const, error: body.message ?? "Failed to update modules" };
    }
    revalidatePath("/plans");
    return { ok: true as const, plan: body as Plan };
  }

  async function createPlan(payload: {
    code: string;
    name: string;
    description?: string;
    moduleKeys: string[];
  }) {
    "use server";
    const res = await fetch(`${getApiUrl()}/platform/commercial/plans`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = Array.isArray(body.message) ? body.message.join(" ") : body.message;
      return { ok: false as const, error: msg ?? "Failed to create plan" };
    }
    revalidatePath("/plans");
    return { ok: true as const };
  }

  async function updatePlan(
    planId: string,
    payload: { name?: string; isActive?: boolean; description?: string | null },
  ) {
    "use server";
    const res = await fetch(`${getApiUrl()}/platform/commercial/plans/${planId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false as const, error: body.message ?? "Failed to update plan" };
    }
    revalidatePath("/plans");
    return { ok: true as const };
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
          Plans & modules
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Catalog of commercial plans. Module changes apply to all tenants on that plan.
        </p>
      </div>
      <PlansClient
        initialPlans={plans ?? []}
        modules={modules ?? []}
        savePlanModules={savePlanModules}
        createPlan={createPlan}
        updatePlan={updatePlan}
      />
    </div>
  );
}
