import { redirect } from "next/navigation";
import { setAuthSession } from "@/lib/auth";

type Props = {
  searchParams: Promise<{ token?: string; tenant?: string; name?: string }>;
};

export default async function SysEnterPage({ searchParams }: Props) {
  const params = await searchParams;
  const token = params.token?.trim();
  const tenant = params.tenant?.trim();
  const name = params.name?.trim() ?? tenant ?? "";

  if (!token || !tenant) {
    redirect("/login?error=sys_enter");
  }

  await setAuthSession(token, tenant, { rememberMe: false });

  // Store banner metadata in a non-httpOnly cookie for client banner
  const { cookies } = await import("next/headers");
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

  redirect("/");
}
