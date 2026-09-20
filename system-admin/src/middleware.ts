import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const TOKEN_COOKIE = "system_admin_token";
const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(TOKEN_COOKIE)?.value;
  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const loginError = request.nextUrl.searchParams.get("error");

  // Expired/idle logout lands on /login?error=… with the cookie still present.
  // Clearing it here breaks the / ↔ /login redirect loop.
  if (isPublicPath && token && loginError) {
    const res = NextResponse.next();
    for (const name of [TOKEN_COOKIE, "system_admin_refresh"]) {
      res.cookies.set(name, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: COOKIE_SECURE,
        path: "/",
        maxAge: 0,
      });
    }
    return res;
  }

  if (token && isPublicPath) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/login/:path*", "/forgot-password", "/reset-password"],
};
