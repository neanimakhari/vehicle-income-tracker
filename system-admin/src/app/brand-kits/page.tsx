import { brandListKits } from "@/app/tenants/brand-actions";
import { BrandKitsClient } from "./BrandKitsClient";

export default async function BrandKitsPage() {
  const res = await brandListKits();
  const kits = res.ok && Array.isArray(res.data) ? res.data : [];
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Brand kits</h1>
        <p className="text-sm text-zinc-500 mt-1">
          Reusable themes you can apply to any tenant from the Brand tab.
        </p>
      </div>
      <BrandKitsClient initialKits={kits as Array<{
        id: string;
        name: string;
        description: string | null;
        isStarter: boolean;
        payload: { primaryHex?: string; accentHex?: string; sidebarStyle?: string };
      }>} />
    </div>
  );
}
