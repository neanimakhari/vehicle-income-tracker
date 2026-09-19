import { brandResolvePreview } from "@/app/tenants/brand-actions";
import { BrandPreviewClient } from "./BrandPreviewClient";

export default async function BrandPreviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const res = await brandResolvePreview(token);
  if (!res.ok || !res.data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
        <p className="text-sm text-red-600">
          {res.error || "This preview link is invalid or expired."}
        </p>
      </div>
    );
  }
  const data = res.data as {
    brand: {
      displayName?: string;
      primaryColor?: string;
      accentColor?: string;
      sidebarStyle?: "colored" | "neutral";
      logoUrl?: string;
    };
    meta: { watermark: string; tenantSlug: string | null };
  };
  return (
    <BrandPreviewClient
      brand={{
        displayName: data.brand.displayName ?? null,
        primaryHex: data.brand.primaryColor ?? null,
        accentHex: data.brand.accentColor ?? null,
        sidebarStyle: data.brand.sidebarStyle,
        logoUrl: data.brand.logoUrl,
      }}
      tenantName={data.brand.displayName || data.meta.tenantSlug || "Fleet"}
      watermark={data.meta.watermark}
    />
  );
}
