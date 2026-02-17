"use server";

import { redirect } from "next/navigation";
import { getApiUrl } from "./api";
import { clearAuthToken, setAuthToken } from "./auth";

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const mfaToken = String(formData.get("mfaToken") ?? "").trim();
  const rememberMe = formData.get("rememberMe") === "on" || formData.get("rememberMe") === "true";

  if (!email || !password) {
    redirect("/login?error=missing");
  }

  try {
    const res = await fetch(`${getApiUrl()}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, mfaToken: mfaToken || undefined }),
    });

    if (!res.ok) {
      let reason = "invalid";
      try {
        const payload = (await res.json()) as { message?: string | string[] };
        const message = Array.isArray(payload.message)
          ? payload.message.join(" ")
          : payload.message ?? "";
        if (message.includes("MFA required")) {
          reason = "mfa-required";
        }
        if (message.includes("MFA setup required")) {
          reason = "mfa-setup";
        }
      } catch {
        // ignore parse errors
      }
      redirect(`/login?error=${reason}`);
    }

    const data = (await res.json()) as { accessToken?: string };
    if (!data.accessToken) {
      redirect("/login?error=invalid");
    }

    await setAuthToken(data.accessToken, { rememberMe });
    redirect("/");
  } catch (e) {
    console.error("Login action error:", e);
    redirect("/login?error=invalid");
  }
}

export async function logoutAction() {
  await clearAuthToken();
  redirect("/login");
}


