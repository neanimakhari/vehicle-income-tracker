import { NextResponse } from "next/server";
import { getApiUrl } from "@/lib/api";
import { clearAuthToken, getRefreshToken, setAuthToken } from "@/lib/auth";

/** POST /api/session/extend — renew access token via refresh cookie. */
export async function POST() {
  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    await clearAuthToken();
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
      await clearAuthToken();
      return NextResponse.json(
        { error: body.message ?? "Refresh failed" },
        { status: 401 },
      );
    }
    await setAuthToken(body.accessToken, {
      refreshToken: body.refreshToken ?? refreshToken,
    });
    return NextResponse.json({ ok: true });
  } catch {
    await clearAuthToken();
    return NextResponse.json({ error: "Refresh failed" }, { status: 401 });
  }
}
