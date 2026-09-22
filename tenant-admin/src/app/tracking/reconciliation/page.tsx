import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../lib/api";
import { TrackingShell } from "@/components/section-tabs";
import { TrackingReconcileClient } from "./reconcile-client";

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
  const entitlementsRaw = policy?.entitlements ?? policy?.featureFlags ?? null;
  const entitled = entitlementsRaw == null ? null : new Set(entitlementsRaw);
  const showAlerts = entitled == null || entitled.has("tracking_alerts");

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
