import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../lib/api";
import { TrackingClient } from "./tracking-client";

type TrackingPoint = {
  id: string;
  vehicleLabel: string | null;
  latitude: number;
  longitude: number;
  speedKph: number | null;
  heading: number | null;
  recordedAt: string;
};

async function fetchTrackingHistory() {
  const rows = await fetchJson<TrackingPoint[]>("/tenant/tracking/history?limit=100");
  return rows ?? [];
}

async function fetchTrackingLatest() {
  const rows = await fetchJson<TrackingPoint[]>("/tenant/tracking/latest");
  return rows ?? [];
}

async function fetchTenantSlug() {
  const policy = await fetchJson<{ tenantSlug?: string }>("/tenant/policy");
  return policy?.tenantSlug ?? "";
}

export default async function TrackingPage() {
  await requireAuth();
  const [history, latest, tenantSlug] = await Promise.all([
    fetchTrackingHistory(),
    fetchTrackingLatest(),
    fetchTenantSlug(),
  ]);

  return <TrackingClient initialHistory={history} initialLatest={latest} tenantSlug={tenantSlug} />;
}

