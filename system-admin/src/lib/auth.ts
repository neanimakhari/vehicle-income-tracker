import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const TOKEN_COOKIE = "system_admin_token";
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

export async function getAuthToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(TOKEN_COOKIE)?.value ?? null;
}

const REMEMBER_ME_DAYS = 30;
const SESSION_COOKIE_DAYS = 1;

export async function setAuthToken(token: string, options?: { rememberMe?: boolean }) {
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
}

export async function clearAuthToken() {
  const cookieStore = await cookies();
  cookieStore.delete(TOKEN_COOKIE);
}

export async function requireAuth(): Promise<string> {
  const token = await getAuthToken();
  if (!token) {
    redirect("/login");
  }
  return token;
}


