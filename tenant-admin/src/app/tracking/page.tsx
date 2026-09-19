import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../lib/api";
import { TrackingClient } from "./tracking-client";

type TrackingPoint = {
  id: string;
  vehicleId?: string | null;
  vehicleLabel: string | null;
  latitude: number;
  longitude: number;
  speedKph: number | null;
  heading: number | null;
  recordedAt: string;
  engineRpm?: number | null;
  fuelRateLph?: number | null;
  externalVoltage?: number | null;
};

type VehicleRow = { id: string; label: string; trackerImei?: string | null };
type DeviceRow = {
  id: string;
  imei: string;
  vehicleId: string;
  isActive: boolean;
  lastSeenAt: string | null;
};

export default async function TrackingPage() {
  await requireAuth();

  const policy = await fetchJson<{
    tenantSlug?: string;
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");

  const entitlementsRaw = policy?.entitlements ?? policy?.featureFlags ?? null;
  const tenantSlug = policy?.tenantSlug ?? "";
  const entitled = entitlementsRaw == null ? null : new Set(entitlementsRaw);
  const hasLive = entitled == null || entitled.has("tracking_live");
  const hasHistory = entitled == null || entitled.has("tracking_history");

  const [latest, history, vehicles, devices] = await Promise.all([
    hasLive
      ? fetchJson<TrackingPoint[]>("/tenant/tracking/latest")
      : Promise.resolve([] as TrackingPoint[]),
    hasLive && hasHistory
      ? fetchJson<TrackingPoint[]>("/tenant/tracking/history?limit=100")
      : Promise.resolve([] as TrackingPoint[]),
    fetchJson<VehicleRow[]>("/tenant/vehicles"),
    hasLive
      ? fetchJson<DeviceRow[]>("/tenant/tracking/devices")
      : Promise.resolve([] as DeviceRow[]),
  ]);

  return (
    <TrackingClient
      initialHistory={history ?? []}
      initialLatest={latest ?? []}
      tenantSlug={tenantSlug}
      entitlements={entitlementsRaw}
      vehicles={vehicles ?? []}
      devices={devices ?? []}
    />
  );
}
