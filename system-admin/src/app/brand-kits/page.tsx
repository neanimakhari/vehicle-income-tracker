import { brandListKits } from "@/app/tenants/brand-actions";
import { BrandKitsClient } from "./BrandKitsClient";
import { fetchJson } from "@/lib/api";
import { requirePlatformAdmin } from "@/lib/auth";

export default async function BrandKitsPage() {
  await requirePlatformAdmin();
  const [kitsRes, tenants] = await Promise.all([
    brandListKits(),
    fetchJson<Array<{ id: string; name: string; slug: string }>>("/tenants").catch(
      () => [] as Array<{ id: string; name: string; slug: string }>,
    ),
  ]);
  const kits = kitsRes.ok && Array.isArray(kitsRes.data) ? kitsRes.data : [];
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Brand kits</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Reusable themes — export/import JSON, or apply to many tenants at once.
        </p>
      </div>
      <BrandKitsClient
        initialKits={
          kits as Array<{
            id: string;
            name: string;
            description: string | null;
            isStarter: boolean;
            payload: { primaryHex?: string; accentHex?: string; sidebarStyle?: string };
          }>
        }
        tenants={(tenants ?? []).map((t) => ({
          id: t.id,
          name: t.name,
          slug: t.slug,
        }))}
      />
    </div>
  );
}
