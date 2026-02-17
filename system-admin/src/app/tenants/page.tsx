import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { TenantsClient } from "./TenantsClient";

async function fetchTenants() {
  const tenants = await fetchJson<
    Array<{
      id: string;
      name: string;
      slug: string;
      isActive: boolean;
      requireMfa?: boolean;
      requireMfaUsers?: boolean;
      maxDrivers?: number | null;
      maxStorageMb?: number | null;
      contactName?: string | null;
      contactEmail?: string | null;
      contactPhone?: string | null;
      address?: string | null;
      registrationNumber?: string | null;
      taxId?: string | null;
      website?: string | null;
      notes?: string | null;
    }>
  >("/tenants");
  return tenants ?? [];
}

async function fetchTenantAdmins() {
  const admins = await fetchJson<Array<{ id: string; email: string; tenantId: string }>>(
    "/tenant/admins",
  );
  return admins ?? [];
}

async function fetchTenantUsage() {
  const usage = await fetchJson<
    Array<{
      id: string;
      name: string;
      slug: string;
      drivers: number;
      incomes: number;
      vehicles: number;
      totalIncome: number;
    }>
  >("/tenants/usage");
  return usage ?? [];
}

export default async function TenantsPage() {
  await requireAuth();
  const [tenants, admins, usage] = await Promise.all([
    fetchTenants(),
    fetchTenantAdmins(),
    fetchTenantUsage(),
  ]);

  async function createTenant(formData: FormData): Promise<{ success: boolean; error?: string }> {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    if (!name || !slug) {
      return { success: false, error: "Name and slug are required" };
    }
    try {
      const res = await fetch(`${getApiUrl()}/tenants`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          name,
          slug,
          contactName: (formData.get("contactName") as string) || undefined,
          contactEmail: (formData.get("contactEmail") as string) || undefined,
          contactPhone: (formData.get("contactPhone") as string) || undefined,
          address: (formData.get("address") as string) || undefined,
          registrationNumber: (formData.get("registrationNumber") as string) || undefined,
          website: (formData.get("website") as string) || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: (err as { message?: string }).message ?? "Failed to create tenant" };
      }
      revalidatePath("/tenants");
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Request failed" };
    }
  }

  async function toggleTenant(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    if (!id) return;
    await fetch(`${getApiUrl()}/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ isActive: !isActive }),
    });
    revalidatePath("/tenants");
  }

  async function toggleMfa(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const requireMfa = String(formData.get("requireMfa") ?? "false") === "true";
    if (!id) return;
    await fetch(`${getApiUrl()}/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ requireMfa: !requireMfa }),
    });
    revalidatePath("/tenants");
  }

  async function toggleUserMfa(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const requireMfaUsers = String(formData.get("requireMfaUsers") ?? "false") === "true";
    if (!id) return;
    await fetch(`${getApiUrl()}/tenants/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ requireMfaUsers: !requireMfaUsers }),
    });
    revalidatePath("/tenants");
  }

  async function updateTenant(formData: FormData): Promise<{ success: boolean; error?: string }> {
    "use server";
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { success: false, error: "Tenant ID required" };
    try {
      const maxDriversRaw = formData.get("maxDrivers") as string | null;
      const maxStorageMbRaw = formData.get("maxStorageMb") as string | null;
      const body: Record<string, unknown> = {
        contactName: (formData.get("contactName") as string) || null,
        contactEmail: (formData.get("contactEmail") as string) || null,
        contactPhone: (formData.get("contactPhone") as string) || null,
        address: (formData.get("address") as string) || null,
        registrationNumber: (formData.get("registrationNumber") as string) || null,
        taxId: (formData.get("taxId") as string) || null,
        website: (formData.get("website") as string) || null,
        notes: (formData.get("notes") as string) || null,
        isActive: formData.get("isActive") === "true",
        requireMfa: formData.get("requireMfa") === "true",
        requireMfaUsers: formData.get("requireMfaUsers") === "true",
        maxDrivers: maxDriversRaw === "" || maxDriversRaw === null ? null : Math.max(1, parseInt(maxDriversRaw, 10) || 0) || null,
        maxStorageMb: maxStorageMbRaw === "" || maxStorageMbRaw === null ? null : Math.max(1, parseInt(maxStorageMbRaw, 10) || 0) || null,
      };
      const res = await fetch(`${getApiUrl()}/tenants/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: (err as { message?: string }).message ?? "Failed to update tenant" };
      }
      revalidatePath("/tenants");
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Request failed" };
    }
  }

  return (
    <TenantsClient
      tenants={tenants}
      admins={admins}
      usage={usage}
      createTenant={createTenant}
      updateTenant={updateTenant}
      toggleTenant={toggleTenant}
      toggleMfa={toggleMfa}
      toggleUserMfa={toggleUserMfa}
    />
  );
}
