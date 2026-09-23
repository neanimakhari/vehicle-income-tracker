import { requireAuth } from "@/lib/auth";
import { fetchJson, getApiUrl, getAuthHeaders } from "@/lib/api";
import {
  Activity,
  Database,
  HardDrive,
  AlertCircle,
  CheckCircle2,
  Cpu,
  Server,
  Container,
} from "lucide-react";
import { clearPlatformAdminCache } from "../actions/clear-cache";
import { HealthRefreshButton } from "@/components/health-refresh-button";
import { CacheClearSection } from "./cache-clear-section";
import { SmtpTestSection } from "./smtp-test-section";

type HealthDetail = {
  status?: string;
  db?: string;
  dbMessage?: string;
  disk?: {
    path: string;
    usedMb: number;
    totalMb: number;
    freeMb: number;
    kind?: string;
    label?: string;
  };
  diskError?: string;
};

type HostMetrics = {
  collectedAt?: string;
  note?: string;
  cpu?: {
    cores: number;
    load1: number;
    load5: number;
    load15: number;
    processCpuPercent: number | null;
  };
  memory?: {
    hostTotalMb: number;
    hostFreeMb: number;
    hostUsedPercent: number;
    processRssMb: number;
    processHeapUsedMb: number;
    cgroupLimitMb: number | null;
    cgroupUsedMb: number | null;
  };
  disk?: {
    root: {
      path: string;
      totalMb: number;
      freeMb: number;
      usedMb: number;
      usedPercent: number;
    } | null;
    uploads: { path: string; usedMb: number; label: string } | null;
  };
  database?: {
    name: string;
    sizeMb: number | null;
    error?: string;
    host?: string | null;
    port?: number | null;
    version?: string | null;
    uptimeSec?: number | null;
    maxConnections?: number | null;
    connections?: {
      total: number;
      active: number;
      idle: number;
      idleInTransaction: number;
      waiting: number;
    } | null;
    cacheHitRatioPercent?: number | null;
    transactionsCommitted?: number | null;
    transactionsRolledBack?: number | null;
    deadlocks?: number | null;
    topRelations?: Array<{ schema: string; name: string; sizeMb: number }>;
  };
  docker?: {
    available: boolean;
    containers?: Array<{
      name: string;
      status: string;
      cpuPercent: number | null;
      memUsageMb: number | null;
      memLimitMb: number | null;
    }>;
    error?: string;
  };
  process?: { uptimeSec: number; nodeVersion: string; pid: number };
  warnings?: string[];
};

type MailStatus = { configured: boolean; transport: string; from: string };

type HealthPageProps = { searchParams?: Promise<{ cleared?: string; t?: string }> };

