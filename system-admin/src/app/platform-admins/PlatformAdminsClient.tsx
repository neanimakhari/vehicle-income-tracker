"use client";

import { useState } from "react";
import { CreatePlatformAdminModal } from "@/components/CreatePlatformAdminModal";

type Admin = { id: string; email: string };
type Props = {
  admins: Admin[];
  createPlatformAdmin: (formData: FormData) => Promise<{ success: boolean; error?: string }>;
};

export function PlatformAdminsClient({ admins, createPlatformAdmin }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Platform Admins</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
            Create and manage system-level administrators.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600"
          >
            Create Platform Admin
          </button>
        </div>
      </div>

      <div className="mt-8 flow-root">
        <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black/5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Email
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                  {admins.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No admins loaded. Authenticate to view admins.
                      </td>
                    </tr>
                  )}
                  {admins.map((admin) => (
                    <tr key={admin.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {admin.email}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      <CreatePlatformAdminModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        createPlatformAdmin={createPlatformAdmin}
      />
    </div>
  );
}

