import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../lib/api";
import { TrackingShell } from "@/components/section-tabs";
import { TripsReportClient } from "./trips-client";

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
  const entitlementsRaw = policy?.entitlements ?? policy?.featureFlags ?? null;
  const entitled = entitlementsRaw == null ? null : new Set(entitlementsRaw);
  const hasLive = entitled == null || entitled.has("tracking_live");
  const showAlerts = entitled == null || entitled.has("tracking_alerts");

  const data = hasLive
    ? await fetchJson<{ vehicles?: Array<Record<string, unknown>> }>(
        `/tenant/tracking/trips-report?day=${day}`,
        { tolerate401: true },
      )
    : null;

  if (!hasLive) {
    return (
      <div className="rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <h1 className="text-xl font-semibold">Trips & parking</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Requires the <code>tracking_live</code> module.
        </p>
      </div>
    );
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
