"use client";

import { useState, useMemo } from "react";
import { AlertCircle, Pencil, Plus, Download, Search } from "lucide-react";
import { CreateTenantModal } from "@/components/CreateTenantModal";
import { EditTenantModal } from "@/components/EditTenantModal";
import { TenantBillingModal } from "@/components/TenantBillingModal";
import Link from "next/link";

type Tenant = {
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
};

type TenantAdmin = { id: string; email: string; tenantId: string };
type UsageItem = {
  id: string;
  name: string;
  slug: string;
  drivers: number;
  incomes: number;
  vehicles: number;
  totalIncome: number;
};

type TenantsClientProps = {
  tenants: Tenant[];
  admins: TenantAdmin[];
  usage: UsageItem[];
  createTenant: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  updateTenant: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  toggleTenant: (formData: FormData) => void;
  toggleMfa: (formData: FormData) => void;
  toggleUserMfa: (formData: FormData) => void;
};

function escapeCsv(s: string): string {
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function TenantsClient({
  tenants,
  admins,
  usage,
  createTenant,
  updateTenant,
  toggleTenant,
  toggleMfa,
  toggleUserMfa,
}: TenantsClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [billingTenant, setBillingTenant] = useState<{ tenant: Tenant; usage: UsageItem | null } | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [search, setSearch] = useState("");
  const tenantSlugsWithAdmin = new Set(admins.map((a) => a.tenantId));
  const usageBySlug = useMemo(() => {
    const m: Record<string, UsageItem> = {};
    for (const u of usage) m[u.slug] = u;
    return m;
  }, [usage]);
  const filteredTenants = useMemo(() => {
    let list = tenants;
    if (statusFilter === "active") list = list.filter((t) => t.isActive);
    if (statusFilter === "inactive") list = list.filter((t) => !t.isActive);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          (t.contactEmail ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [tenants, statusFilter, search]);
  const tenantsWithNoAdmin = tenants.filter((t) => !tenantSlugsWithAdmin.has(t.slug));

  const exportCsv = () => {
    const headers = [
      "Name",
      "Slug",
      "Status",
      "Contact",
      "Has admin",
      "Admin MFA",
      "Driver MFA",
      "Drivers",
      "Vehicles",
      "Income records",
      "Total income",
    ];
    const rows = filteredTenants.map((t) => {
      const u = usageBySlug[t.slug];
      return [
        escapeCsv(t.name),
        escapeCsv(t.slug),
        t.isActive ? "Active" : "Inactive",
        escapeCsv(t.contactEmail || t.contactPhone || t.contactName || ""),
        tenantSlugsWithAdmin.has(t.slug) ? "Yes" : "No",
        t.requireMfa ? "Required" : "Optional",
        t.requireMfaUsers ? "Required" : "Optional",
        String(u?.drivers ?? ""),
        String(u?.vehicles ?? ""),
        String(u?.incomes ?? ""),
        String(u?.totalIncome ?? ""),
      ].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tenants-usage-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tenants</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Manage tenant records and provisioning status. Usage (drivers, vehicles, income records, total income) is available for billing; export CSV for invoicing.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={exportCsv}
            className="inline-flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            <Download className="h-4 w-4" />
            Export CSV (billing)
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            <Plus className="h-4 w-4" />
            Add tenant
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            placeholder="Search by name, slug, contact..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </div>

      {tenantsWithNoAdmin.length > 0 && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
          <AlertCircle className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {tenantsWithNoAdmin.length} tenant(s) have no tenant admin yet.
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              Assign an admin so they can sign in to the tenant portal:{" "}
              {tenantsWithNoAdmin.map((t) => t.name).join(", ")}.
            </p>
            <Link
              href="/tenant-admins"
              className="mt-2 inline-block text-sm font-medium text-amber-800 underline hover:text-amber-900 dark:text-amber-200 dark:hover:text-amber-100"
            >
              Go to Tenant Admins →
            </Link>
          </div>
        </div>
      )}

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black/5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Name
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Slug
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Contact
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Has admin
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Status
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Admin MFA
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Driver MFA
                    </th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Usage
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                  {filteredTenants.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        <p className="font-medium text-zinc-700 dark:text-zinc-300">
                          {tenants.length === 0
                            ? "No tenants yet. Create one below, or run the database seed (see README)."
                            : "No tenants match the current filters."}
                        </p>
                      </td>
                    </tr>
                  )}
                  {filteredTenants.map((tenant) => {
                    const u = usageBySlug[tenant.slug];
                    return (
                    <tr key={tenant.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {tenant.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {tenant.slug}
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {tenant.contactEmail || tenant.contactPhone || tenant.contactName || "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        {tenantSlugsWithAdmin.has(tenant.slug) ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2 text-xs font-semibold leading-5 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                            Yes
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 text-xs font-semibold leading-5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                            No
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            tenant.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {tenant.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            tenant.requireMfa
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {tenant.requireMfa ? "Required" : "Optional"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            tenant.requireMfaUsers
                              ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                              : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
                          }`}
                        >
                          {tenant.requireMfaUsers ? "Required" : "Optional"}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {u ? (
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span title={`Vehicles: ${u.vehicles}. Total income (logged): ${u.totalIncome}`}>
                              {tenant.maxDrivers != null
                                ? `${u.drivers} / ${tenant.maxDrivers} drivers`
                                : `${u.drivers} drivers`}
                              , {u.vehicles} vehicles, {u.incomes} income records
                              {u.totalIncome > 0 && ` · ${Number(u.totalIncome).toLocaleString()} total`}
                            </span>
                            <button
                              type="button"
                              onClick={() => setBillingTenant({ tenant, usage: u })}
                              className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-medium whitespace-nowrap"
                            >
                              View usage
                            </button>
                          </span>
                        ) : (
                          <span className="flex items-center gap-2">
                            <span>—</span>
                            <button
                              type="button"
                              onClick={() => setBillingTenant({ tenant, usage: null })}
                              className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 font-medium"
                            >
                              View usage
                            </button>
                          </span>
                        )}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => setEditTenant(tenant)}
                            className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                            title="Edit tenant"
                            aria-label="Edit tenant"
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </button>
                          <form action={toggleTenant}>
                            <input type="hidden" name="id" value={tenant.id} />
                            <input type="hidden" name="isActive" value={String(tenant.isActive)} />
                            <button className="text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300" type="submit">
                              {tenant.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                          <form action={toggleMfa}>
                            <input type="hidden" name="id" value={tenant.id} />
                            <input type="hidden" name="requireMfa" value={String(tenant.requireMfa)} />
                            <button className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300" type="submit">
                              {tenant.requireMfa ? "Disable MFA" : "Require MFA"}
                            </button>
                          </form>
                          <form action={toggleUserMfa}>
                            <input type="hidden" name="id" value={tenant.id} />
                            <input type="hidden" name="requireMfaUsers" value={String(tenant.requireMfaUsers)} />
                            <button className="text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300" type="submit">
                              {tenant.requireMfaUsers ? "Disable Driver MFA" : "Require Driver MFA"}
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <CreateTenantModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        createTenant={createTenant}
      />
      <EditTenantModal
        tenant={editTenant}
        onClose={() => setEditTenant(null)}
        updateTenant={updateTenant}
      />
      {billingTenant && (
        <TenantBillingModal
          tenantName={billingTenant.tenant.name}
          tenantSlug={billingTenant.tenant.slug}
          usage={billingTenant.usage}
          onClose={() => setBillingTenant(null)}
        />
      )}
    </div>
  );
}
