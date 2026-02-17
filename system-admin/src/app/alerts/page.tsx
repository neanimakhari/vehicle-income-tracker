import { requireAuth } from "@/lib/auth";
import { fetchJson } from "@/lib/api";
import { AlertsClient } from "./AlertsClient";

type AlertItem = {
  type: string;
  at: string;
  message: string;
  metadata?: Record<string, unknown>;
};

async function fetchAlerts(): Promise<AlertItem[]> {
  const data = await fetchJson<{ alerts?: AlertItem[] }>("/platform/alerts");
  return data?.alerts ?? [];
}

export default async function AlertsPage() {
  await requireAuth();
  const alerts = await fetchAlerts();

  return <AlertsClient alerts={alerts} />;
}
