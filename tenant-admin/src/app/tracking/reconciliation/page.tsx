import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../lib/api";
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

  const data = await fetchJson<{
    vehicles?: Array<Record<string, unknown>>;
  }>(`/tenant/tracking/reconciliation?from=${day}&to=${day}`, {
    tolerate401: true,
  });

  return (
    <TrackingReconcileClient
      initialDay={day}
      initial={(data?.vehicles ?? []) as never}
    />
  );
}
