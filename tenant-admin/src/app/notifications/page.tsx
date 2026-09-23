import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { revalidatePath } from "next/cache";
import { entitlementList, hasModule } from "@/lib/entitlements";
import { ModuleLocked } from "@/components/module-locked";

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

  async function sendNotification(formData: FormData) {
    "use server";
    const title = String(formData.get("title") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();
    const categoryId = String(formData.get("categoryId") ?? "").trim();
    const targetRole = String(formData.get("targetRole") ?? "").trim();
    if (!title || !message) return;
    await fetch(`${getApiUrl()}/tenant/notifications/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify({
        title,
        message,
        categoryId: categoryId || null,
        targetRole: targetRole || null,
      }),
    });
    revalidatePath("/notifications");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Notifications</h1>
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
          <form action={sendNotification} className="space-y-3">
            <select name="categoryId" className="input w-full px-3 py-2 text-sm">
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <select name="targetRole" className="input w-full px-3 py-2 text-sm">
              <option value="">All roles</option>
              <option value="TENANT_ADMIN">TENANT_ADMIN</option>
              <option value="TENANT_USER">TENANT_USER</option>
            </select>
            <input name="title" placeholder="Title" className="input w-full px-3 py-2 text-sm" required />
            <textarea name="message" placeholder="Message" className="input w-full px-3 py-2 text-sm" rows={4} required />
            <button className="btn btn-primary" type="submit">Send</button>
          </form>
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
              {notifications.map((n) => (
                <tr key={n.id}>
                  <td className="px-3 py-2 text-sm">{new Date(n.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2 text-sm">{n.title}</td>
                  <td className="px-3 py-2 text-sm">{n.targetRole ?? "All"}</td>
                  <td className="px-3 py-2 text-sm">{n.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

