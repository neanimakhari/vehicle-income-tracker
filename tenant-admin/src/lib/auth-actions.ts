"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getApiUrl } from "./api-client";
import { clearAuthSession, setAuthSession } from "./auth";

export type LoginResult = { error: string; message?: string } | void;

function friendlyMessage(res: Response, apiMessage: string): string {
  // Don't show raw "Internal server error" or 5xx messages to the user
  if (res.status >= 500) return "Something went wrong. Please try again.";
  if (apiMessage.toLowerCase().includes("internal")) return "Something went wrong. Please try again.";
  return apiMessage || "Invalid credentials or tenant.";
}

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const tenantSlug = String(formData.get("tenantSlug") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const mfaToken = String(formData.get("mfaToken") ?? "").trim();
  const rememberMe = formData.get("rememberMe") === "on" || formData.get("rememberMe") === "true";

  if (!tenantSlug || !email || !password) {
    return { error: "missing", message: "Tenant, email and password are required." };
  }

  try {
    const apiUrl = getApiUrl();
    const res = await fetch(`${apiUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenantSlug,
        email,
        password,
        mfaToken: mfaToken || undefined,
      }),
    });

    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const apiMessage = Array.isArray(body.message) ? body.message.join(" ") : (body.message ?? "");

    if (!res.ok) {
      if (res.status >= 500) console.error("Login API error:", res.status, apiMessage);
      if (apiMessage.includes("MFA required")) {
        return { error: "mfa-required", message: "Enter your authenticator code." };
      }
      if (apiMessage.includes("MFA setup required")) {
        return { error: "mfa-setup", message: "MFA setup required. Complete setup in Security settings." };
      }
      return { error: "invalid", message: friendlyMessage(res, apiMessage) };
    }

    const data = body as { accessToken?: string; user?: { tenantId?: string } };
    const tenant = data.user?.tenantId ?? "";
    if (!data.accessToken || !tenant) {
      return { error: "invalid", message: "Invalid response from server." };
    }

    try {
      await setAuthSession(data.accessToken, tenant, { rememberMe });
    } catch (sessionErr) {
      console.error("Login setAuthSession error:", sessionErr);
      return { error: "invalid", message: "Login succeeded but session could not be saved. Try again." };
    }
    revalidatePath("/", "layout");
    redirect("/");
  } catch (err) {
    const digest = err && typeof err === "object" && "digest" in err ? String((err as { digest?: string }).digest) : "";
    if (digest.startsWith("NEXT_REDIRECT")) throw err;
    console.error("Login action error:", err);
    const isNetwork = err instanceof TypeError && (err.message?.includes("fetch") || err.message?.includes("Failed to fetch"));
    return { error: "invalid", message: isNetwork ? "Could not reach the API. Check that it is running." : "Something went wrong. Please try again." };
  }
}

export async function logoutAction() {
  await clearAuthSession();
  redirect("/login");
}
