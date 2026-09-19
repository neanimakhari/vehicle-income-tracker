import { NextResponse } from "next/server";
import { getAuthToken, getTenantSlug } from "@/lib/auth";

/** Short-lived session credentials for Socket.IO (httpOnly cookie → client auth). */
export async function GET() {
  const token = await getAuthToken();
  const tenantId = await getTenantSlug();
  if (!token || !tenantId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ token, tenantId });
}
