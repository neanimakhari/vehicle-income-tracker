import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../lib/api";
import { Shield, Users, AlertCircle, ArrowRight, DollarSign, TrendingUp, UserCheck, BarChart3, Car, Award, Wrench, FileWarning } from "lucide-react";
import Link from "next/link";
import { clearTenantAdminCache } from "./actions/clear-cache";
import { OnboardingBanner } from "@/components/onboarding-banner";

async function fetchPolicy() {
  const policy = await fetchJson<{ requireMfaUsers?: boolean; requireMfa?: boolean }>("/tenant/policy");
  return policy ?? null;
}

async function fetchDrivers() {
  const drivers = await fetchJson<Array<{ id: string; mfaEnabled?: boolean }>>("/tenant/users");
  return drivers ?? [];
}

async function fetchSummary() {
  try {
    const summary = await fetchJson<{
      totalIncome?: number;
      totalExpenses?: number;
      netIncome?: number;
      incomeCount?: number;
      expenseCount?: number;
      activeDrivers?: number;
    }>("/tenant/reports/summary");
    return summary;
  } catch {
    return null;
  }
}

async function fetchTopVehicles() {
  try {
    const vehicles = await fetchJson<Array<{ vehicle: string; totalIncome: number; trips: number }>>(
      "/tenant/reports/top-vehicles?limit=5"
    );
    return vehicles ?? [];
  } catch {
    return [];
  }
}

async function fetchTopDrivers() {
  try {
    const drivers = await fetchJson<Array<{ driverName: string; totalIncome: number; trips: number }>>(
      "/tenant/reports/driver-stats?limit=5"
    );
    return drivers ?? [];
  } catch {
    return [];
  }
}

async function fetchMaintenanceCount() {
  try {
    const tasks = await fetchJson<Array<{ status?: string; isCompleted?: boolean }>>("/tenant/maintenance");
    if (!Array.isArray(tasks)) return 0;
    return tasks.filter((t) => !t.isCompleted && (t.status === "overdue" || t.status === "due_soon")).length;
  } catch {
    return 0;
  }
}

async function fetchVehicles() {
  try {
    const vehicles = await fetchJson<Array<{ id: string }>>("/tenant/vehicles");
    return Array.isArray(vehicles) ? vehicles : [];
  } catch {
    return [];
  }
}

async function fetchExpirySummary() {
  try {
    const data = await fetchJson<{ driversExpiringSoon?: number }>("/tenant/drivers/expiry-summary");
    return data?.driversExpiringSoon ?? 0;
  } catch {
    return 0;
  }
}

