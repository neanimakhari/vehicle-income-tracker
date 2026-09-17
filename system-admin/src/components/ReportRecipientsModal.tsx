"use client";

import { useEffect, useState } from "react";
import { X, Plus, Trash2 } from "lucide-react";

type Recipient = {
  id: string;
  email: string;
  label: string | null;
  isActive: boolean;
};

type Props = {
  tenantSlug: string;
  tenantName: string;
  open: boolean;
  onClose: () => void;
  listRecipients: (slug: string) => Promise<Recipient[]>;
  addRecipient: (
    slug: string,
    data: { email: string; label?: string },
  ) => Promise<{ success: boolean; error?: string }>;
  updateRecipient: (
    slug: string,
    id: string,
    data: { isActive?: boolean },
  ) => Promise<{ success: boolean; error?: string }>;
  deleteRecipient: (
    slug: string,
    id: string,
  ) => Promise<{ success: boolean; error?: string }>;
};

export function ReportRecipientsModal({
  tenantSlug,
  tenantName,
  open,
  onClose,
  listRecipients,
  addRecipient,
  updateRecipient,
  deleteRecipient,
}: Props) {
  const [rows, setRows] = useState<Recipient[]>([]);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const list = await listRecipients(tenantSlug);
      setRows(list);
    } catch {
      setError("Failed to load recipients");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tenantSlug]);

  if (!open) return null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const result = await addRecipient(tenantSlug, {
      email: email.trim(),
      label: label.trim() || undefined,
    });
    if (!result.success) {
      setError(result.error ?? "Failed to add");
      return;
    }
    setEmail("");
    setLabel("");
    await refresh();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-700">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
              Monthly report recipients
            </h2>
            <p className="text-sm text-zinc-500">{tenantName}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-4">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            If empty, the first active tenant admin email is used as fallback.
          </p>

          {error && (
            <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          )}

          <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
            <input
              type="email"
              required
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-[180px] flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
            <input
              type="text"
              placeholder="Label (optional)"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-36 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              <Plus className="h-4 w-4" />
              Add
            </button>
          </form>

          <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-700 dark:border-zinc-700">
            {loading && (
              <li className="px-3 py-4 text-sm text-zinc-500">Loading…</li>
            )}
            {!loading && rows.length === 0 && (
              <li className="px-3 py-4 text-sm text-zinc-500">No recipients configured.</li>
            )}
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {r.email}
                  </p>
                  {r.label && (
                    <p className="text-xs text-zinc-500">{r.label}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      await updateRecipient(tenantSlug, r.id, {
                        isActive: !r.isActive,
                      });
                      await refresh();
                    }}
                    className={`rounded px-2 py-1 text-xs font-medium ${
                      r.isActive
                        ? "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {r.isActive ? "Active" : "Off"}
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      await deleteRecipient(tenantSlug, r.id);
                      await refresh();
                    }}
                    className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    aria-label="Remove recipient"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
