import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../lib/api";
import { TransportClient } from "./TransportClient";
import { entitlementList, hasModule } from "@/lib/entitlements";
import { ModuleLocked } from "@/components/module-locked";

export default async function TransportPage() {
  await requireAuth();
  const policy = await fetchJson<{
    entitlements?: string[];
    featureFlags?: string[];
  }>("/tenant/policy");
  if (!hasModule(entitlementList(policy), "scholar_payments")) {
    return <ModuleLocked title="Scholar & Staff" moduleKey="scholar_payments" />;
  }

  const vehicles =
    (await fetchJson<
      Array<{
        id: string;
        label: string;
        registrationNumber: string;
        seatCapacity?: number | null;
      }>
    >("/tenant/vehicles")) ?? [];

  return <TransportClient initialVehicles={vehicles} />;
}