export default async function Home() {
  await requireAuth();
  const [policy, drivers, summary, topVehicles, topDrivers, pendingMaintenance, vehicles, driversExpiringSoon] = await Promise.all([
    fetchPolicy(),
    fetchDrivers(),
    fetchSummary(),
    fetchTopVehicles(),
    fetchTopDrivers(),
    fetchMaintenanceCount(),
    fetchVehicles(),
    fetchExpirySummary(),
  ]);
  const requiresMfa = policy?.requireMfaUsers === true;
  const pendingMfa = requiresMfa ? drivers.filter(driver => !driver.mfaEnabled).length : 0;
  const totalDrivers = drivers.length;
  const mfaEnabled = drivers.filter(driver => driver.mfaEnabled).length;
  const activeDrivers = summary?.activeDrivers ?? totalDrivers;
  const hasDrivers = totalDrivers > 0;
  const hasVehicles = vehicles.length > 0;

  return (
    <div className="space-y-8">
      <OnboardingBanner hasDrivers={hasDrivers} hasVehicles={hasVehicles} />
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Overview of your tenant operations and security status
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Drivers"
          value={totalDrivers}
          icon={Users}
          color="teal"
          description="Active drivers"
        />
        <StatCard
          title="MFA Enabled"
          value={mfaEnabled}
          icon={Shield}
          color="emerald"
          description={`${totalDrivers > 0 ? Math.round((mfaEnabled / totalDrivers) * 100) : 0}% coverage`}
        />
        <StatCard
          title="Total Income"
          value={summary?.totalIncome ? `R ${summary.totalIncome.toLocaleString()}` : "—"}
          icon={DollarSign}
          color="blue"
          description="All time"
        />
        <StatCard
          title="Net Income"
          value={summary?.netIncome ? `R ${summary.netIncome.toLocaleString()}` : "—"}
          icon={TrendingUp}
          color={summary?.netIncome && summary.netIncome >= 0 ? "emerald" : "red"}
          description="Income - Expenses"
        />
        <StatCard
          title="Total Trips"
          value={summary?.incomeCount ?? 0}
          icon={BarChart3}
          color="blue"
          description="Income entries"
        />
        <StatCard
          title="Active Drivers"
          value={activeDrivers}
          icon={UserCheck}
          color="emerald"
          description="Enabled accounts"
        />
        <StatCard
          title="Pending Maintenance"
          value={pendingMaintenance}
          icon={Wrench}
          color={pendingMaintenance > 0 ? "amber" : "teal"}
          description="Overdue or due soon"
        />
        <StatCard
          title="Documents expiring soon"
          value={driversExpiringSoon}
          icon={FileWarning}
          color={driversExpiringSoon > 0 ? "amber" : "teal"}
          description="Licence, PRDP or medical within 60 days"
        />
      </div>

      {/* Security Status */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900/30">
                <Shield className="h-6 w-6 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Driver MFA Policy</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {requiresMfa ? "Required for all drivers" : "Optional for drivers"}
                </p>
              </div>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
              requiresMfa 
                ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
            }`}>
              {requiresMfa ? "Required" : "Optional"}
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            {requiresMfa
              ? "All drivers must enable multi-factor authentication before they can access the mobile app."
              : "Drivers can optionally enable multi-factor authentication for enhanced security."}
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                pendingMfa > 0 
                  ? "bg-amber-100 dark:bg-amber-900/30"
                  : "bg-emerald-100 dark:bg-emerald-900/30"
              }`}>
                <AlertCircle className={`h-6 w-6 ${
                  pendingMfa > 0 
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Pending Driver MFA</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {requiresMfa ? "Drivers needing setup" : "No enforcement"}
                </p>
              </div>
            </div>
            <div className={`text-2xl font-bold ${
              pendingMfa > 0 
                ? "text-amber-600 dark:text-amber-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}>
              {requiresMfa ? pendingMfa : "—"}
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            {requiresMfa
              ? `${pendingMfa} driver(s) still need to complete MFA setup before they can log in.`
              : "MFA enforcement is not enabled for drivers."}
          </p>
          {requiresMfa && pendingMfa > 0 && (
            <Link
              href="/drivers"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-teal-700 hover:shadow-lg"
            >
              Review Drivers
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid gap-6 md:grid-cols-2">
        {topVehicles.length > 0 && (
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
                <Car className="h-5 w-5 text-teal-600 dark:text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Top Vehicles</h3>
            </div>
            <div className="space-y-3">
              {topVehicles.slice(0, 5).map((vehicle, index) => (
                <div key={vehicle.vehicle} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30 text-sm font-bold text-teal-600 dark:text-teal-400">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">{vehicle.vehicle}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{vehicle.trips} trips</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-50">R {vehicle.totalIncome.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {topDrivers.length > 0 && (
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                <Award className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Top Drivers</h3>
            </div>
            <div className="space-y-3">
              {topDrivers.slice(0, 5).map((driver, index) => (
                <div key={driver.driverName} className="flex items-center justify-between p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium text-zinc-900 dark:text-zinc-50">{driver.driverName}</div>
                      <div className="text-xs text-zinc-500 dark:text-zinc-400">{driver.trips} trips</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-zinc-900 dark:text-zinc-50">R {driver.totalIncome.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Quick Actions</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            href="/drivers"
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-800 dark:hover:border-teal-700"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <Users className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-50">Manage Drivers</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">View and edit driver profiles</div>
            </div>
          </Link>
          <Link
            href="/incomes"
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-800 dark:hover:border-teal-700"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <DollarSign className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-50">View Incomes</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Track vehicle income logs</div>
            </div>
          </Link>
          <Link
            href="/reports"
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-800 dark:hover:border-teal-700"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-50">View Reports</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Analytics and insights</div>
            </div>
          </Link>
          <Link
            href="/expiry-requests"
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-800 dark:hover:border-teal-700"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
              <FileWarning className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-50">Expiry requests</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">Licence, PRDP & medical updates</div>
            </div>
          </Link>
        </div>
      </div>

      <div className="card p-4">
        <form action={clearTenantAdminCache} className="flex items-center gap-4">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Clear app cache after data changes:</span>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
          >
            Clear cache
          </button>
        </form>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  description,
}: {
  title: string;
  value: string | number;
  icon: any;
  color: string;
  description: string;
}) {
  const colorClasses = {
    teal: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    red: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
  };

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{title}</p>
          <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        </div>
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClasses[color as keyof typeof colorClasses]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
