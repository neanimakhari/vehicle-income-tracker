"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Search } from "lucide-react";
import { CreateTenantAdminModal } from "@/components/CreateTenantAdminModal";
import { EditTenantAdminModal } from "@/components/EditTenantAdminModal";

const PAGE_SIZE = 10;

type Tenant = { id: string; name: string; slug: string };
type TenantAdmin = {
  id: string;
  email: string;
  tenantId: string;
  tenantName?: string;
  isActive: boolean;
  createdAt: string;
};

type TenantAdminsClientProps = {
  tenants: Tenant[];
  admins: TenantAdmin[];
  createTenantAdmin: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  updateTenantAdmin: (id: string, data: { email?: string; tenantSlug?: string; isActive?: boolean }) => Promise<{ success: boolean; error?: string }>;
  tenantsLoadFailed?: boolean;
};

export function TenantAdminsClient({
  tenants,
  admins,
  createTenantAdmin,
  updateTenantAdmin,
  tenantsLoadFailed = false,
}: TenantAdminsClientProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editAdmin, setEditAdmin] = useState<TenantAdmin | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim()) return admins;
    const q = search.trim().toLowerCase();
    return admins.filter(
      (a) =>
        a.email.toLowerCase().includes(q) ||
        (a.tenantName ?? "").toLowerCase().includes(q) ||
        a.tenantId.toLowerCase().includes(q)
    );
  }, [admins, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageAdmins = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div>
      {tenantsLoadFailed && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          Tenant list could not be loaded; tenant options below are derived from existing admins. Check API/DB connectivity.
        </div>
      )}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tenant Admins</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Provision tenant administrators and assign them to tenants.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            <Plus className="h-4 w-4" />
            Add tenant admin
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label htmlFor="tenant-admins-search" className="sr-only">Search</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            id="tenant-admins-search"
            type="search"
            placeholder="Search by email or tenant..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="input w-64 pl-9 py-2 text-sm"
            aria-label="Search tenant admins"
          />
        </div>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black/5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">Email</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">Tenant</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">Status</th>
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">Created</th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                  {pageAdmins.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        {filtered.length === 0 && admins.length === 0
                          ? "No tenant admins. Add one to let them sign in to a tenant portal."
                          : "No matching tenant admins."}
                      </td>
                    </tr>
                  )}
                  {pageAdmins.map((admin) => (
                    <tr key={admin.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {admin.email}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {admin.tenantName ? `${admin.tenantName} (${admin.tenantId})` : admin.tenantId}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            admin.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {admin.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {admin.createdAt ? new Date(admin.createdAt).toLocaleDateString() : "—"}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <button
                          type="button"
                          onClick={() => setEditAdmin(admin)}
                          className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
                          aria-label={`Edit ${admin.email}`}
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Showing {start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
              aria-label="Previous page"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <CreateTenantAdminModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        tenants={tenants}
        createTenantAdmin={createTenantAdmin}
      />
      <EditTenantAdminModal
        admin={editAdmin}
        tenants={tenants}
        onClose={() => setEditAdmin(null)}
        updateTenantAdmin={updateTenantAdmin}
      />
    </div>
  );
}
