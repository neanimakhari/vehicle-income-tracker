import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../lib/api";
import { TrackingShell } from "@/components/section-tabs";
import { TrackingAnalyticsClient } from "./analytics-client";

function todayJhb(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function TrackingAnalyticsPage() {
  await requireAuth();
  const day = todayJhb();

  const policy = await fetchJson<{
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");
  const entitlementsRaw = policy?.entitlements ?? policy?.featureFlags ?? null;
  const entitled = entitlementsRaw == null ? null : new Set(entitlementsRaw);
  const hasLive = entitled == null || entitled.has("tracking_live");
  const includeObd = entitled == null || entitled.has("tracking_obd");
  const showAlerts = entitled == null || entitled.has("tracking_alerts");

  const data = hasLive
    ? await fetchJson<{
        includeObd?: boolean;
        vehicles?: Array<Record<string, unknown>>;
      }>(`/tenant/tracking/analytics?from=${day}&to=${day}`, {
        tolerate401: true,
      })
    : null;

  if (!hasLive) {
    return (
      <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h1 className="text-xl font-semibold">Tracker analytics</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Live tracking module is not entitled for this tenant.
        </p>
      </div>
    );
  }

  return (
    <TrackingShell showAlerts={showAlerts}>
      <TrackingAnalyticsClient
        initialDay={day}
        includeObd={includeObd || Boolean(data?.includeObd)}
        initial={(data?.vehicles ?? []) as never}
      />
    </TrackingShell>
  );
}
