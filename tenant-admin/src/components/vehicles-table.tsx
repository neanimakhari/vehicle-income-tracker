"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Car, Filter, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { TablePagination } from "@/components/table-pagination";

type Vehicle = {
  id: string;
  label: string;
  registrationNumber: string;
  isActive: boolean;
  trackerImei?: string | null;
};

type Device = {
  id: string;
  imei: string;
  vehicleId: string;
  isActive: boolean;
  lastSeenAt: string | null;
};

type SortKey = "label" | "registrationNumber" | "status" | "gps";
type SortDir = "asc" | "desc";

type GpsStatus = "no_tracker" | "online" | "offline" | "never_seen";

type Props = {
  vehicles: Vehicle[];
  missingVehicleIds?: string[];
  devices?: Device[];
  offlineMinutes?: number;
  onToggle: (formData: FormData) => Promise<void>;
  onDelete: (formData: FormData) => Promise<void>;
};

function SortIcon({ current, dir }: { current: boolean; dir: SortDir | null }) {
  if (!current) return <ArrowUpDown className="h-4 w-4 opacity-50" />;
  return dir === "asc" ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />;
}

function gpsStatusFor(
  vehicle: Vehicle,
  byVehicle: Map<string, Device>,
  offlineMs: number,
): GpsStatus {
  const imei = vehicle.trackerImei?.trim();
  if (!imei) return "no_tracker";
  const device =
    byVehicle.get(vehicle.id) ??
    [...byVehicle.values()].find((d) => d.imei === imei);
  if (!device?.lastSeenAt) return "never_seen";
  const age = Date.now() - new Date(device.lastSeenAt).getTime();
  if (Number.isNaN(age) || age > offlineMs) return "offline";
  return "online";
}

function lastSeenLabel(
  vehicle: Vehicle,
  byVehicle: Map<string, Device>,
): string | null {
  const imei = vehicle.trackerImei?.trim();
  if (!imei) return null;
  const device =
    byVehicle.get(vehicle.id) ??
    [...byVehicle.values()].find((d) => d.imei === imei);
  if (!device?.lastSeenAt) return null;
  const ms = Date.now() - new Date(device.lastSeenAt).getTime();
  if (Number.isNaN(ms)) return null;
  if (ms < 60_000) return "Just now";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
  return `${Math.floor(ms / 86_400_000)}d ago`;
}

