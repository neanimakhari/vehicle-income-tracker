import { hasModule, entitlementList } from "@/lib/entitlements";
import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../lib/api";
import { TrackingShell } from "@/components/section-tabs";
import { TrackingClient } from "./tracking-client";
import { ModuleLocked } from "@/components/module-locked";

type TrackingPoint = {
  id: string;
  vehicleId?: string | null;
  vehicleLabel: string | null;
  latitude: number;
  longitude: number;
  speedKph: number | null;
  heading: number | null;
  recordedAt: string;
  ignitionOn?: boolean | null;
  gpsFixOk?: boolean | null;
  satellites?: number | null;
  engineRpm?: number | null;
  fuelRateLph?: number | null;
  fuelLevelPercent?: number | null;
  externalVoltage?: number | null;
  backupBatteryLevel?: number | null;
  odometerKm?: number | null;
  coolantC?: number | null;
  engineLoadPercent?: number | null;
  overspeed?: boolean | null;
};

type VehicleRow = { id: string; label: string; trackerImei?: string | null };
type DeviceRow = {
  id: string;
  imei: string;
  vehicleId: string;
  isActive: boolean;
  lastSeenAt: string | null;
};

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAuth();
  const sp = await searchParams;
  const pick = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };
  const vehicleId = pick("vehicleId");
  const from = pick("from");
  const to = pick("to");
  const day = pick("day");
  const modeParam = pick("mode");
  const initialMode =
    modeParam === "playback" || from || day ? "playback" : "live";

  const policy = await fetchJson<{
    tenantSlug?: string;
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");

  const entitlementsRaw = entitlementList(policy);
  const tenantSlug = policy?.tenantSlug ?? "";
  const hasLive = hasModule(entitlementsRaw, "tracking_live");
  const showAlerts = hasModule(entitlementsRaw, "tracking_alerts");

  if (!hasLive) {
    return <ModuleLocked title="Live Tracking" moduleKey="tracking_live" />;
  }

  const [latest, vehicles, devices] = await Promise.all([
    fetchJson<TrackingPoint[]>("/tenant/tracking/latest"),
    fetchJson<VehicleRow[]>("/tenant/vehicles"),
    fetchJson<DeviceRow[]>("/tenant/tracking/devices"),
  ]);

  return (
    <TrackingShell showAlerts={showAlerts}>
      <TrackingClient
        initialLatest={latest ?? []}
        tenantSlug={tenantSlug}
        entitlements={entitlementsRaw}
        vehicles={vehicles ?? []}
        devices={devices ?? []}
        initialMode={initialMode}
        initialDay={day}
        initialFrom={from}
        initialTo={to}
        initialVehicleId={vehicleId}
      />
    </TrackingShell>
  );
}
