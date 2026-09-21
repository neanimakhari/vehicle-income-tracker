import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../lib/api";
import { AlertsClient } from "./alerts-client";

export default async function TrackingAlertsPage() {
  await requireAuth();
  const policy = await fetchJson<{
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");
  const raw = policy?.entitlements ?? policy?.featureFlags ?? null;
  const entitled = raw == null ? null : new Set(raw);
  const has = entitled == null || entitled.has("tracking_alerts");
  if (!has) {
    return (
      <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h1 className="text-xl font-semibold">Tracking alerts</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Module <code>tracking_alerts</code> is not entitled.
        </p>
      </div>
    );
  }
  const [rules, fires, events] = await Promise.all([
    fetchJson<unknown[]>("/tenant/tracking/alert-rules", { tolerate401: true }),
    fetchJson<unknown[]>("/tenant/tracking/alert-rules/fires/recent", {
      tolerate401: true,
    }),
    fetchJson<unknown[]>("/tenant/tracking/events?limit=40", {
      tolerate401: true,
    }),
  ]);
  return (
    <AlertsClient
      initialRules={(rules as never) ?? []}
      initialFires={(fires as never) ?? []}
      initialEvents={(events as never) ?? []}
    />
  );
}