function todayJhb(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Johannesburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const GPS_LABEL: Record<GpsStatus, string> = {
  no_tracker: "No tracker",
  online: "Online",
  offline: "Offline",
  never_seen: "Never seen",
};

const GPS_CLASS: Record<GpsStatus, string> = {
  no_tracker: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
  online: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  offline: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  never_seen: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

export function VehiclesTable({
  vehicles,
  missingVehicleIds = [],
  devices = [],
  offlineMinutes = 15,
  onToggle,
  onDelete,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [gpsFilter, setGpsFilter] = useState<"all" | GpsStatus>("all");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("label");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [pageSize, setPageSize] = useState(10);
  const [pageIndex, setPageIndex] = useState(0);
  const missingSet = useMemo(() => new Set(missingVehicleIds), [missingVehicleIds]);
  const deviceByVehicle = useMemo(() => {
    const map = new Map<string, Device>();
    for (const d of devices) {
      if (d.vehicleId) map.set(d.vehicleId, d);
    }
    return map;
  }, [devices]);
  const offlineMs = Math.max(1, offlineMinutes) * 60_000;

  const filtered = useMemo(() => {
    let list = vehicles.filter((v) => {
      if (statusFilter === "active" && !v.isActive) return false;
      if (statusFilter === "inactive" && v.isActive) return false;
      if (gpsFilter !== "all") {
        if (gpsStatusFor(v, deviceByVehicle, offlineMs) !== gpsFilter) return false;
      }
      return true;
    });
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (v) =>
          v.label.toLowerCase().includes(q) ||
          (v.registrationNumber ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [vehicles, statusFilter, gpsFilter, search, deviceByVehicle, offlineMs]);

  const gpsCounts = useMemo(() => {
    const c = { no_tracker: 0, online: 0, offline: 0, never_seen: 0 };
    for (const v of vehicles) {
      c[gpsStatusFor(v, deviceByVehicle, offlineMs)] += 1;
    }
    return c;
  }, [vehicles, deviceByVehicle, offlineMs]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "label":
          cmp = a.label.localeCompare(b.label);
          break;
        case "registrationNumber":
          cmp = (a.registrationNumber ?? "").localeCompare(b.registrationNumber ?? "");
          break;
        case "status":
          cmp = (a.isActive ? 1 : 0) - (b.isActive ? 1 : 0);
          break;
        case "gps":
          cmp = gpsStatusFor(a, deviceByVehicle, offlineMs).localeCompare(
            gpsStatusFor(b, deviceByVehicle, offlineMs),
          );
          break;
        default:
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir, deviceByVehicle, offlineMs]);

  const paginated = useMemo(() => {
    const start = pageIndex * pageSize;
    return sorted.slice(start, pageIndex * pageSize + pageSize);
  }, [sorted, pageIndex, pageSize]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPageIndex(0);
  };

  const th = (key: SortKey, label: string) => (
    <th
      scope="col"
      className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50 cursor-pointer select-none hover:bg-zinc-100 dark:hover:bg-zinc-800"
      onClick={() => toggleSort(key)}
    >
      <div className="flex items-center gap-1">
        {label}
        <SortIcon current={sortKey === key} dir={sortKey === key ? sortDir : null} />
      </div>
    </th>
  );

  return (
    <div className="mt-8 flow-root">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          <Filter className="h-4 w-4 shrink-0" />
          Filters
        </div>
        <select
          className="input w-full sm:w-auto sm:min-w-[120px] py-2 text-sm"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value as "all" | "active" | "inactive");
            setPageIndex(0);
          }}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select
          className="input w-full sm:w-auto sm:min-w-[160px] py-2 text-sm"
          value={gpsFilter}
          onChange={(e) => {
            setGpsFilter(e.target.value as "all" | GpsStatus);
            setPageIndex(0);
          }}
        >
          <option value="all">All GPS ({vehicles.length})</option>
          <option value="no_tracker">Needs setup ({gpsCounts.no_tracker})</option>
          <option value="online">Online ({gpsCounts.online})</option>
          <option value="offline">Offline ({gpsCounts.offline})</option>
          <option value="never_seen">Never seen ({gpsCounts.never_seen})</option>
        </select>
        <div className="relative w-full sm:flex-1 sm:min-w-[180px] sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
          <input
            type="search"
            placeholder="Search by name or registration..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPageIndex(0);
            }}
            className="input pl-9 w-full"
          />
        </div>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-12 text-center">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-100 dark:bg-teal-900/30 mb-4">
            <Car className="h-8 w-8 text-teal-600 dark:text-teal-400" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">No vehicles yet</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 max-w-sm mx-auto">
            Add your first vehicle to start tracking income and maintenance.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-8 text-center">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No vehicles match the current filter.</p>
        </div>
      ) : (
        <div className="table-responsive -my-2">
          <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black/5 sm:rounded-lg">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    {th("label", "Vehicle")}
                    {th("registrationNumber", "Registration")}
                    {th("status", "Status")}
                    {th("gps", "GPS")}
                    <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                      Income today
                    </th>
                    <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white dark:divide-zinc-800 dark:bg-zinc-950">
                  {paginated.map((vehicle) => {
                    const gps = gpsStatusFor(vehicle, deviceByVehicle, offlineMs);
                    const seen = lastSeenLabel(vehicle, deviceByVehicle);
                    const day = todayJhb();
                    return (
                    <tr key={vehicle.id}>
                      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-zinc-900 dark:text-zinc-50">
                        {vehicle.label}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        {vehicle.registrationNumber}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            vehicle.isActive
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          }`}
                        >
                          {vehicle.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={`inline-flex w-fit rounded-full px-2 text-xs font-semibold leading-5 ${GPS_CLASS[gps]}`}
                          >
                            {GPS_LABEL[gps]}
                          </span>
                          {seen ? (
                            <span className="text-[11px] text-zinc-500">Seen {seen}</span>
                          ) : gps === "no_tracker" ? (
                            <span className="text-[11px] text-zinc-500">No IMEI bound</span>
                          ) : gps === "never_seen" ? (
                            <span className="text-[11px] text-zinc-500">Awaiting first ping</span>
                          ) : null}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        {missingSet.has(vehicle.id) ? (
                          <span className="inline-flex rounded-full px-2 text-xs font-semibold leading-5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                            Missing
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full px-2 text-xs font-semibold leading-5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                            Submitted
                          </span>
                        )}
                      </td>
                      <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                        <div className="flex flex-wrap items-center justify-end gap-3">
                          {vehicle.trackerImei ? (
                            <>
                              <Link
                                href={`/tracking?vehicleId=${encodeURIComponent(vehicle.id)}`}
                                className="text-teal-600 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300"
                              >
                                Track
                              </Link>
                              <Link
                                href={`/tracking?vehicleId=${encodeURIComponent(vehicle.id)}&mode=playback&day=${encodeURIComponent(day)}`}
                                className="text-teal-600 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300"
                              >
                                Replay today
                              </Link>
                            </>
                          ) : (
                            <Link
                              href={`/tracking/setup?vehicleId=${encodeURIComponent(vehicle.id)}`}
                              className="text-teal-600 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300"
                            >
                              Set up tracker
                            </Link>
                          )}
                          <Link
                            href={`/vehicles/${vehicle.id}`}
                            className="text-teal-600 hover:text-teal-900 dark:text-teal-400 dark:hover:text-teal-300"
                          >
                            View Details
                          </Link>
                          <form action={onToggle}>
                            <input type="hidden" name="id" value={vehicle.id} />
                            <input type="hidden" name="isActive" value={String(vehicle.isActive)} />
                            <button className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400" type="submit">
                              {vehicle.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </form>
                          <form action={onDelete}>
                            <input type="hidden" name="id" value={vehicle.id} />
                            <button className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300" type="submit">
                              Delete
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
              {sorted.length > 0 && (
                <TablePagination
                  totalItems={sorted.length}
                  pageSize={pageSize}
                  pageIndex={pageIndex}
                  onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPageIndex(0);
                  }}
                  onPageChange={setPageIndex}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
