import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const TOKEN_COOKIE = "tenant_admin_token";
const TENANT_COOKIE = "tenant_admin_tenant";
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_COOKIE)?.value ?? null;
}

export async function getTenantSlug(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(TENANT_COOKIE)?.value ?? null;
}

const REMEMBER_ME_DAYS = 30;
const SESSION_COOKIE_DAYS = 1;

export async function setAuthSession(token: string, tenant: string, options?: { rememberMe?: boolean }) {
  const cookieStore = await cookies();
  const rememberMe = options?.rememberMe === true;
  const maxAge = rememberMe ? REMEMBER_ME_DAYS * 24 * 60 * 60 : SESSION_COOKIE_DAYS * 24 * 60 * 60;
  cookieStore.set(TOKEN_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge,
  });
  cookieStore.set(TENANT_COOKIE, tenant, {
    httpOnly: true,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge,
  });
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE);
  cookieStore.delete(TENANT_COOKIE);
}

export async function requireAuth(): Promise<{ token: string; tenant: string }> {
  const token = await getAuthToken();
  const tenant = await getTenantSlug();
  if (!token || !tenant) {
    redirect("/login");
  }
  return { token, tenant };
}


