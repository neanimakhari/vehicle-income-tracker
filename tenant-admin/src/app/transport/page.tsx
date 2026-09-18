import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../lib/api";
import { TransportClient } from "./TransportClient";

export default async function TransportPage() {
  await requireAuth();
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
