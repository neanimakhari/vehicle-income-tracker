import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../lib/api";
import { TrackerSetupClient } from "./setup-client";

type VehicleRow = { id: string; label: string; trackerImei?: string | null };

export default async function TrackerSetupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuth();
  const sp = await searchParams;
  const vehicleId = Array.isArray(sp.vehicleId)
    ? sp.vehicleId[0]
    : sp.vehicleId;

  const policy = await fetchJson<{
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");
  const entitlementsRaw = policy?.entitlements ?? policy?.featureFlags ?? null;
  const entitled = entitlementsRaw == null ? null : new Set(entitlementsRaw);
  const hasLive = entitled == null || entitled.has("tracking_live");

  if (!hasLive) {
    return (
      <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h1 className="text-xl font-semibold">Set up tracker</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Requires the <code>tracking_live</code> module on your plan.
        </p>
      </div>
    );
  }

  const vehicles =
    (await fetchJson<VehicleRow[]>("/tenant/vehicles")) ?? [];

  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading setup…</p>}>
      <TrackerSetupClient
        vehicles={vehicles}
        initialVehicleId={vehicleId}
      />
    </Suspense>
  );
}
