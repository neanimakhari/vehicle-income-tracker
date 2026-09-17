"use client";

import { useEffect, useState } from "react";

export function SysImpersonationBanner() {
  const [banner, setBanner] = useState<{ name: string; tenant: string } | null>(
    null,
  );

  useEffect(() => {
    try {
      const raw = document.cookie
        .split("; ")
        .find((c) => c.startsWith("tenant_admin_sys_banner="))
        ?.split("=")
        .slice(1)
        .join("=");
      if (!raw) return;
      const parsed = JSON.parse(decodeURIComponent(raw)) as {
        name?: string;
        tenant?: string;
        impersonation?: boolean;
      };
      if (parsed.impersonation && parsed.tenant) {
        setBanner({
          name: parsed.name || parsed.tenant,
          tenant: parsed.tenant,
        });
      }
    } catch {
      /* ignore */
    }
  }, []);

  if (!banner) return null;

  async function endSession() {
    await fetch("/api/logout", { method: "POST" }).catch(() => null);
    document.cookie =
      "tenant_admin_sys_banner=; path=/; max-age=0; SameSite=Lax";
    const platformUrl =
      process.env.NEXT_PUBLIC_SYSTEM_ADMIN_URL ??
      "https://vit-platform.vehinc.co.za";
    window.location.href = `${platformUrl.replace(/\/$/, "")}/tenants`;
  }

  return (
    <div className="bg-amber-500 px-4 py-2 text-center text-sm font-medium text-zinc-950">
      SYS session: viewing <strong>{banner.name}</strong> ({banner.tenant}).{" "}
      <button
        type="button"
        onClick={endSession}
        className="underline underline-offset-2"
      >
        End session
      </button>
    </div>
  );
}
