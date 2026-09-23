import { ModuleLocked } from "@/components/module-locked";
import { hasModule, entitlementList } from "@/lib/entitlements";
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
  const entitlementsRaw = entitlementList(policy);
  const hasLive = hasModule(entitlementsRaw, "tracking_live");
  const includeObd = hasModule(entitlementsRaw, "tracking_obd");
  const showAlerts = hasModule(entitlementsRaw, "tracking_alerts");

  const data = hasLive
    ? await fetchJson<{
        includeObd?: boolean;
        vehicles?: Array<Record<string, unknown>>;
      }>(`/tenant/tracking/analytics?from=${day}&to=${day}`, {
        tolerate401: true,
      })
    : null;

  if (!hasLive) {
    return <ModuleLocked title="Tracker analytics" moduleKey="tracking_live" />;
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
