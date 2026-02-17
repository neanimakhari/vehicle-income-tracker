import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { SessionsClient } from "./SessionsClient";

type Device = {
  id: string;
  userId: string;
  userRole: string;
  deviceId: string;
  deviceName: string | null;
  lastSeenAt: string | null;
  revokedAt: string | null;
  isTrusted: boolean;
  createdAt: string;
};

async function fetchDevices(): Promise<Device[]> {
  const list = await fetchJson<Device[]>("/tenant/devices");
  return Array.isArray(list) ? list : [];
}

export default async function SessionsPage() {
  await requireAuth();
  const devices = await fetchDevices();

  async function revokeDevice(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await fetch(`${getApiUrl()}/tenant/devices/${id}/revoke`, {
      method: "PATCH",
      headers: await getAuthHeaders(),
    });
    revalidatePath("/sessions");
  }

  async function revokeAllSessions() {
    "use server";
    await fetch(`${getApiUrl()}/tenant/devices/revoke-all`, {
      method: "POST",
      headers: await getAuthHeaders(),
    });
    revalidatePath("/sessions");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Sessions & devices</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          View active devices and revoke access (log out) for drivers or all sessions.
        </p>
      </div>
      <SessionsClient
        devices={devices}
        revokeDevice={revokeDevice}
        revokeAllSessions={revokeAllSessions}
      />
    </div>
  );
}
