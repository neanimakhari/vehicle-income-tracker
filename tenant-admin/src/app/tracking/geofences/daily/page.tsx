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
  const raw = policy?.entitlements ?? policy?.featureFlags ?? null;
  const entitled = raw == null ? null : new Set(raw);
  const has = entitled == null || entitled.has("tracking_geofence");
  if (!has) {
    return (
      <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h1 className="text-xl font-semibold">Geofence daily</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Module <code>tracking_geofence</code> is not entitled.
        </p>
      </div>
    );
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
