import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { revalidatePath } from "next/cache";
import { entitlementList, hasModule } from "@/lib/entitlements";
import { ModuleLocked } from "@/components/module-locked";
import { SendNotificationForm } from "./SendNotificationForm";

async function fetchCategories() {
  const categories = await fetchJson<Array<{ id: string; name: string; description: string | null }>>(
    "/tenant/notifications/categories",
  );
  return categories ?? [];
}

async function fetchNotifications() {
  const items = await fetchJson<
    Array<{
      id: string;
      title: string;
      message: string;
      targetRole: string | null;
      status: string;
      createdAt: string;
    }>
  >("/tenant/notifications");
  return items ?? [];
}

export default async function NotificationsPage() {
  await requireAuth();
  const policy = await fetchJson<{
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");
  if (!hasModule(entitlementList(policy), "notifications")) {
    return <ModuleLocked title="Notifications" moduleKey="notifications" />;
  }

  const [categories, notifications] = await Promise.all([fetchCategories(), fetchNotifications()]);

  async function createCategory(formData: FormData) {
    "use server";
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (!name) return;
    await fetch(`${getApiUrl()}/tenant/notifications/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({ name, description: description || null }),
    });
    revalidatePath("/notifications");
  }

  async function sendNotification(formData: FormData): Promise<{
    ok: boolean;
    error?: string;
    status?: string;
    push?: {
      configured: boolean;
      enabled: boolean;
      skipped: boolean;
      reason?: string;
      recipientCount: number;
      onesignalId?: string | null;
      errors?: string[];
    };
  }> {
    "use server";
    const title = String(formData.get("title") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const categoryId = String(formData.get("categoryId") ?? "").trim();
    const targetRole = String(formData.get("targetRole") ?? "").trim();
    if (!title || !message) {
      return { ok: false, error: "Title and message are required" };
    }
    try {
      const res = await fetch(`${getApiUrl()}/tenant/notifications/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
        body: JSON.stringify({
          title,
          message,
          categoryId: categoryId || null,
          targetRole: targetRole || null,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(body.message) ? body.message.join(" ") : body.message;
        return { ok: false, error: msg ?? `Send failed (${res.status})` };
      }
      revalidatePath("/notifications");
      return {
        ok: true,
        status: body?.notification?.status ?? body?.status,
        push: body?.push,
      };
    } catch {
      return { ok: false, error: "Request failed" };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Notifications</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Compose messages for drivers (and optionally tenant admins). Push uses OneSignal when
          configured; otherwise the message is still saved in the notification log.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Create Category</h2>
          <form action={createCategory} className="space-y-3">
            <input name="name" placeholder="Category name" className="input w-full px-3 py-2 text-sm" required />
            <input name="description" placeholder="Description (optional)" className="input w-full px-3 py-2 text-sm" />
            <button className="btn btn-primary" type="submit">Create</button>
          </form>
          <ul className="mt-4 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
            {categories.map((c) => (
              <li key={c.id} className="rounded border border-zinc-200 px-3 py-2 dark:border-zinc-700">
                <div className="font-medium">{c.name}</div>
                <div className="text-xs text-zinc-500">{c.description ?? "—"}</div>
              </li>
            ))}
          </ul>
        </div>
        <div className="card p-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Send Notification</h2>
          <SendNotificationForm categories={categories} sendNotification={sendNotification} />
        </div>
      </div>
      <div className="card p-4">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-3">Recent Notifications</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold">Date</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Title</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Target Role</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {notifications.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-sm text-zinc-500">
                    No notifications yet.
                  </td>
                </tr>
              ) : (
                notifications.map((n) => (
                  <tr key={n.id}>
                    <td className="px-3 py-2 text-sm">{new Date(n.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2 text-sm">{n.title}</td>
                    <td className="px-3 py-2 text-sm">{n.targetRole ?? "All"}</td>
                    <td className="px-3 py-2 text-sm font-mono text-xs">{n.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
