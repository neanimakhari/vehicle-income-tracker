import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { Users, AlertTriangle } from "lucide-react";
import { DriversTableBulk } from "@/components/drivers-table-bulk";
import { CreateDriverModal } from "@/components/create-driver-modal";

async function fetchDrivers() {
  try {
    const drivers = await fetchJson<Array<{ id: string; firstName: string; lastName: string; email: string; isActive: boolean; mfaEnabled?: boolean }>>(
      "/tenant/users",
    );
    return drivers ?? [];
  } catch (error) {
    console.error("Error fetching drivers:", error);
    return [];
  }
}

async function fetchPolicy() {
  const policy = await fetchJson<{ requireMfaUsers?: boolean }>("/tenant/policy");
  return policy ?? null;
}

export default async function DriversPage() {
  await requireAuth();
  let drivers: Array<{ id: string; firstName: string; lastName: string; email: string; isActive: boolean; mfaEnabled?: boolean }> = [];
  let policy: { requireMfaUsers?: boolean } | null = null;
  
  try {
    [drivers, policy] = await Promise.all([
      fetchDrivers(),
      fetchPolicy(),
    ]);
  } catch (error) {
    console.error("Error loading drivers page:", error);
  }
  
  const requiresMfa = policy?.requireMfaUsers === true;
  const missingMfaCount = requiresMfa
    ? drivers.filter(driver => !driver.mfaEnabled).length
    : 0;
  async function toggleDriver(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    if (!id) {
      return;
    }
    await fetch(`${getApiUrl()}/tenant/users/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ isActive: !isActive }),
    });
    revalidatePath("/drivers");
  }

  // Drivers should never be deleted, only disabled
  // Use toggleDriver function instead to disable/enable drivers

  async function resetDriverMfa(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) {
      return;
    }
    await fetch(`${getApiUrl()}/tenant/users/${id}/mfa/reset`, {
      method: "POST",
      headers: {
        ...(await getAuthHeaders()),
      },
    });
    revalidatePath("/drivers");
  }

  async function remindDriverMfa(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) {
      return;
    }
    await fetch(`${getApiUrl()}/tenant/users/${id}/mfa/remind`, {
      method: "POST",
      headers: {
        ...(await getAuthHeaders()),
      },
    });
    revalidatePath("/drivers");
  }

  async function bulkToggleDrivers(formData: FormData) {
    "use server";
    const idsRaw = String(formData.get("ids") ?? "");
    const makeActive = String(formData.get("makeActive") ?? "true") === "true";
    const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const headers = await getAuthHeaders();
    for (const id of ids) {
      await fetch(`${getApiUrl()}/tenant/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ isActive: makeActive }),
      });
    }
    revalidatePath("/drivers");
  }

  async function bulkRemindMfa(formData: FormData) {
    "use server";
    const idsRaw = String(formData.get("ids") ?? "");
    const ids = idsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const headers = await getAuthHeaders();
    for (const id of ids) {
      await fetch(`${getApiUrl()}/tenant/users/${id}/mfa/remind`, {
        method: "POST",
        headers: { ...headers },
      });
    }
    revalidatePath("/drivers");
  }

  async function createDriver(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    "use server";
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!firstName || !lastName || !email || !password) {
      return { error: "First name, last name, email and password are required." };
    }
    if (password.length < 12) {
      return { error: "Password must be at least 12 characters." };
    }
    try {
      const res = await fetch(`${getApiUrl()}/tenant/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ firstName, lastName, email, password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string | string[] };
        const msg = Array.isArray(body.message) ? body.message.join(" ") : (body.message ?? "Failed to create driver.");
        return { error: msg };
      }
      revalidatePath("/drivers");
      return { success: true };
    } catch (e) {
      console.error("Create driver error:", e);
      return { error: "Could not create driver. Try again." };
    }
  }
  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg">
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">Drivers</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Manage mobile app users and driver profiles
              </p>
            </div>
          </div>
        </div>
      </div>
      {requiresMfa ? (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span>Driver MFA is required for this tenant. <strong>{missingMfaCount}</strong> user(s) still need to enable MFA.</span>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <CreateDriverModal createDriver={createDriver} />
      </div>

      <DriversTableBulk
        drivers={drivers}
        requiresMfa={requiresMfa}
        onToggle={toggleDriver}
        onResetMfa={resetDriverMfa}
        onRemindMfa={remindDriverMfa}
        onBulkToggle={bulkToggleDrivers}
        onBulkRemindMfa={bulkRemindMfa}
      />
    </div>
  );
}

