import { ModuleLocked } from "@/components/module-locked";
import { hasModule, entitlementList } from "@/lib/entitlements";
import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../lib/api";
import { TrackingShell } from "@/components/section-tabs";
import { AlertsClient } from "./alerts-client";

export default async function TrackingAlertsPage() {
  await requireAuth();
  const policy = await fetchJson<{
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");
  const raw = entitlementList(policy);
  const has = hasModule(raw, "tracking_alerts");
  if (!has) {
    return <ModuleLocked title="Tracking alerts" moduleKey="tracking_alerts" />;
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
    <TrackingShell showAlerts>
      <AlertsClient
        initialRules={(rules as never) ?? []}
        initialFires={(fires as never) ?? []}
        initialEvents={(events as never) ?? []}
      />
    </TrackingShell>
  );
}
