"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getApiUrl } from "./api";
import { clearAuthToken, setAuthToken } from "./auth";

export type LoginResult = { error: string; message?: string } | void;

function isNextRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    String((error as { digest: string }).digest).startsWith("NEXT_REDIRECT")
  );
}

function friendlyMessage(res: Response, apiMessage: string): string {
  if (res.status >= 500) return "Something went wrong. Please try again.";
  if (apiMessage.toLowerCase().includes("internal")) {
    return "Something went wrong. Please try again.";
  }
  return apiMessage || "Invalid credentials.";
}

export async function loginAction(formData: FormData): Promise<LoginResult> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const mfaToken = String(formData.get("mfaToken") ?? "").trim();
  const rememberMe =
    formData.get("rememberMe") === "on" || formData.get("rememberMe") === "true";

  if (!email || !password) {
    return { error: "missing", message: "Email and password are required." };
  }

  try {
    const res = await fetch(`${getApiUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        mfaToken: mfaToken || undefined,
        clientApp: "platform-admin",
      }),
    });

    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
      accessToken?: string;
    };
    const apiMessage = Array.isArray(body.message)
      ? body.message.join(" ")
      : (body.message ?? "");

    if (!res.ok) {
      if (apiMessage.includes("MFA required")) {
        return { error: "mfa-required", message: "Enter your authenticator code." };
      }
      if (apiMessage.includes("MFA setup required")) {
        return {
          error: "mfa-setup",
          message: "MFA setup required. Enable MFA in Security before logging in.",
        };
      }
      if (apiMessage.includes("not for the specified tenant")) {
        return { error: "wrong-tenant", message: "This account is not for the selected tenant." };
      }
      if (
        apiMessage.includes("platform/sys admin") ||
        apiMessage.includes("system admin")
      ) {
        return {
          error: "wrong-app",
          message: "Use the tenant admin app for tenant accounts.",
        };
      }
      if (apiMessage.includes("Invalid credentials")) {
        return { error: "invalid-credentials", message: "Incorrect email or password." };
      }
      return { error: "invalid", message: friendlyMessage(res, apiMessage) };
    }

    if (!body.accessToken) {
      return { error: "invalid", message: "Invalid response from server." };
    }

    try {
      await setAuthToken(body.accessToken, { rememberMe });
    } catch (sessionErr) {
      console.error("Login setAuthToken error:", sessionErr);
      return {
        error: "invalid",
        message: "Login succeeded but session could not be saved. Try again.",
      };
    }

    revalidatePath("/", "layout");
    redirect("/");
  } catch (e) {
    if (isNextRedirect(e)) throw e;
    console.error("Login action error:", e);
    const isNetwork =
      e instanceof TypeError &&
      (String(e.message).includes("fetch") || String(e.message).includes("Failed to fetch"));
    return {
      error: "invalid",
      message: isNetwork
        ? "Could not reach the API. Check that it is running."
        : "Something went wrong. Please try again.",
    };
  }
}

export async function logoutAction() {
  await clearAuthToken();
  redirect("/login");
}
