import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../lib/api";
import { GeofencesClient } from "./geofences-client";

export default async function GeofencesPage() {
  await requireAuth();
  const policy = await fetchJson<{
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");
  const raw = policy?.entitlements ?? policy?.featureFlags ?? null;
  const entitled = raw == null ? null : new Set(raw);
  const has =
    entitled == null || entitled.has("tracking_geofence");

  if (!has) {
    return (
      <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h1 className="text-xl font-semibold">Geofences</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Module <code>tracking_geofence</code> is not entitled for this tenant.
        </p>
      </div>
    );
  }

  const [fences, vehicles] = await Promise.all([
    fetchJson<unknown[]>("/tenant/tracking/geofences", { tolerate401: true }),
    fetchJson<Array<{ id: string; label: string }>>("/tenant/vehicles", {
      tolerate401: true,
    }),
  ]);

  return (
    <GeofencesClient
      initial={(fences as never) ?? []}
      vehicles={vehicles ?? []}
    />
  );
}
