import { hasModule, entitlementList } from "@/lib/entitlements";
import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../lib/api";
import { TrackingShell } from "@/components/section-tabs";
import { TrackingReconcileClient } from "./reconcile-client";
import { ModuleLocked } from "@/components/module-locked";

function todayJhb(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function TrackingReconciliationPage() {
  await requireAuth();
  const day = todayJhb();

  const policy = await fetchJson<{
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");
  const entitlementsRaw = entitlementList(policy);
  const hasLive = hasModule(entitlementsRaw, "tracking_live");
  const showAlerts = hasModule(entitlementsRaw, "tracking_alerts");

  if (!hasLive) {
    return <ModuleLocked title="Reconciliation" moduleKey="tracking_live" />;
  }

  const data = await fetchJson<{
    vehicles?: Array<Record<string, unknown>>;
  }>(`/tenant/tracking/reconciliation?from=${day}&to=${day}`, {
    tolerate401: true,
  });

  return (
    <TrackingShell showAlerts={showAlerts}>
      <TrackingReconcileClient
        initialDay={day}
        initial={(data?.vehicles ?? []) as never}
      />
    </TrackingShell>
  );
}
