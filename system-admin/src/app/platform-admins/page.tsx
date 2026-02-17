import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { PlatformAdminsClient } from "./PlatformAdminsClient";

async function fetchAdmins() {
  const admins = await fetchJson<Array<{ id: string; email: string }>>("/platform/admins");
  return admins ?? [];
}

export default async function PlatformAdminsPage() {
  await requireAuth();
  const admins = await fetchAdmins();

  async function createPlatformAdmin(formData: FormData): Promise<{ success: boolean; error?: string }> {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    if (!email || !password) {
      return { success: false, error: "Email and password are required" };
    }
    if (password.length < 12) {
      return { success: false, error: "Password must be at least 12 characters" };
    }
    try {
      const res = await fetch(`${getApiUrl()}/platform/admins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ email, password, role: "PLATFORM_ADMIN" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { message?: string }).message ?? "Failed to create admin";
        return { success: false, error: msg };
      }
      revalidatePath("/platform-admins");
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Request failed" };
    }
  }

  return <PlatformAdminsClient admins={admins} createPlatformAdmin={createPlatformAdmin} />;
}


