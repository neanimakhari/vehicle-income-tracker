import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../../../lib/api";
import { GeofenceEventsClient } from "./events-client";

export default async function GeofenceEventsPage() {
  await requireAuth();
  const events = await fetchJson<unknown[]>(
    "/tenant/tracking/geofences/events?limit=100",
    { tolerate401: true },
  );
  return <GeofenceEventsClient initial={(events as never) ?? []} />;
}
