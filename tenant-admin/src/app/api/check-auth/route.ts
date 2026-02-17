import { NextResponse } from "next/server";
import { getAuthToken } from "@/lib/auth";

/**
 * GET /api/check-auth
 * Used by AuthChecker to detect expired session. Returns 200 if tenant_admin_token exists, 401 otherwise.
 */
export async function GET() {
  const token = await getAuthToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
