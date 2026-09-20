import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthToken } from "@/lib/auth";

function decodeJwtExp(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString(
      "utf8",
    );
    const payload = JSON.parse(json) as { exp?: number };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const exp = decodeJwtExp(token);
  if (exp == null) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }
  const now = Math.floor(Date.now() / 1000);
  const secondsLeft = exp - now;
  if (secondsLeft <= 0) {
    return NextResponse.json({ error: "Expired" }, { status: 401 });
  }
  const cookieStore = await cookies();
  const hasRefresh = Boolean(cookieStore.get("system_admin_refresh")?.value);
  return NextResponse.json({
    ok: true,
    expiresAt: exp * 1000,
    secondsLeft,
    canExtend: hasRefresh,
  });
}
