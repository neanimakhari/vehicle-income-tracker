import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const TOKEN_COOKIE = "system_admin_token";
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: COOKIE_SECURE,
  path: "/",
};

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
    ...cookieBase,
    maxAge,
  });
}

export async function clearAuthToken() {
  const cookieStore = await cookies();
  // Match set() attributes so browsers reliably clear the cookie
  cookieStore.set(TOKEN_COOKIE, "", {
    ...cookieBase,
    maxAge: 0,
  });
}

export async function requireAuth(): Promise<string> {
  const token = await getAuthToken();
  if (!token) {
    redirect("/login");
  }
  return token;
}

/** Decode JWT payload for UI role checks (not for authorization). */
export async function getAuthRole(): Promise<string | null> {
  const token = await getAuthToken();
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    const payload = JSON.parse(json) as { role?: string };
    return payload.role ?? null;
  } catch {
    return null;
  }
}
