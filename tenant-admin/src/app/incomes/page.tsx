import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { IncomesClient } from "./IncomesClient";

function toNum(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isNaN(n) ? undefined : n;
}

function parseJsonLogs(formData: FormData, key: string): Array<Record<string, unknown>> {
  const raw = String(formData.get(key) ?? "").trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<Record<string, unknown>>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function fetchIncomes() {
  const raw = await fetchJson<Array<Record<string, unknown>>>("/tenant/incomes");
  const list = Array.isArray(raw) ? raw : [];
  return list.map((row) => ({
    id: String(row.id ?? ""),
    vehicle: String(row.vehicle ?? ""),
    driverName: String(row.driverName ?? ""),
    driverId: row.driverId != null ? String(row.driverId) : undefined,
    income: toNum(row.income) ?? 0,
    startingKm: toNum(row.startingKm),
    endKm: toNum(row.endKm),
    petrolPoured: toNum(row.petrolPoured),
    petrolLitres: toNum(row.petrolLitres),
    expenseDetail: row.expenseDetail != null ? String(row.expenseDetail) : undefined,
    expensePrice: toNum(row.expensePrice),
    expenseImage: (row.expenseImage ?? row.expense_image) != null ? String(row.expenseImage ?? row.expense_image) : undefined,
    petrolSlip: (row.petrolSlip ?? row.petrol_slip) != null ? String(row.petrolSlip ?? row.petrol_slip) : undefined,
    loggedOn: String(row.loggedOn ?? new Date().toISOString()),
    approvalStatus: String(row.approvalStatus ?? row.approval_status ?? "auto"),
    approvedAt: row.approvedAt != null ? String(row.approvedAt) : row.approved_at != null ? String(row.approved_at) : undefined,
    approvedBy: row.approvedBy != null ? String(row.approvedBy) : row.approved_by != null ? String(row.approved_by) : undefined,
    incomeStream: row.incomeStream != null ? String(row.incomeStream) : "general",
    tripId: row.tripId != null ? String(row.tripId) : undefined,
    scholarPaymentId: row.scholarPaymentId != null ? String(row.scholarPaymentId) : undefined,
  }));
}

async function fetchDrivers() {
  const drivers = await fetchJson<
    Array<{ id: string; firstName: string; lastName: string; email: string; isActive: boolean }>
  >("/tenant/users");
  return drivers ?? [];
}

async function fetchVehicles() {
  const vehicles = await fetchJson<
    Array<{ id: string; label: string; registrationNumber: string }>
  >("/tenant/vehicles");
  return vehicles ?? [];
}

async function fetchMissingVehicles() {
  const data = await fetchJson<{ vehicles?: Array<{ id: string; label: string }>; missingCount?: number }>(
    "/tenant/incomes/missing-vehicles",
  );
  const vehicles = Array.isArray(data?.vehicles) ? data.vehicles : [];
  return vehicles.map((v) => v.label);
}

async function fetchTrips() {
  const trips = await fetchJson<Array<{ id: string; tripType: string; status: string }>>("/tenant/trips");
  return trips ?? [];
}

async function fetchScholarPayments() {
  const items = await fetchJson<
    Array<{ id: string; passengerId: string; status: string; amount: number }>
  >("/tenant/transport/payments?status=approved");
  const passengers = await fetchJson<Array<{ id: string; name: string }>>(
    "/tenant/transport/passengers?activeOnly=false",
  );
  const names = new Map((passengers ?? []).map((p) => [p.id, p.name]));
  return (items ?? []).map((row) => ({
    id: row.id,
    scholarName: `${names.get(row.passengerId) ?? "Passenger"} (R ${Number(row.amount).toFixed(2)})`,
    status: row.status,
  }));
}

export default async function IncomesPage() {
  await requireAuth();
  const [incomes, drivers, vehicles, missingVehicleLabels, trips, scholarPayments] = await Promise.all([
    fetchIncomes(),
    fetchDrivers(),
    fetchVehicles(),
    fetchMissingVehicles(),
    fetchTrips(),
    fetchScholarPayments(),
  ]);

  async function createIncome(formData: FormData): Promise<{ success: boolean; error?: string }> {
    "use server";
    const vehicle = String(formData.get("vehicle") ?? "");
    const driverId = String(formData.get("driverId") ?? "");
    const income = Number(formData.get("income") ?? 0);
    const startingKm = formData.get("startingKm") ? Number(formData.get("startingKm")) : null;
    const endKm = formData.get("endKm") ? Number(formData.get("endKm")) : null;
    const petrolPoured = formData.get("petrolPoured") ? Number(formData.get("petrolPoured")) : null;
    const petrolLitres = formData.get("petrolLitres") ? Number(formData.get("petrolLitres")) : null;
    const expenseDetail = String(formData.get("expenseDetail") ?? "");
    const expensePrice = formData.get("expensePrice") ? Number(formData.get("expensePrice")) : null;
    const loggedOn = String(formData.get("loggedOn") ?? new Date().toISOString());
    const incomeLogs = parseJsonLogs(formData, "incomeLogs");
    const petrolLogs = parseJsonLogs(formData, "petrolLogs");
    const expenseLogs = parseJsonLogs(formData, "expenseLogs");
    const incomeStream = String(formData.get("incomeStream") ?? "general");
    const tripId = String(formData.get("tripId") ?? "");
    const scholarPaymentId = String(formData.get("scholarPaymentId") ?? "");

    if (!vehicle || !driverId || !income) {
      return { success: false, error: "Vehicle, driver and income are required" };
    }
    try {
      const res = await fetch(`${getApiUrl()}/tenant/incomes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          vehicle,
          driverId,
          income,
          startingKm,
          endKm,
          petrolPoured,
          petrolLitres,
          expenseDetail: expenseDetail || null,
          expensePrice,
          incomeLogs,
          petrolLogs,
          expenseLogs,
          incomeStream,
          tripId: tripId || null,
          scholarPaymentId: scholarPaymentId || null,
          loggedOn,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        return { success: false, error: err.message ?? "Failed to create income" };
      }
      revalidatePath("/incomes");
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Request failed" };
    }
  }

  async function updateIncome(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    const vehicle = String(formData.get("vehicle") ?? "");
    const driverId = String(formData.get("driverId") ?? "");
    const income = Number(formData.get("income") ?? 0);
    const startingKm = formData.get("startingKm") ? Number(formData.get("startingKm")) : null;
    const endKm = formData.get("endKm") ? Number(formData.get("endKm")) : null;
    const petrolPoured = formData.get("petrolPoured") ? Number(formData.get("petrolPoured")) : null;
    const petrolLitres = formData.get("petrolLitres") ? Number(formData.get("petrolLitres")) : null;
    const expenseDetail = String(formData.get("expenseDetail") ?? "");
    const expensePrice = formData.get("expensePrice") ? Number(formData.get("expensePrice")) : null;
    const loggedOn = String(formData.get("loggedOn") ?? "");
    const incomeLogs = parseJsonLogs(formData, "incomeLogs");
    const petrolLogs = parseJsonLogs(formData, "petrolLogs");
    const expenseLogs = parseJsonLogs(formData, "expenseLogs");
    const incomeStream = String(formData.get("incomeStream") ?? "general");
    const tripId = String(formData.get("tripId") ?? "");
    const scholarPaymentId = String(formData.get("scholarPaymentId") ?? "");

    if (!id || !vehicle || !driverId || !income) {
      redirect("/incomes?error=" + encodeURIComponent("Required fields missing"));
    }
    try {
      const res = await fetch(`${getApiUrl()}/tenant/incomes/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({
          vehicle,
          driverId,
          income,
          startingKm,
          endKm,
          petrolPoured,
          petrolLitres,
          expenseDetail: expenseDetail || null,
          expensePrice,
          incomeLogs,
          petrolLogs,
          expenseLogs,
          incomeStream,
          tripId: tripId || null,
          scholarPaymentId: scholarPaymentId || null,
          loggedOn,
        }),
      });
      revalidatePath("/incomes");
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        redirect("/incomes?error=" + encodeURIComponent(err.message ?? "Failed to update income"));
      }
      redirect("/incomes?success=" + encodeURIComponent("Income updated"));
    } catch (e) {
      console.error(e);
      redirect("/incomes?error=" + encodeURIComponent("Request failed"));
    }
  }

  async function deleteIncome(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    try {
      const res = await fetch(`${getApiUrl()}/tenant/incomes/${id}`, {
        method: "DELETE",
        headers: { ...(await getAuthHeaders()) },
      });
      revalidatePath("/incomes");
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { message?: string };
        redirect("/incomes?error=" + encodeURIComponent(err.message ?? "Failed to delete income"));
      }
      redirect("/incomes?success=" + encodeURIComponent("Income deleted"));
    } catch (e) {
      console.error(e);
      redirect("/incomes?error=" + encodeURIComponent("Request failed"));
    }
  }

  async function approveIncome(
    id: string,
    reason?: string | null,
  ): Promise<{ success: boolean; error?: string }> {
    "use server";
    if (!id) return { success: false, error: "Invalid id" };
    try {
      const res = await fetch(`${getApiUrl()}/tenant/incomes/${id}/approve`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ reason: reason?.trim() || null }),
      });
      revalidatePath("/incomes");
      revalidatePath(`/incomes/${id}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(err.message) ? err.message.join(" ") : err.message;
        return { success: false, error: msg ?? "Failed to approve" };
      }
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Request failed" };
    }
  }

  async function rejectIncome(
    id: string,
    reason: string,
  ): Promise<{ success: boolean; error?: string }> {
    "use server";
    if (!id) return { success: false, error: "Invalid id" };
    const trimmed = reason?.trim() || "";
    if (!trimmed) return { success: false, error: "A reject reason is required" };
    try {
      const res = await fetch(`${getApiUrl()}/tenant/incomes/${id}/reject`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ reason: trimmed }),
      });
      revalidatePath("/incomes");
      revalidatePath(`/incomes/${id}`);
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { message?: string | string[] };
        const msg = Array.isArray(err.message) ? err.message.join(" ") : err.message;
        return { success: false, error: msg ?? "Failed to reject" };
      }
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, error: "Request failed" };
    }
  }

  return (
    <IncomesClient
      incomes={incomes}
      drivers={drivers}
      vehicles={vehicles}
      trips={trips}
      scholarPayments={scholarPayments}
      missingVehicleLabels={missingVehicleLabels}
      createIncome={createIncome}
      updateIncome={updateIncome}
      deleteIncome={deleteIncome}
      approveIncome={approveIncome}
      rejectIncome={rejectIncome}
    />
  );
}

