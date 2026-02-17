import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { Wrench, AlertTriangle } from "lucide-react";
import { CreateMaintenanceTaskModal } from "@/components/create-maintenance-task-modal";
import { MaintenanceTableClient } from "./maintenance-table-client";

async function fetchMaintenanceTasks() {
  const tasks = await fetchJson<Array<{
    id: string;
    vehicleLabel: string;
    registrationNumber?: string;
    maintenanceType?: string;
    dueKm?: number;
    dueDate?: string;
    lastServiceKm?: number;
    lastServiceDate?: string;
    serviceIntervalKm?: number;
    serviceIntervalDays?: number;
    cost?: number;
    notes?: string;
    isCompleted: boolean;
    completedAt?: string;
    completedKm?: number;
    currentKm?: number;
    lastIncomeDate?: string;
    kmRemaining?: number;
    daysRemaining?: number;
    kmSinceLastService?: number;
    daysSinceLastService?: number;
    status: 'ok' | 'due_soon' | 'overdue';
  }>>("/tenant/maintenance");
  return tasks ?? [];
}

async function fetchVehicles() {
  const vehicles = await fetchJson<Array<{ id: string; label: string; registrationNumber: string }>>("/tenant/vehicles");
  return vehicles ?? [];
}

export default async function MaintenancePage() {
  await requireAuth();
  const tasks = await fetchMaintenanceTasks();
  const vehicles = await fetchVehicles();

  async function createTask(formData: FormData): Promise<{ success: boolean; error?: string }> {
    "use server";
    const vehicleLabel = String(formData.get("vehicleLabel") ?? "").trim();
    const registrationNumber = String(formData.get("registrationNumber") ?? "").trim();
    const maintenanceType = String(formData.get("maintenanceType") ?? "other");
    const dueKm = formData.get("dueKm") ? parseInt(String(formData.get("dueKm")), 10) : null;
    const dueDate = formData.get("dueDate") ? String(formData.get("dueDate")) : null;
    const lastServiceKm = formData.get("lastServiceKm") ? parseInt(String(formData.get("lastServiceKm")), 10) : null;
    const lastServiceDate = formData.get("lastServiceDate") ? String(formData.get("lastServiceDate")) : null;
    const serviceIntervalKm = formData.get("serviceIntervalKm") ? parseInt(String(formData.get("serviceIntervalKm")), 10) : null;
    const serviceIntervalDays = formData.get("serviceIntervalDays") ? parseInt(String(formData.get("serviceIntervalDays")), 10) : null;
    const cost = formData.get("cost") ? parseFloat(String(formData.get("cost"))) : null;
    const notes = String(formData.get("notes") ?? "").trim();

    if (!vehicleLabel) {
      return { success: false, error: "Vehicle is required" };
    }
    try {
      const res = await fetch(`${getApiUrl()}/tenant/maintenance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          vehicleLabel,
          registrationNumber: registrationNumber || null,
          maintenanceType,
          dueKm,
          dueDate,
          lastServiceKm,
          lastServiceDate,
          serviceIntervalKm,
          serviceIntervalDays,
          cost,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        return { success: false, error: err.message ?? "Failed to create task" };
      }
      revalidatePath("/maintenance");
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Request failed" };
    }
  }

  async function updateTask(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const isCompleted = String(formData.get("isCompleted") ?? "false") === "true";
    const completedKm = formData.get("completedKm") ? parseInt(String(formData.get("completedKm"))) : null;

    if (!id) {
      return;
    }

    await fetch(`${getApiUrl()}/tenant/maintenance/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ 
        isCompleted: !isCompleted,
        completedKm: !isCompleted ? null : (completedKm ?? undefined),
      }),
    });
    revalidatePath("/maintenance");
  }

  async function deleteTask(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) {
      return;
    }
    // Note: API might not have DELETE endpoint, using PATCH to mark as completed
    await fetch(`${getApiUrl()}/tenant/maintenance/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ isCompleted: true }),
    });
    revalidatePath("/maintenance");
  }

  const overdueTasks = tasks.filter(t => t.status === 'overdue' && !t.isCompleted);
  const dueSoonTasks = tasks.filter(t => t.status === 'due_soon' && !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);
  const pendingTasks = tasks.filter(t => !t.isCompleted);

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg">
              <Wrench className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">Maintenance</h1>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Track and manage vehicle maintenance tasks
              </p>
            </div>
          </div>
        </div>
        <div className="mt-4 sm:mt-0">
          <CreateMaintenanceTaskModal vehicles={vehicles} createTask={createTask} />
        </div>
      </div>

      {/* Alerts */}
      {overdueTasks.length > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span><strong>{overdueTasks.length}</strong> maintenance task(s) are overdue.</span>
        </div>
      )}

      {dueSoonTasks.length > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-100">
          <AlertTriangle className="h-5 w-5 flex-shrink-0" />
          <span><strong>{dueSoonTasks.length}</strong> maintenance task(s) are due soon.</span>
        </div>
      )}

      <MaintenanceTableClient tasks={tasks} updateTask={updateTask} deleteTask={deleteTask} />
    </div>
  );
}

