import { NextRequest, NextResponse } from "next/server";

/** App routes that are never tenant slugs. */
const RESERVED = new Set([
  "",
  "login",
  "logout",
  "forgot-password",
  "reset-password",
  "verify-email",
  "mfa",
  "privacy",
  "terms",
  "help",
  "api",
  "actions",
  "sys-enter",
  "_next",
  "favicon.ico",
  "robots.txt",
  "bg.jpg",
  "vit-logo.png",
  // App page segments (must not be usable as tenant path prefixes)
  "drivers",
  "vehicles",
  "incomes",
  "expenses",
  "maintenance",
  "reports",
  "tracking",
  "trips",
  "transport",
  "audit",
  "notifications",
  "sessions",
  "tenant-security",
  "expiry-requests",
  "scholar-payments",
  "target-calendar",
]);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i;

function isTenantSlug(segment: string): boolean {
  if (!segment || RESERVED.has(segment.toLowerCase())) return false;
  return SLUG_RE.test(segment) && segment.length <= 64;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const parts = pathname.split("/").filter(Boolean);
  const first = parts[0] ?? "";
  const loginError = request.nextUrl.searchParams.get("error");
  const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

  // Clear stale auth cookies when landing on login with an error so the
  // authenticated layout shell never wraps the login form (logout bug).
  if (
    (pathname === "/login" || pathname.endsWith("/login")) &&
    loginError
  ) {
    const res = NextResponse.next();
    for (const name of [
      "tenant_admin_token",
      "tenant_admin_refresh",
      "tenant_admin_tenant",
      "tenant_admin_sys_banner",
    ]) {
      res.cookies.set(name, "", {
        httpOnly: name !== "tenant_admin_sys_banner",
        sameSite: "lax",
        secure: COOKIE_SECURE,
        path: "/",
        maxAge: 0,
      });
    }
    return res;
  }

  // /{slug} or /{slug}/... → rewrite to internal path, remember slug
  if (isTenantSlug(first)) {
    const rest = parts.slice(1).join("/");
    const url = request.nextUrl.clone();
    url.pathname = rest ? `/${rest}` : "/";
    const res = NextResponse.rewrite(url);
    res.cookies.set("vit_path_tenant", first, {
      path: "/",
      sameSite: "lax",
      httpOnly: false,
    });
    return res;
  }

  // Bare app path with known path-tenant cookie → keep cookie; optional redirect to pretty URL
  const pathTenant = request.cookies.get("vit_path_tenant")?.value;
  if (
    pathTenant &&
    isTenantSlug(pathTenant) &&
    !pathname.startsWith("/api") &&
    !pathname.startsWith("/_next") &&
    pathname !== "/login" &&
    pathname !== "/forgot-password" &&
    pathname !== "/sys-enter"
  ) {
    // Already on a non-prefixed path after rewrite; leave as-is for Link hrefs.
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)$).*)"],
};
