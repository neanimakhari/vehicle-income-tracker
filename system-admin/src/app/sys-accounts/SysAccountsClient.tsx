"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

type SysAccount = {
  id: string;
  email: string;
  isActive: boolean;
  createdAt?: string;
};

export function SysAccountsClient({
  accounts,
  createAccount,
  setActive,
}: {
  accounts: SysAccount[];
  createAccount: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
  setActive: (id: string, isActive: boolean) => Promise<{ success: boolean; error?: string }>;
}) {
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function onCreate(formData: FormData) {
    setError(null);
    const result = await createAccount(formData);
    if (!result.success) {
      setError(result.error ?? "Failed");
      return;
    }
    setOpen(false);
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            SYS accounts
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Support users who can enter any tenant without tenant-admin passwords.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 sm:mt-0"
        >
          <Plus className="h-4 w-4" />
          Add SYS account
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Email</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {accounts.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                  No SYS accounts yet.
                </td>
              </tr>
            )}
            {accounts.map((a) => (
              <tr key={a.id}>
                <td className="px-4 py-3">{a.email}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      a.isActive
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {a.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="text-teal-600 hover:underline"
                    onClick={async () => {
                      await setActive(a.id, !a.isActive);
                    }}
                  >
                    {a.isActive ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            action={onCreate}
            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900"
          >
            <h2 className="text-lg font-semibold">Create SYS account</h2>
            <label className="block text-sm">
              Email
              <input name="email" type="email" required className="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800" />
            </label>
            <label className="block text-sm">
              Password
              <input name="password" type="password" required minLength={8} className="mt-1 w-full rounded border px-3 py-2 dark:bg-zinc-800" />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="rounded px-3 py-2 text-sm">
                Cancel
              </button>
              <button type="submit" className="rounded bg-teal-600 px-3 py-2 text-sm text-white">
                Create
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
