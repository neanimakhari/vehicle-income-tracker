import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "@/lib/api";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";

type Incident = {
  id: string;
  driverId: string;
  driverName: string | null;
  driverEmail: string | null;
  vehicle: string | null;
  lat: number | null;
  lng: number | null;
  note: string | null;
  status: "open" | "ack" | "closed";
  createdAt: string;
  ackedAt: string | null;
};

async function fetchIncidents(status?: string) {
  const q = status ? `?status=${encodeURIComponent(status)}` : "";
  try {
    return (await fetchJson<Incident[]>(`/tenant/incidents${q}`)) ?? [];
  } catch {
    return [];
  }
}

export default async function IncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; id?: string }>;
}) {
  await requireAuth();
  const sp = await searchParams;
  const status = sp.status;
  const highlightId = sp.id;
  const incidents = await fetchIncidents(
    status === "open" || status === "ack" || status === "closed" ? status : undefined,
  );

  async function ackIncident(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await fetch(`${getApiUrl()}/tenant/incidents/${id}/ack`, {
      method: "PATCH",
      headers: { ...(await getAuthHeaders()) },
    });
    revalidatePath("/incidents");
  }

  async function closeIncident(formData: FormData) {
    "use server";
    const id = String(formData.get("id") ?? "");
    if (!id) return;
    await fetch(`${getApiUrl()}/tenant/incidents/${id}/close`, {
      method: "PATCH",
      headers: { ...(await getAuthHeaders()) },
    });
    revalidatePath("/incidents");
  }

  const openCount = incidents.filter((i) => i.status === "open").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
          <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
          Incidents
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
          Driver panic alerts. Acknowledge so the fleet knows someone is on it.
          {openCount > 0 ? ` · ${openCount} open` : null}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {[
          { href: "/incidents", label: "All" },
          { href: "/incidents?status=open", label: "Open" },
          { href: "/incidents?status=ack", label: "Acknowledged" },
          { href: "/incidents?status=closed", label: "Closed" },
        ].map((f) => (
          <Link
            key={f.href}
            href={f.href}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
          <thead className="bg-zinc-50 dark:bg-zinc-900/50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                When
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Driver
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Detail
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-zinc-500">
                Status
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-zinc-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
            {incidents.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-zinc-500"
                >
                  No incidents yet.
                </td>
              </tr>
            ) : (
              incidents.map((inc) => {
                const highlighted = highlightId === inc.id;
                return (
                  <tr
                    key={inc.id}
                    id={inc.id}
                    className={
                      highlighted
                        ? "bg-rose-50 dark:bg-rose-950/30"
                        : undefined
                    }
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                      {new Date(inc.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">
                        {inc.driverName || "Driver"}
                      </div>
                      {inc.driverEmail ? (
                        <div className="text-xs text-zinc-500">{inc.driverEmail}</div>
                      ) : null}
                      {inc.driverId ? (
                        <Link
                          href={`/drivers/${inc.driverId}`}
                          className="text-xs text-teal-700 hover:underline dark:text-teal-300"
                        >
                          Profile
                        </Link>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-700 dark:text-zinc-300">
                      {inc.vehicle ? <div>Vehicle: {inc.vehicle}</div> : null}
                      {inc.lat != null && inc.lng != null ? (
                        <div className="text-xs text-zinc-500">
                          {inc.lat.toFixed(5)}, {inc.lng.toFixed(5)}
                        </div>
                      ) : null}
                      {inc.note ? <div className="mt-1">{inc.note}</div> : null}
                    </td>
                    <td className="px-4 py-3 text-sm capitalize text-zinc-800 dark:text-zinc-200">
                      {inc.status}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      <div className="inline-flex gap-2">
                        {inc.status === "open" ? (
                          <form action={ackIncident}>
                            <input type="hidden" name="id" value={inc.id} />
                            <button
                              type="submit"
                              className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-500"
                            >
                              Ack
                            </button>
                          </form>
                        ) : null}
                        {inc.status !== "closed" ? (
                          <form action={closeIncident}>
                            <input type="hidden" name="id" value={inc.id} />
                            <button
                              type="submit"
                              className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs font-medium text-white hover:bg-zinc-700 dark:bg-zinc-200 dark:text-zinc-900"
                            >
                              Close
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
