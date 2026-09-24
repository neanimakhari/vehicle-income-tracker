"use client";

import { useIncidentLiveRefresh } from "@/components/notification-live";

/** Subscribes to panic WebSocket events and refreshes the SSR incidents list. */
export function IncidentsLiveRefresh() {
  useIncidentLiveRefresh();
  return null;
}
