import { ModuleLocked } from "@/components/module-locked";
import { hasModule, entitlementList } from "@/lib/entitlements";
import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../../lib/api";
import { GeofenceShell } from "@/components/section-tabs";
import { GeofenceDailyClient } from "./daily-client";

export default async function GeofenceDailyPage() {
  await requireAuth();
  const policy = await fetchJson<{
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");
  const raw = entitlementList(policy);
  const has = hasModule(raw, "tracking_geofence");
  if (!has) {
    return <ModuleLocked title="Geofence daily" moduleKey="tracking_geofence" />;
  }
  const today = new Date().toISOString().slice(0, 10);
  const data = await fetchJson<{ vehicles?: unknown[] }>(
    `/tenant/tracking/geofences/daily?from=${today}&to=${today}`,
    { tolerate401: true },
  );
  const rows = Array.isArray(data) ? data : (data?.vehicles ?? []);
  return (
    <GeofenceShell>
      <GeofenceDailyClient initial={(rows as never) ?? []} initialDay={today} />
    </GeofenceShell>
  );
}
