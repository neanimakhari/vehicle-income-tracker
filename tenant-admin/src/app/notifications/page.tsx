import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { revalidatePath } from "next/cache";
import { entitlementList, hasModule } from "@/lib/entitlements";
import { ModuleLocked } from "@/components/module-locked";
import { SendNotificationForm } from "./SendNotificationForm";
import {
  RecentNotificationsTable,
  type SentNotificationRow,
} from "./RecentNotificationsTable";
import { NotificationsInbox } from "./NotificationsInbox";
import Link from "next/link";

async function fetchCategories() {
  const categories = await fetchJson<Array<{ id: string; name: string; description: string | null }>>(
    "/tenant/notifications/categories",
  );
  return categories ?? [];
}

async function fetchNotifications() {
  const items = await fetchJson<SentNotificationRow[]>(
    "/tenant/notifications?view=sent",
  );
  return items ?? [];
}

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireAuth();
  const sp = await searchParams;
  const tab = sp.tab === "inbox" ? "inbox" : "compose";
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

  async function loadReads(id: string) {
    "use server";
    try {
      const res = await fetch(`${getApiUrl()}/tenant/notifications/${id}/reads`, {
        headers: { ...(await getAuthHeaders()) },
        cache: "no-store",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(body.message) ? body.message.join(" ") : body.message;
        return { error: String(msg ?? `Failed (${res.status})`) };
      }
      return body as {
        notificationId: string;
        audienceCount: number;
        readCount: number;
        unreadCount: number;
        reads: Array<{
          userId: string;
          displayName: string | null;
          email: string | null;
          role: string;
          readAt: string;
        }>;
      };
    } catch {
      return { error: "Request failed" };
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Notifications</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Inbox receives live alerts (including panics). Compose sends to drivers; the Read column
          shows who opened the message in the app.
        </p>
        <div className="mt-3 flex gap-2 text-sm">
          <Link
            href="/notifications?tab=inbox"
            className={`rounded-md px-3 py-1.5 ${
              tab === "inbox"
                ? "bg-teal-600 text-white"
                : "border border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
            }`}
          >
            Inbox
          </Link>
          <Link
            href="/notifications"
            className={`rounded-md px-3 py-1.5 ${
              tab === "compose"
                ? "bg-teal-600 text-white"
                : "border border-zinc-200 text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
            }`}
          >
            Compose &amp; sent
          </Link>
        </div>
      </div>
      {tab === "inbox" ? (
        <NotificationsInbox />
      ) : (
        <>
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
            <RecentNotificationsTable notifications={notifications} loadReads={loadReads} />
          </div>
        </>
      )}
    </div>
  );
}
