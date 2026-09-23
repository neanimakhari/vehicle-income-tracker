import { hasModule, entitlementList } from "@/lib/entitlements";
import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../lib/api";
import { TrackingShell } from "@/components/section-tabs";
import { TripsReportClient } from "./trips-client";
import { ModuleLocked } from "@/components/module-locked";

function todayJhb(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function TrackingTripsPage() {
  await requireAuth();
  const day = todayJhb();

  const policy = await fetchJson<{
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");
  const entitlementsRaw = entitlementList(policy);
  const hasLive = hasModule(entitlementsRaw, "tracking_live");
  const showAlerts = hasModule(entitlementsRaw, "tracking_alerts");

  const data = hasLive
    ? await fetchJson<{ vehicles?: Array<Record<string, unknown>> }>(
        `/tenant/tracking/trips-report?day=${day}`,
        { tolerate401: true },
      )
    : null;

  if (!hasLive) {
    return <ModuleLocked title="Trips & parking" moduleKey="tracking_live" />;
  }

  return (
    <TrackingShell showAlerts={showAlerts}>
      <TripsReportClient
        initialDay={day}
        initial={(data?.vehicles ?? []) as never}
      />
    </TrackingShell>
  );
}
