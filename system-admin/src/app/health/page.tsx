import { requireAuth } from "@/lib/auth";
import { getApiUrl } from "@/lib/api";
import { Activity, Database, HardDrive, AlertCircle, CheckCircle2 } from "lucide-react";
import { clearPlatformAdminCache } from "../actions/clear-cache";
import { HealthRefreshButton } from "@/components/health-refresh-button";
import { CacheClearSection } from "./cache-clear-section";

async function fetchHealthDetailed(): Promise<{
  status?: string;
  db?: string;
  dbMessage?: string;
  disk?: { path: string; usedMb: number; totalMb: number; freeMb: number };
  diskError?: string;
} | null> {
  try {
    const base = getApiUrl();
    const res = await fetch(`${base}/health/detailed`, { cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

type HealthPageProps = { searchParams?: Promise<{ cleared?: string }> };

export default async function HealthPage(props: HealthPageProps) {
  await requireAuth();
  const searchParams = await props.searchParams;
  const showCleared = searchParams?.cleared === "1";
  const health = await fetchHealthDetailed();
  const apiReachable = health !== null;
  const dbOk = health?.db === "ok";
  const status = health?.status ?? "unknown";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
            Health & System
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            API health, database connectivity, and storage usage
          </p>
        </div>
        <HealthRefreshButton />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  apiReachable
                    ? "bg-emerald-100 dark:bg-emerald-900/30"
                    : "bg-red-100 dark:bg-red-900/30"
                }`}
              >
                <Activity
                  className={
                    apiReachable
                      ? "h-6 w-6 text-emerald-600 dark:text-emerald-400"
                      : "h-6 w-6 text-red-600 dark:text-red-400"
                  }
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  API
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {apiReachable ? "Reachable" : "Unreachable"}
                </p>
              </div>
            </div>
            {apiReachable ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            )}
          </div>
          {apiReachable && (
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              Status: {status}
            </p>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                  dbOk ? "bg-emerald-100 dark:bg-emerald-900/30" : "bg-red-100 dark:bg-red-900/30"
                }`}
              >
                <Database
                  className={
                    dbOk
                      ? "h-6 w-6 text-emerald-600 dark:text-emerald-400"
                      : "h-6 w-6 text-red-600 dark:text-red-400"
                  }
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                  Database
                </h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {health ? (dbOk ? "Connected" : "Error") : "Unknown"}
                </p>
              </div>
            </div>
            {dbOk ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            )}
          </div>
          {health && !dbOk && health.dbMessage && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">
              {health.dbMessage}
            </p>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <HardDrive className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Storage (uploads)
              </h3>
              {health?.disk ? (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {health.disk.usedMb.toFixed(2)} MB used
                  {health.disk.totalMb > 0 && (
                    <> · {health.disk.freeMb.toFixed(0)} MB free</>
                  )}
                </p>
              ) : health?.diskError ? (
                <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
                  {health.diskError}
                </p>
              ) : (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Not measured or path not configured
                </p>
              )}
            </div>
          </div>
          {health?.disk?.path && (
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              Path: {health.disk.path}
            </p>
          )}
        </div>
      </div>

      <CacheClearSection
        clearAction={clearPlatformAdminCache}
        showCleared={showCleared}
      />
    </div>
  );
}
