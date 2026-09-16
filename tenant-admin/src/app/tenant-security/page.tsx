import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { revalidatePath } from "next/cache";

type TenantPolicy = {
  tenantName: string;
  tenantSlug: string;
  requireMfa: boolean;
  requireMfaUsers: boolean;
  missingIncomeReminderEnabled?: boolean;
  missingIncomeCutoffHour?: number;
  missingIncomeTimezone?: string;
  missingIncomeEscalationEnabled?: boolean;
  missingIncomeEscalationHour?: number;
};

async function fetchPolicy() {
  const policy = await fetchJson<TenantPolicy>("/tenant/policy");
  return policy ?? null;
}

async function fetchDrivers() {
  const drivers = await fetchJson<Array<{ id: string; mfaEnabled?: boolean }>>("/tenant/users");
  return drivers ?? [];
}

export default async function TenantSecurityPage() {
  await requireAuth();
  const policy = await fetchPolicy();
  const drivers = await fetchDrivers();
  const pendingDrivers =
    policy?.requireMfaUsers === true
      ? drivers.filter(driver => !driver.mfaEnabled).length
      : 0;

  async function updateReminderSettings(formData: FormData) {
    "use server";
    const payload = {
      missingIncomeReminderEnabled: formData.get("missingIncomeReminderEnabled") === "on",
      missingIncomeCutoffHour: Number(formData.get("missingIncomeCutoffHour") ?? 21),
      missingIncomeTimezone: String(formData.get("missingIncomeTimezone") ?? "Africa/Johannesburg"),
      missingIncomeEscalationEnabled: formData.get("missingIncomeEscalationEnabled") === "on",
      missingIncomeEscalationHour: Number(formData.get("missingIncomeEscalationHour") ?? 8),
    };
    await fetch(`${getApiUrl()}/tenant/policy`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify(payload),
    });
    revalidatePath("/tenant-security");
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tenant Security</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Review tenant-level MFA policies enforced by the platform.
          </p>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        {!policy ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Unable to load tenant policy.
          </p>
        ) : (
          <div className="space-y-4 text-sm text-zinc-700 dark:text-zinc-300">
            <div>
              <p className="text-xs uppercase text-zinc-500 dark:text-zinc-400">Tenant</p>
              <p className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                {policy.tenantName} ({policy.tenantSlug})
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <p className="text-xs uppercase text-zinc-500 dark:text-zinc-400">Admin MFA</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {policy.requireMfa ? "Required" : "Optional"}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <p className="text-xs uppercase text-zinc-500 dark:text-zinc-400">Driver MFA</p>
                <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  {policy.requireMfaUsers ? "Required" : "Optional"}
                </p>
              </div>
            </div>
            {policy.requireMfaUsers ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
                {pendingDrivers} driver(s) still need MFA enabled.
              </div>
            ) : null}
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Contact a platform admin to change MFA enforcement policies.
            </p>
            <div className="rounded-lg border border-zinc-200 px-4 py-4 dark:border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Driver income reminder settings
              </h3>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                You can switch reminders off completely, or configure cutoff and escalation times.
              </p>
              <form action={updateReminderSettings} className="mt-4 grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="missingIncomeReminderEnabled"
                    defaultChecked={policy.missingIncomeReminderEnabled !== false}
                  />
                  Enable driver reminders
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="missingIncomeEscalationEnabled"
                    defaultChecked={policy.missingIncomeEscalationEnabled !== false}
                  />
                  Enable next-morning escalation
                </label>
                <label className="text-sm">
                  Cutoff hour (0-23)
                  <input
                    type="number"
                    min={0}
                    max={23}
                    name="missingIncomeCutoffHour"
                    defaultValue={policy.missingIncomeCutoffHour ?? 21}
                    className="input mt-1 w-full"
                  />
                </label>
                <label className="text-sm">
                  Escalation hour (0-23)
                  <input
                    type="number"
                    min={0}
                    max={23}
                    name="missingIncomeEscalationHour"
                    defaultValue={policy.missingIncomeEscalationHour ?? 8}
                    className="input mt-1 w-full"
                  />
                </label>
                <label className="text-sm md:col-span-2">
                  Timezone
                  <input
                    type="text"
                    name="missingIncomeTimezone"
                    defaultValue={policy.missingIncomeTimezone ?? "Africa/Johannesburg"}
                    className="input mt-1 w-full"
                  />
                </label>
                <div className="md:col-span-2">
                  <button
                    type="submit"
                    className="rounded-md bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    Save reminder settings
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