function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtCollected(iso?: string): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default async function HealthPage(props: HealthPageProps) {
  await requireAuth();
  const searchParams = await props.searchParams;
  const showCleared = searchParams?.cleared === "1";
  // searchParams.t is only used as a cache-bust key from Refresh
  void searchParams?.t;

  const [health, host, mail] = await Promise.all([
    fetchJson<HealthDetail>("/health/detailed").catch(() => null),
    fetchJson<HostMetrics>("/platform/ops/host"),
    fetchJson<MailStatus>("/platform/ops/mail"),
  ]);

  // Public health may be unauthenticated; fall back to direct fetch if fetchJson 401s
  let healthDetail = health;
  if (!healthDetail) {
    try {
      const base = getApiUrl();
      const res = await fetch(`${base}/health/detailed`, { cache: "no-store" });
      if (res.ok) healthDetail = await res.json();
    } catch {
      healthDetail = null;
    }
  }

  const apiReachable = healthDetail !== null || host !== null;
  const dbOk = healthDetail?.db === "ok" || (host?.database?.sizeMb != null && !host.database.error);
  const status = healthDetail?.status ?? (host ? "ok" : "unknown");

  async function sendMailTest(to: string) {
    "use server";
    try {
      const res = await fetch(`${getApiUrl()}/platform/ops/mail-test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeaders()),
        },
        body: JSON.stringify({ to }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = Array.isArray(body.message) ? body.message.join(" ") : body.message;
        return { ok: false as const, error: msg ?? "Failed to send" };
      }
      return { ok: true as const, sent: Boolean(body.sent) };
    } catch {
      return { ok: false as const, error: "Request failed" };
    }
  }

  const memPct = host?.memory?.hostUsedPercent ?? null;
  const diskPct = host?.disk?.root?.usedPercent ?? null;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
            Health & System
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            API droplet, Postgres server (SQL), Docker containers, and outbound mail
          </p>
          {fmtCollected(host?.collectedAt) && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              Last collected: {fmtCollected(host?.collectedAt)}
            </p>
          )}
        </div>
        <HealthRefreshButton />
      </div>

      {host?.warnings && host.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          <ul className="list-disc space-y-1 pl-4">
            {host.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

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
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">API</h3>
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
              {host?.process && (
                <>
                  {" "}
                  · uptime {fmtUptime(host.process.uptimeSec)} · Node {host.process.nodeVersion}
                </>
              )}
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
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Database</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {healthDetail
                    ? healthDetail.db === "ok"
                      ? "Connected"
                      : "Error"
                    : host?.database
                      ? "Connected"
                      : "Unknown"}
                </p>
              </div>
            </div>
            {dbOk ? (
              <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            )}
          </div>
          {host?.database?.sizeMb != null && (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400">
              {host.database.name}: <span className="font-medium">{host.database.sizeMb} MB</span>
              {host.database.host ? (
                <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                  {host.database.host}
                  {host.database.port ? `:${host.database.port}` : ""}
                </span>
              ) : null}
            </p>
          )}
          {healthDetail && healthDetail.db !== "ok" && healthDetail.dbMessage && (
            <p className="mt-4 text-sm text-red-600 dark:text-red-400">{healthDetail.dbMessage}</p>
          )}
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <HardDrive className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Storage</h3>
              {host?.disk?.root ? (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Root {host.disk.root.usedPercent}% used · {host.disk.root.freeMb} MB free of{" "}
                  {host.disk.root.totalMb} MB
                </p>
              ) : healthDetail?.disk ? (
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Uploads {healthDetail.disk.usedMb.toFixed(2)} MB
                  {healthDetail.disk.label ? ` · ${healthDetail.disk.label}` : ""}
                </p>
              ) : (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Not measured</p>
              )}
            </div>
          </div>
          {host?.disk?.uploads && (
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              Uploads dir: {host.disk.uploads.usedMb} MB ({host.disk.uploads.label})
            </p>
          )}
          {diskPct != null && diskPct >= 85 && (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">Disk pressure warning</p>
          )}
        </div>
      </div>

      {host?.database && (
        <div className="card p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
              <Database className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Postgres server
              </h3>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {host.database.version ?? "PostgreSQL"}
                {host.database.uptimeSec != null
                  ? ` · uptime ${fmtUptime(host.database.uptimeSec)}`
                  : ""}
              </p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                Managed DB host CPU/RAM is not exposed over SQL — these are Postgres process stats.
              </p>
            </div>
          </div>
          {host.database.error ? (
            <p className="mt-4 text-sm text-amber-700 dark:text-amber-400">{host.database.error}</p>
          ) : (
            <>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Database size</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                    {host.database.sizeMb != null ? `${host.database.sizeMb} MB` : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Connections</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                    {host.database.connections
                      ? `${host.database.connections.total} / ${host.database.maxConnections ?? "—"}`
                      : "—"}
                    {host.database.connections ? (
                      <span className="block text-xs font-normal text-zinc-500">
                        {host.database.connections.active} active · {host.database.connections.idle}{" "}
                        idle
                        {host.database.connections.idleInTransaction
                          ? ` · ${host.database.connections.idleInTransaction} idle-in-xact`
                          : ""}
                        {host.database.connections.waiting
                          ? ` · ${host.database.connections.waiting} waiting`
                          : ""}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Cache hit ratio</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                    {host.database.cacheHitRatioPercent != null
                      ? `${host.database.cacheHitRatioPercent}%`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">Txns / deadlocks</dt>
                  <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                    {host.database.transactionsCommitted != null
                      ? `${host.database.transactionsCommitted.toLocaleString()} commit`
                      : "—"}
                    {host.database.transactionsRolledBack != null ? (
                      <span className="block text-xs font-normal text-zinc-500">
                        {host.database.transactionsRolledBack.toLocaleString()} rollback ·{" "}
                        {host.database.deadlocks ?? 0} deadlocks
                      </span>
                    ) : null}
                  </dd>
                </div>
              </dl>
              {host.database.topRelations && host.database.topRelations.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Largest relations
                  </h4>
                  <ul className="mt-2 divide-y divide-zinc-100 text-sm dark:divide-zinc-800">
                    {host.database.topRelations.map((r) => (
                      <li
                        key={`${r.schema}.${r.name}`}
                        className="flex items-center justify-between gap-3 py-1.5"
                      >
                        <span className="truncate font-mono text-zinc-700 dark:text-zinc-300">
                          {r.schema}.{r.name}
                        </span>
                        <span className="shrink-0 text-zinc-500">{r.sizeMb} MB</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {host && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                <Cpu className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">CPU & memory</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  Droplet / API host · {host.cpu?.cores ?? "—"} cores · load {host.cpu?.load1 ?? "—"} /{" "}
                  {host.cpu?.load5 ?? "—"} / {host.cpu?.load15 ?? "—"}
                </p>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">Memory used</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                  {memPct != null ? `${memPct}%` : "—"}
                  {host.memory && (
                    <span className="font-normal text-zinc-500">
                      {" "}
                      ({host.memory.hostFreeMb} MB free / {host.memory.hostTotalMb} MB)
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">API process RSS</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-50">
                  {host.memory?.processRssMb ?? "—"} MB
                </dd>
              </div>
            </dl>
            {memPct != null && memPct >= 85 && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">Memory pressure warning</p>
            )}
            {host.note && (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">{host.note}</p>
            )}
          </div>

          <div className="card p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-100 dark:bg-zinc-800">
                <Container className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Docker (vit_*)</h3>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {host.docker?.available
                    ? `${host.docker.containers?.length ?? 0} container(s)`
                    : "Socket not mounted"}
                </p>
              </div>
            </div>
            {host.docker?.error && (
              <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">{host.docker.error}</p>
            )}
            {host.docker?.containers && host.docker.containers.length > 0 && (
              <ul className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                {host.docker.containers.map((c) => (
                  <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-mono text-zinc-800 dark:text-zinc-200">{c.name}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {c.cpuPercent != null ? `${c.cpuPercent}% CPU` : "—"}
                      {c.memUsageMb != null ? ` · ${c.memUsageMb} MB` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {!host.docker?.available && (
              <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
                Mount <code className="font-mono">/var/run/docker.sock</code> read-only on the API
                service for live container stats.
              </p>
            )}
          </div>
        </div>
      )}

      {!host && (
        <div className="card flex items-start gap-3 p-6 text-sm text-zinc-600 dark:text-zinc-400">
          <Server className="h-5 w-5 shrink-0" />
          Host metrics unavailable (need PLATFORM_ADMIN / SYS session against /platform/ops/host).
        </div>
      )}

      <SmtpTestSection
        configured={mail?.configured ?? false}
        transport={mail?.transport ?? "none"}
        from={mail?.from ?? ""}
        sendTest={sendMailTest}
      />

      <CacheClearSection clearAction={clearPlatformAdminCache} showCleared={showCleared} />
    </div>
  );
}
