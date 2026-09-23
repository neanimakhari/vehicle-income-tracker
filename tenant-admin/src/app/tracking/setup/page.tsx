import { hasModule, entitlementList } from "@/lib/entitlements";
import { Suspense } from "react";
import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../lib/api";
import { TrackingShell } from "@/components/section-tabs";
import { TrackerSetupClient } from "./setup-client";
import { ModuleLocked } from "@/components/module-locked";

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
  const entitlementsRaw = entitlementList(policy);
  const hasLive = hasModule(entitlementsRaw, "tracking_live");
  const showAlerts = hasModule(entitlementsRaw, "tracking_alerts");

  if (!hasLive) {
    return <ModuleLocked title="Set up tracker" moduleKey="tracking_live" />;
  }

  const vehicles =
    (await fetchJson<VehicleRow[]>("/tenant/vehicles")) ?? [];

  return (
    <TrackingShell showAlerts={showAlerts}>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading setup…</p>}>
        <TrackerSetupClient
          vehicles={vehicles}
          initialVehicleId={vehicleId}
        />
      </Suspense>
    </TrackingShell>
  );
}
