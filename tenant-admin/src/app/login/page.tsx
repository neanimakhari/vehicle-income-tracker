import { getEffectiveTenantSlug } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";
import type { PolicyBrand } from "@/lib/brand-tokens";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  let displayName: string | null = null;
  let logoSrc = "/vit-logo.png";
  let loginBackgroundUrl: string | null = null;

  const slug = await getEffectiveTenantSlug();
  if (slug) {
    try {
      const res = await fetch(`${getApiUrl()}/tenant/policy/public`, {
        cache: "no-store",
        headers: { "X-Tenant-Id": slug },
      });
      if (res.ok) {
        const policy = (await res.json()) as {
          tenantName?: string;
          brand?: PolicyBrand;
        };
        const brand = policy.brand;
        displayName = brand?.displayName || policy.tenantName || null;
        if (brand?.mode === "custom" && brand.logoUrl) {
          logoSrc = brand.logoUrl;
        }
        if (brand?.mode === "custom" && brand.loginBackgroundUrl) {
          loginBackgroundUrl = brand.loginBackgroundUrl;
        }
      }
    } catch {
      /* ignore */
    }
  }

  return (
    <LoginForm
      displayName={displayName}
      logoSrc={logoSrc}
      loginBackgroundUrl={loginBackgroundUrl}
    />
  );
}
