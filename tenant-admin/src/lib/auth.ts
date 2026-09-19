import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const TOKEN_COOKIE = "tenant_admin_token";
const TENANT_COOKIE = "tenant_admin_tenant";
const SYS_BANNER_COOKIE = "tenant_admin_sys_banner";
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

const httpOnlyCookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: COOKIE_SECURE,
  path: "/",
};

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_COOKIE)?.value ?? null;
}

export async function getTenantSlug(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(TENANT_COOKIE)?.value ?? null;
}

/** Session tenant, or path vanity slug (/{slug}/login) before auth. */
export async function getEffectiveTenantSlug(): Promise<string | null> {
  const cookieStore = await cookies();
  return (
    cookieStore.get(TENANT_COOKIE)?.value ??
    cookieStore.get("vit_path_tenant")?.value ??
    null
  );
}

const REMEMBER_ME_DAYS = 30;
const SESSION_COOKIE_DAYS = 1;

export async function setAuthSession(token: string, tenant: string, options?: { rememberMe?: boolean }) {
  const cookieStore = await cookies();
  const rememberMe = options?.rememberMe === true;
  const maxAge = rememberMe ? REMEMBER_ME_DAYS * 24 * 60 * 60 : SESSION_COOKIE_DAYS * 24 * 60 * 60;
  cookieStore.set(TOKEN_COOKIE, token, {
    ...httpOnlyCookieBase,
    maxAge,
  });
  cookieStore.set(TENANT_COOKIE, tenant, {
    ...httpOnlyCookieBase,
    maxAge,
  });
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.set(TOKEN_COOKIE, "", { ...httpOnlyCookieBase, maxAge: 0 });
  cookieStore.set(TENANT_COOKIE, "", { ...httpOnlyCookieBase, maxAge: 0 });
  cookieStore.set(SYS_BANNER_COOKIE, "", {
    httpOnly: false,
    sameSite: "lax",
    secure: COOKIE_SECURE,
    path: "/",
    maxAge: 0,
  });
}

export async function requireAuth(): Promise<{ token: string; tenant: string }> {
  const token = await getAuthToken();
  const tenant = await getTenantSlug();
  if (!token || !tenant) {
    redirect("/login");
  }
  return { token, tenant };
}
