import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { Car } from "lucide-react";
import { CreateVehicleModal } from "@/components/create-vehicle-modal";
import { VehiclesTable } from "@/components/vehicles-table";

type DeviceRow = {
  id: string;
  imei: string;
  vehicleId: string;
  isActive: boolean;
  lastSeenAt: string | null;
};

type LatestPoint = {
  vehicleId?: string | null;
  recordedAt?: string | null;
};

async function fetchVehicles() {
  const vehicles = await fetchJson<
    Array<{
      id: string;
      label: string;
      registrationNumber: string;
      isActive: boolean;
      trackerImei?: string | null;
    }>
  >("/tenant/vehicles");
  return vehicles ?? [];
}

async function fetchMissingVehicles() {
  const missing = await fetchJson<{ vehicles?: Array<{ id: string }>; missingCount?: number }>(
    "/tenant/incomes/missing-vehicles",
  );
  const vehicles = Array.isArray(missing?.vehicles) ? missing.vehicles : [];
  return new Set(vehicles.map((v) => v.id));
}

async function fetchGpsContext() {
  const [devices, settings, latest] = await Promise.all([
    fetchJson<DeviceRow[]>("/tenant/tracking/devices", { tolerate401: true }),
    fetchJson<{ offlineMinutes?: number }>(
      "/tenant/tracking/geofences/settings",
      { tolerate401: true },
    ),
    fetchJson<LatestPoint[]>("/tenant/tracking/latest", { tolerate401: true }),
  ]);
  const lastPointAtByVehicle: Record<string, string> = {};
  if (Array.isArray(latest)) {
    for (const p of latest) {
      if (p?.vehicleId && p.recordedAt) {
        lastPointAtByVehicle[p.vehicleId] = String(p.recordedAt);
      }
    }
  }
  return {
    devices: Array.isArray(devices) ? devices : [],
    offlineMinutes:
      settings?.offlineMinutes != null && Number.isFinite(Number(settings.offlineMinutes))
        ? Number(settings.offlineMinutes)
        : 15,
    lastPointAtByVehicle,
  };
}

export default async function VehiclesPage() {
  await requireAuth();
  const [vehicles, missingVehicleIds, gps] = await Promise.all([
    fetchVehicles(),
    fetchMissingVehicles(),
    fetchGpsContext(),
  ]);

  async function createVehicle(formData: FormData): Promise<{ success?: boolean; error?: string }> {
    "use server";
    const label = String(formData.get("label") ?? "").trim();
    const registrationNumber = String(formData.get("registrationNumber") ?? "").trim();
    if (!label || !registrationNumber) {
      return { error: "Label and registration number are required." };
    }
    try {
      const res = await fetch(`${getApiUrl()}/tenant/vehicles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ label, registrationNumber }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { message?: string | string[] };
        const msg = Array.isArray(body.message) ? body.message.join(" ") : (body.message ?? "Failed to add vehicle.");
        return { error: msg };
      }
      revalidatePath("/vehicles");
      return { success: true };
    } catch (e) {
      console.error("Create vehicle error:", e);
      return { error: "Could not add vehicle. Try again." };
    }
  }

  async function toggleVehicle(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const isActive = String(formData.get("isActive") ?? "true") === "true";
    if (!id) {
      return;
    }
    await fetch(`${getApiUrl()}/tenant/vehicles/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ isActive: !isActive }),
    });
    revalidatePath("/vehicles");
  }

  async function deleteVehicle(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) {
      return;
    }
    await fetch(`${getApiUrl()}/tenant/vehicles/${id}`, {
      method: "DELETE",
      headers: {
        ...(await getAuthHeaders()),
      },
    });
    revalidatePath("/vehicles");
  }

  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <div className="sm:flex-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg">
              <Car className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">Vehicles</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Manage tenant vehicles, registration, and GPS health
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <CreateVehicleModal createVehicle={createVehicle} />
        <a
          href="/tracking/setup"
          className="text-sm font-medium text-teal-700 underline-offset-2 hover:underline dark:text-teal-300"
        >
          Set up GPS tracker
        </a>
      </div>

      <VehiclesTable
        vehicles={vehicles}
        missingVehicleIds={Array.from(missingVehicleIds)}
        devices={gps.devices}
        offlineMinutes={gps.offlineMinutes}
        lastPointAtByVehicle={gps.lastPointAtByVehicle}
        onToggle={toggleVehicle}
        onDelete={deleteVehicle}
      />
    </div>
  );
}
