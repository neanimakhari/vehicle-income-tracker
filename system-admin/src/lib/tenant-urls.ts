/** Public tenant-facing URLs for platform admin copy/share. */

export function getTenantAdminBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_TENANT_ADMIN_URL?.replace(/\/$/, "") ||
    "https://vit-admin.vehinc.co.za"
  );
}

export function getVitAppBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_VIT_APP_URL?.replace(/\/$/, "") ||
    "https://vit-app.vehinc.co.za"
  );
}

export function tenantAdminLoginUrl(slug: string): string {
  const s = slug.trim();
  if (!s) return getTenantAdminBaseUrl();
  return `${getTenantAdminBaseUrl()}/${encodeURIComponent(s)}/login`;
}

export function vitAppDownloadUrl(slug: string): string {
  const s = slug.trim();
  if (!s) return getVitAppBaseUrl();
  return `${getVitAppBaseUrl()}/${encodeURIComponent(s)}`;
}
