import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { setAuthSession } from "@/lib/auth";

function publicOrigin(request: NextRequest): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost ?? request.headers.get("host");
  const proto =
    request.headers.get("x-forwarded-proto") ??
    (host && !host.includes("localhost") ? "https" : "http");

  if (host && !host.startsWith("localhost") && !host.startsWith("127.")) {
    return `${proto.split(",")[0].trim()}://${host.split(",")[0].trim()}`;
  }

  return (
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    "https://vit-admin.vehinc.co.za"
  );
}

/**
 * SYS / platform "Enter tenant" lands here with a short-lived impersonation JWT.
 * Cookie writes must happen in a Route Handler (Next.js 15+), not a Server Component page.
 */
export async function GET(request: NextRequest) {
  const origin = publicOrigin(request);
  const sp = request.nextUrl.searchParams;
  const token = sp.get("token")?.trim();
  const tenant = sp.get("tenant")?.trim();
  const name = sp.get("name")?.trim() ?? tenant ?? "";

  if (!token || !tenant) {
    return NextResponse.redirect(new URL("/login?error=sys_enter", origin));
  }

  await setAuthSession(token, tenant, { rememberMe: false });

  const jar = await cookies();
  jar.set(
    "tenant_admin_sys_banner",
    JSON.stringify({ tenant, name, impersonation: true }),
    {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 60 * 60,
      secure: process.env.COOKIE_SECURE === "true",
    },
  );

  return NextResponse.redirect(new URL("/", origin));
}
