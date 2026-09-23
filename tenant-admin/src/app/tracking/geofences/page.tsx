import { ModuleLocked } from "@/components/module-locked";
import { hasModule, entitlementList } from "@/lib/entitlements";
import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../lib/api";
import { GeofenceShell } from "@/components/section-tabs";
import { GeofencesClient } from "./geofences-client";

export default async function GeofencesPage() {
  await requireAuth();
  const policy = await fetchJson<{
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");
  const raw = entitlementList(policy);
  const has = hasModule(raw, "tracking_geofence");

  if (!has) {
    return <ModuleLocked title="Geofences" moduleKey="tracking_geofence" />;
  }

  const [fences, vehicles, templates] = await Promise.all([
    fetchJson<unknown[]>("/tenant/tracking/geofences", { tolerate401: true }),
    fetchJson<Array<{ id: string; label: string }>>("/tenant/vehicles", {
      tolerate401: true,
    }),
    fetchJson<unknown[]>("/tenant/tracking/geofences/templates", {
      tolerate401: true,
    }),
  ]);

  return (
    <GeofenceShell>
      <GeofencesClient
        initial={(fences as never) ?? []}
        initialTemplates={(templates as never) ?? []}
        vehicles={vehicles ?? []}
      />
    </GeofenceShell>
  );
}
