import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { SysAccountsClient } from "./SysAccountsClient";

export default async function SysAccountsPage() {
  await requireAuth();
  const accounts =
    (await fetchJson<
      Array<{ id: string; email: string; isActive: boolean; createdAt?: string }>
    >("/platform/sys-accounts")) ?? [];

  async function createAccount(
    formData: FormData,
  ): Promise<{ success: boolean; error?: string }> {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    try {
      const res = await fetch(`${getApiUrl()}/platform/sys-accounts`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { message?: string | string[] }).message;
        return {
          success: false,
          error: Array.isArray(msg) ? msg.join(", ") : msg ?? "Failed",
        };
      }
      revalidatePath("/sys-accounts");
      return { success: true };
    } catch {
      return { success: false, error: "Request failed" };
    }
  }

  async function setActive(
    id: string,
    isActive: boolean,
  ): Promise<{ success: boolean; error?: string }> {
    "use server";
    try {
      const res = await fetch(`${getApiUrl()}/platform/sys-accounts/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) return { success: false, error: "Failed to update" };
      revalidatePath("/sys-accounts");
      return { success: true };
    } catch {
      return { success: false, error: "Request failed" };
    }
  }

  return (
    <SysAccountsClient
      accounts={accounts}
      createAccount={createAccount}
      setActive={setActive}
    />
  );
}
