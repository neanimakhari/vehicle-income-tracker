import { revalidatePath } from "next/cache";
import { requireAuth, getAuthRole } from "@/lib/auth";
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
      allowSysEnter?: boolean;
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
  const role = await getAuthRole();
  const isSys = role === "SYS";
  const [tenants, admins, usage, entitlementSummaries, plans, defaults] = await Promise.all([
    fetchTenants(),
    fetchTenantAdmins(),
    fetchTenantUsage(),
    fetchJson<
      Array<{
        tenantId: string;
        planId: string | null;
        planCode: string | null;
        planName: string | null;
        moduleCount: number;
        legacyUnrestricted: boolean;
      }>
    >("/platform/commercial/tenants/entitlements-summary"),
    fetchJson<Array<{ code: string; name: string; isActive?: boolean }>>(
      "/platform/commercial/plans?all=1",
    ),
    fetchJson<{ defaultPlanCode?: string | null }>("/platform/defaults"),
  ]);

  async function createTenant(
    formData: FormData,
  ): Promise<{ success: boolean; error?: string; slug?: string }> {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const slug = String(formData.get("slug") ?? "").trim();
    if (!name || !slug) {
      return { success: false, error: "Name and slug are required" };
    }
    try {
      const res = await fetch(`${getApiUrl()}/platform/tenants/from-template`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          name,
          slug,
          planCode: (formData.get("planCode") as string) || undefined,
          contactName: (formData.get("contactName") as string) || undefined,
          contactEmail: (formData.get("contactEmail") as string) || undefined,
          contactPhone: (formData.get("contactPhone") as string) || undefined,
          adminEmail: (formData.get("adminEmail") as string) || undefined,
          adminPassword: (formData.get("adminPassword") as string) || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return { success: false, error: (err as { message?: string }).message ?? "Failed to create tenant" };
      }
      revalidatePath("/tenants");
      return { success: true, slug };
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
        allowSysEnter: formData.get("allowSysEnter") === "true",
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

  async function listReportRecipients(slug: string) {
    "use server";
    const rows = await fetchJson<
      Array<{ id: string; email: string; label: string | null; isActive: boolean }>
    >(`/tenants/${encodeURIComponent(slug)}/report-recipients`);
    return rows ?? [];
  }

  async function addReportRecipient(
    slug: string,
    data: { email: string; label?: string },
  ): Promise<{ success: boolean; error?: string }> {
    "use server";
    try {
      const res = await fetch(
        `${getApiUrl()}/tenants/${encodeURIComponent(slug)}/report-recipients`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg =
          (err as { message?: string | string[] }).message ?? "Failed to add recipient";
        return {
          success: false,
          error: Array.isArray(msg) ? msg.join(", ") : String(msg),
        };
      }
      return { success: true };
    } catch {
      return { success: false, error: "Request failed" };
    }
  }

  async function updateReportRecipient(
    slug: string,
    id: string,
    data: { isActive?: boolean },
  ): Promise<{ success: boolean; error?: string }> {
    "use server";
    try {
      const res = await fetch(
        `${getApiUrl()}/tenants/${encodeURIComponent(slug)}/report-recipients/${id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) {
        return { success: false, error: "Failed to update recipient" };
      }
      return { success: true };
    } catch {
      return { success: false, error: "Request failed" };
    }
  }

  async function deleteReportRecipient(
    slug: string,
    id: string,
  ): Promise<{ success: boolean; error?: string }> {
    "use server";
    try {
      const res = await fetch(
        `${getApiUrl()}/tenants/${encodeURIComponent(slug)}/report-recipients/${id}`,
        {
          method: "DELETE",
          headers: { ...(await getAuthHeaders()) },
        },
      );
      if (!res.ok) {
        return { success: false, error: "Failed to delete recipient" };
      }
      return { success: true };
    } catch {
      return { success: false, error: "Request failed" };
    }
  }

  async function enterTenant(
    slug: string,
  ): Promise<{ success: boolean; error?: string; url?: string }> {
    "use server";
    try {
      const res = await fetch(`${getApiUrl()}/auth/impersonate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ tenantSlug: slug }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
          success: false,
          error:
            (err as { message?: string }).message ?? "Failed to enter tenant",
        };
      }
      const data = (await res.json()) as {
        accessToken: string;
        tenant: { slug: string; name: string };
      };
      const tenantAdminBase =
        process.env.NEXT_PUBLIC_TENANT_ADMIN_URL ??
        (process.env.NODE_ENV === "production"
          ? "https://vit-admin.vehinc.co.za"
          : "http://localhost:3022");
      const url = `${tenantAdminBase.replace(/\/$/, "")}/sys-enter?token=${encodeURIComponent(data.accessToken)}&tenant=${encodeURIComponent(data.tenant.slug)}&name=${encodeURIComponent(data.tenant.name)}`;
      return { success: true, url };
    } catch {
      return { success: false, error: "Request failed" };
    }
  }

  async function loadCommercialCatalog() {
    "use server";
    const [modules, plans] = await Promise.all([
      fetchJson<Array<{ key: string; name: string; description: string | null }>>(
        "/platform/commercial/modules",
      ),
      fetchJson<
        Array<{
          id: string;
          code: string;
          name: string;
          moduleKeys: string[];
          maxDriversDefault: number | null;
        }>
      >("/platform/commercial/plans"),
    ]);
    return { modules: modules ?? [], plans: plans ?? [] };
  }

  async function loadTenantEntitlement(slug: string) {
    "use server";
    return fetchJson<{
      tenantId: string;
      planId: string | null;
      moduleOverrides: Record<string, boolean>;
      entitlements: string[];
      legacyUnrestricted: boolean;
      notes: string | null;
      trialEndsAt: string | null;
    }>(`/platform/commercial/tenants/${encodeURIComponent(slug)}/entitlements`);
  }

  async function saveTenantEntitlement(
    slug: string,
    data: {
      planId: string | null;
      moduleOverrides: Record<string, boolean>;
      notes?: string | null;
      syncLimitsFromPlan?: boolean;
    },
  ): Promise<{ success: boolean; error?: string }> {
    "use server";
    try {
      const res = await fetch(
        `${getApiUrl()}/platform/commercial/tenants/${encodeURIComponent(slug)}/entitlements`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...(await getAuthHeaders()),
          },
          body: JSON.stringify(data),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
          success: false,
          error: (err as { message?: string }).message ?? "Failed to save",
        };
      }
      revalidatePath("/tenants");
      return { success: true };
    } catch {
      return { success: false, error: "Request failed" };
    }
  }

  return (
    <TenantsClient
      tenants={tenants}
      admins={admins}
      usage={usage}
      entitlementSummaries={entitlementSummaries ?? []}
      plans={(plans ?? []).map((p) => ({
        code: p.code,
        name: p.name,
        isActive: p.isActive,
      }))}
      defaultPlanCode={defaults?.defaultPlanCode ?? null}
      createTenant={createTenant}
      updateTenant={updateTenant}
      toggleTenant={toggleTenant}
      toggleMfa={toggleMfa}
      toggleUserMfa={toggleUserMfa}
      listReportRecipients={listReportRecipients}
      addReportRecipient={addReportRecipient}
      updateReportRecipient={updateReportRecipient}
      deleteReportRecipient={deleteReportRecipient}
      enterTenant={enterTenant}
      loadCommercialCatalog={loadCommercialCatalog}
      loadTenantEntitlement={loadTenantEntitlement}
      saveTenantEntitlement={saveTenantEntitlement}
      isSys={isSys}
    />
  );
}
