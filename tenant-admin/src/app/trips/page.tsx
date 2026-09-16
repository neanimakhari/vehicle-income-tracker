import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "../../lib/api";
import { revalidatePath } from "next/cache";

async function fetchTrips() {
  const trips = await fetchJson<
    Array<{
      id: string;
      status: string;
      tripType: string;
      pickupLocation: string | null;
      dropoffLocation: string | null;
      fareAmount: number | null;
      scheduledAt: string | null;
      createdAt: string;
    }>
  >("/tenant/trips");
  return trips ?? [];
}

export default async function TripsPage() {
  await requireAuth();
  const trips = await fetchTrips();

  async function createTrip(formData: FormData) {
    "use server";
    const payload = {
      tripType: String(formData.get("tripType") ?? "general"),
      pickupLocation: String(formData.get("pickupLocation") ?? "") || null,
      dropoffLocation: String(formData.get("dropoffLocation") ?? "") || null,
      scheduledAt: String(formData.get("scheduledAt") ?? "") || null,
      fareAmount: Number(formData.get("fareAmount") ?? 0) || 0,
    };
    await fetch(`${getApiUrl()}/tenant/trips`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await getAuthHeaders()) },
      body: JSON.stringify(payload),
    });
    revalidatePath("/trips");
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Trips</h1>
      <div className="card p-4">
        <h2 className="mb-3 text-lg font-semibold">Create Trip</h2>
        <form action={createTrip} className="grid gap-3 md:grid-cols-2">
          <input name="tripType" placeholder="Trip type (general/scholar/etc)" className="input w-full px-3 py-2 text-sm" />
          <input name="scheduledAt" type="datetime-local" className="input w-full px-3 py-2 text-sm" />
          <input name="pickupLocation" placeholder="Pickup" className="input w-full px-3 py-2 text-sm" />
          <input name="dropoffLocation" placeholder="Dropoff" className="input w-full px-3 py-2 text-sm" />
          <input name="fareAmount" type="number" step="0.01" min="0" placeholder="Fare amount" className="input w-full px-3 py-2 text-sm" />
          <button className="btn btn-primary md:col-span-2 w-fit" type="submit">Create Trip</button>
        </form>
      </div>
      <div className="card p-4">
        <h2 className="mb-3 text-lg font-semibold">Recent Trips</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold">Type</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Route</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Status</th>
                <th className="px-3 py-2 text-left text-xs font-semibold">Fare</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {trips.map((trip) => (
                <tr key={trip.id}>
                  <td className="px-3 py-2 text-sm">{trip.tripType}</td>
                  <td className="px-3 py-2 text-sm">{trip.pickupLocation ?? "—"} {"->"} {trip.dropoffLocation ?? "—"}</td>
                  <td className="px-3 py-2 text-sm">{trip.status}</td>
                  <td className="px-3 py-2 text-sm">{trip.fareAmount != null ? `R ${Number(trip.fareAmount).toFixed(2)}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

