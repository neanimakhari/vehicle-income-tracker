import { NextResponse } from "next/server";
import { getApiUrl } from "@/lib/api-client";
import {
  clearAuthSession,
  getRefreshToken,
  getTenantSlug,
  setAuthSession,
} from "@/lib/auth";

/** POST /api/session/extend — renew access token via refresh cookie. */
export async function POST() {
  const refreshToken = await getRefreshToken();
  const tenant = await getTenantSlug();
  if (!refreshToken || !tenant) {
    await clearAuthSession();
    return NextResponse.json({ error: "No refresh session" }, { status: 401 });
  }
  try {
    const res = await fetch(`${getApiUrl()}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const body = (await res.json().catch(() => ({}))) as {
      accessToken?: string;
      refreshToken?: string;
      message?: string;
    };
    if (!res.ok || !body.accessToken) {
      await clearAuthSession();
      return NextResponse.json(
        { error: body.message ?? "Refresh failed" },
        { status: 401 },
      );
    }
    await setAuthSession(body.accessToken, tenant, {
      refreshToken: body.refreshToken ?? refreshToken,
    });
    return NextResponse.json({ ok: true });
  } catch {
    await clearAuthSession();
    return NextResponse.json({ error: "Refresh failed" }, { status: 401 });
  }
}
