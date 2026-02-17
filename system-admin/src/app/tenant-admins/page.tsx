import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { TenantAdminsClient } from "./TenantAdminsClient";

async function fetchTenants() {
  const tenants = await fetchJson<Array<{ id: string; name: string; slug: string }>>("/tenants");
  return tenants ?? [];
}

type TenantAdminRow = {
  id: string;
  email: string;
  tenantId: string;
  tenantName?: string;
  isActive: boolean;
  createdAt: string;
};

async function fetchTenantAdmins() {
  const admins = await fetchJson<TenantAdminRow[]>("/tenant/admins");
  return admins ?? [];
}

/** Build fallback tenant options from admins' tenantIds when GET /tenants returns empty (e.g. API/DB issue). */
function ensureTenantOptions(
  tenants: Array<{ id: string; name: string; slug: string }>,
  admins: Array<{ tenantId: string }>,
): Array<{ id: string; name: string; slug: string }> {
  if (tenants.length > 0) return tenants;
  const slugs = [...new Set(admins.map((a) => a.tenantId).filter(Boolean))];
  return slugs.map((slug) => ({ id: slug, name: slug, slug }));
}

export default async function TenantAdminsPage() {
  await requireAuth();
  const [tenantsRaw, admins] = await Promise.all([fetchTenants(), fetchTenantAdmins()]);
  const tenants = ensureTenantOptions(tenantsRaw, admins);

  async function createTenantAdmin(
    formData: FormData,
  ): Promise<{ success: boolean; error?: string }> {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
    if (!email || !password || !tenantSlug) {
      return { success: false, error: "Email, password and tenant are required" };
    }
    if (password.length < 12) {
      return { success: false, error: "Password must be at least 12 characters" };
    }
    try {
      const res = await fetch(`${getApiUrl()}/tenant/admins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ email, password, tenantSlug }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: (err as { message?: string }).message ?? "Failed to create admin" };
      }
      revalidatePath("/tenant-admins");
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Request failed" };
    }
  }

  async function updateTenantAdmin(
    id: string,
    data: { email?: string; tenantSlug?: string; isActive?: boolean },
  ): Promise<{ success: boolean; error?: string }> {
    "use server";
    try {
      const res = await fetch(`${getApiUrl()}/tenant/admins/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: (err as { message?: string }).message ?? "Failed to update" };
      }
      revalidatePath("/tenant-admins");
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Request failed" };
    }
  }

  return (
    <TenantAdminsClient
      tenants={tenants}
      admins={admins}
      createTenantAdmin={createTenantAdmin}
      updateTenantAdmin={updateTenantAdmin}
      tenantsLoadFailed={tenantsRaw.length === 0 && admins.length > 0}
    />
  );
}
