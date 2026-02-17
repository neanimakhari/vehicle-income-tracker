import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl } from "../lib/api";
import { Building2, Shield, Users, CheckCircle2, ArrowRight, FileText, Activity, Database, AlertCircle, Bell } from "lucide-react";
import Link from "next/link";

async function fetchTenants() {
  const tenants = await fetchJson<Array<{ id: string; requireMfa?: boolean; requireMfaUsers?: boolean }>>(
    "/tenants",
  );
  return tenants ?? [];
}

async function fetchTenantUsage() {
  const usage = await fetchJson<
    Array<{ drivers: number; incomes: number; vehicles: number; totalIncome: number }>
  >("/tenants/usage");
  return usage ?? [];
}

async function fetchAlertsCount() {
  try {
    const data = await fetchJson<{ alerts?: unknown[] }>("/platform/alerts");
    return Array.isArray(data?.alerts) ? data.alerts.length : 0;
  } catch {
    return 0;
  }
}

async function fetchHealth() {
  try {
    const base = getApiUrl();
    const res = await fetch(`${base}/health/detailed`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json() as { status?: string; db?: string; dbMessage?: string };
  } catch {
    return null;
  }
}

export default async function Home() {
  await requireAuth();
  const [tenants, usage, alertsCount, health] = await Promise.all([
    fetchTenants(),
    fetchTenantUsage(),
    fetchAlertsCount(),
    fetchHealth(),
  ]);
  const totalTenants = tenants.length;
  const totalDrivers = usage.reduce((s, u) => s + u.drivers, 0);
  const totalIncomeEntries = usage.reduce((s, u) => s + u.incomes, 0);
  const adminMfaRequired = tenants.filter(tenant => tenant.requireMfa).length;
  const driverMfaRequired = tenants.filter(tenant => tenant.requireMfaUsers).length;
  const activeTenants = tenants.length;
  const apiOk = health !== null;
  const dbOk = health?.db === "ok";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
          Platform Dashboard
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Overview of platform tenants and security enforcement
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Tenants"
          value={totalTenants}
          icon={Building2}
          color="teal"
          description="Active tenants"
        />
        <StatCard
          title="Total Drivers"
          value={totalDrivers}
          icon={Users}
          color="teal"
          description="Across all tenants"
        />
        <StatCard
          title="Income Entries"
          value={totalIncomeEntries.toLocaleString()}
          icon={FileText}
          color="blue"
          description="Logged income records"
        />
        <StatCard
          title="Platform Alerts"
          value={alertsCount}
          icon={Bell}
          color={alertsCount > 0 ? "amber" : "teal"}
          description="Last 7 days"
        />
        <StatCard
          title="Admin MFA Required"
          value={adminMfaRequired}
          icon={Shield}
          color="blue"
          description={`${totalTenants > 0 ? Math.round((adminMfaRequired / totalTenants) * 100) : 0}% of tenants`}
        />
        <StatCard
          title="Driver MFA Required"
          value={driverMfaRequired}
          icon={Shield}
          color="emerald"
          description={`${totalTenants > 0 ? Math.round((driverMfaRequired / totalTenants) * 100) : 0}% of tenants`}
        />
      </div>

      {/* System Health */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">System health</h2>
          <Link
            href="/health"
            className="text-sm font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 flex items-center gap-1"
          >
            View details
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${apiOk ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
              <Activity className={apiOk ? "h-5 w-5 text-emerald-600 dark:text-emerald-400" : "h-5 w-5 text-red-600 dark:text-red-400"} />
            </div>
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">API</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{apiOk ? "Reachable" : "Unreachable"}</p>
            </div>
            {apiOk ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 ml-auto" /> : <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 ml-auto" />}
          </div>
          <div className="flex items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-700 p-4">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${dbOk ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"}`}>
              <Database className={dbOk ? "h-5 w-5 text-emerald-600 dark:text-emerald-400" : "h-5 w-5 text-red-600 dark:text-red-400"} />
            </div>
            <div>
              <p className="font-medium text-zinc-900 dark:text-zinc-50">Database</p>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{health ? (dbOk ? "Connected" : "Error") : "Unknown"}</p>
            </div>
            {dbOk ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 ml-auto" /> : <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 ml-auto" />}
          </div>
        </div>
        {health && !dbOk && health.dbMessage && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">DB: {health.dbMessage}</p>
        )}
      </div>

      {/* Security Status */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Shield className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Admin MFA Enforcement</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {adminMfaRequired > 0 ? `${adminMfaRequired} tenant(s) require admin MFA` : "No enforcement enabled"}
                </p>
              </div>
            </div>
            <div className={`rounded-full px-3 py-1 text-xs font-semibold ${
              adminMfaRequired > 0 
                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
            }`}>
              {adminMfaRequired}
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            {adminMfaRequired > 0
              ? `${adminMfaRequired} tenant(s) have MFA enforcement enabled for tenant administrators.`
              : "No tenants currently require MFA for tenant administrators."}
          </p>
        </div>

        <div className="card p-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                driverMfaRequired > 0 
                  ? "bg-emerald-100 dark:bg-emerald-900/30"
                  : "bg-zinc-100 dark:bg-zinc-800"
              }`}>
                <Shield className={`h-6 w-6 ${
                  driverMfaRequired > 0 
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-zinc-600 dark:text-zinc-400"
                }`} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Driver MFA Enforcement</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {driverMfaRequired > 0 ? `${driverMfaRequired} tenant(s) require driver MFA` : "No enforcement enabled"}
                </p>
              </div>
            </div>
            <div className={`text-2xl font-bold ${
              driverMfaRequired > 0 
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-zinc-600 dark:text-zinc-400"
            }`}>
              {driverMfaRequired}
            </div>
          </div>
          <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
            {driverMfaRequired > 0
              ? `${driverMfaRequired} tenant(s) require MFA enforcement for mobile app drivers.`
              : "No tenants currently require MFA for mobile app drivers."}
          </p>
          {driverMfaRequired > 0 && (
            <Link
              href="/tenants"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-teal-700 hover:shadow-lg"
            >
              View Tenants
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Quick Actions</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/tenants"
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-800 dark:hover:border-teal-700"
          >
            <Building2 className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-50">Manage Tenants</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">View and configure tenants</div>
            </div>
          </Link>
          <Link
            href="/health"
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-800 dark:hover:border-teal-700"
          >
            <Activity className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-50">Health & System</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">API, DB, storage status</div>
            </div>
          </Link>
          <Link
            href="/alerts"
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-800 dark:hover:border-teal-700"
          >
            <Bell className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-50">Platform Alerts</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">New tenants, limits, login spikes</div>
            </div>
          </Link>
          <Link
            href="/audit"
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-800 dark:hover:border-teal-700"
          >
            <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-50">Audit Logs</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">View platform activity</div>
            </div>
          </Link>
          <Link
            href="/mfa"
            className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-4 transition-all hover:border-teal-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-800 dark:hover:border-teal-700"
          >
            <Shield className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <div>
              <div className="font-medium text-zinc-900 dark:text-zinc-50">Security Settings</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400">MFA configuration</div>
            </div>
          </Link>
        </div>
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
  const colorClasses: Record<string, string> = {
    teal: "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400",
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
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
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorClasses[color] ?? colorClasses.teal}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
