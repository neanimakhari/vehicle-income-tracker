import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as http from 'http';
import { EmailService } from '../modules/email/email.service';

export type HostMetrics = {
  collectedAt: string;
  scope: 'container';
  note: string;
  cpu: {
    cores: number;
    load1: number;
    load5: number;
    load15: number;
    processCpuPercent: number | null;
  };
  memory: {
    hostTotalMb: number;
    hostFreeMb: number;
    hostUsedPercent: number;
    processRssMb: number;
    processHeapUsedMb: number;
    cgroupLimitMb: number | null;
    cgroupUsedMb: number | null;
  };
  disk: {
    root: {
      path: string;
      totalMb: number;
      freeMb: number;
      usedMb: number;
      usedPercent: number;
    } | null;
    uploads: {
      path: string;
      usedMb: number;
      label: string;
    } | null;
  };
  database: {
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
  docker: {
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
  process: {
    uptimeSec: number;
    nodeVersion: string;
    pid: number;
  };
  warnings: string[];
};

@Injectable()
export class PlatformOpsService {
  private readonly logger = new Logger(PlatformOpsService.name);
  private lastCpuSample: { idle: number; total: number; at: number } | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async getHostMetrics(): Promise<HostMetrics> {
    const warnings: string[] = [];
    const load = os.loadavg();
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedPercent =
      totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 1000) / 10 : 0;

    const mem = process.memoryUsage();
    const cgroup = await this.readCgroupMemory();
    const rootDisk = await this.statfsMb('/');
    const uploadsPath =
      this.configService.get<string>('uploads.path') ??
      process.env.UPLOADS_PATH ??
      './uploads';
    let uploads: HostMetrics['disk']['uploads'] = null;
    try {
      const st = await fs.stat(uploadsPath).catch(() => null);
      if (st?.isDirectory()) {
        const usedMb = await this.getDirSizeMb(uploadsPath);
        uploads = {
          path: uploadsPath,
          usedMb: Math.round(usedMb * 100) / 100,
          label: 'Uploads directory size (not host free space)',
        };
      }
    } catch (e) {
      warnings.push(
        `Uploads size: ${e instanceof Error ? e.message : 'failed'}`,
      );
    }

    const database = await this.collectDatabaseStats();
    if (database.error) {
      warnings.push(`Database stats: ${database.error}`);
    }
    if (
      database.connections &&
      database.maxConnections &&
      database.connections.total / database.maxConnections >= 0.85
    ) {
      warnings.push(
        `Postgres connections high: ${database.connections.total}/${database.maxConnections}`,
      );
    }

    const docker = await this.tryDockerStats();
    if (!docker.available) {
      warnings.push(
        'Docker socket not available in API container — showing Nest process / OS view only. Mount /var/run/docker.sock (ro) for container stats.',
      );
    }

    if (usedPercent >= 85) {
      warnings.push(`Host memory high: ${usedPercent}% used`);
    }
    if (rootDisk && rootDisk.usedPercent >= 85) {
      warnings.push(`Root filesystem high: ${rootDisk.usedPercent}% used`);
    }

    return {
      collectedAt: new Date().toISOString(),
      scope: 'container',
      note: 'API/droplet metrics from the API process view. Database block is from Postgres SQL (managed DB host CPU/RAM is not visible here).',
      cpu: {
        cores: os.cpus().length,
        load1: Math.round(load[0] * 100) / 100,
        load5: Math.round(load[1] * 100) / 100,
        load15: Math.round(load[2] * 100) / 100,
        processCpuPercent: this.sampleProcessCpuPercent(),
      },
      memory: {
        hostTotalMb: Math.round(totalMem / (1024 * 1024)),
        hostFreeMb: Math.round(freeMem / (1024 * 1024)),
        hostUsedPercent: usedPercent,
        processRssMb: Math.round(mem.rss / (1024 * 1024)),
        processHeapUsedMb: Math.round(mem.heapUsed / (1024 * 1024)),
        cgroupLimitMb: cgroup.limitMb,
        cgroupUsedMb: cgroup.usedMb,
      },
      disk: {
        root: rootDisk,
        uploads,
      },
      database,
      docker,
      process: {
        uptimeSec: Math.round(process.uptime()),
        nodeVersion: process.version,
        pid: process.pid,
      },
      warnings,
    };
  }

  private async collectDatabaseStats(): Promise<HostMetrics['database']> {
    const dbName =
      this.configService.get<string>('database.database') ??
      process.env.DB_DATABASE ??
      'vit_platform';
    const host =
      this.configService.get<string>('database.host') ??
      process.env.DB_HOST ??
      null;
    const portRaw =
      this.configService.get<number>('database.port') ??
      Number(process.env.DB_PORT ?? 5432);
    const port = Number.isFinite(portRaw) ? Number(portRaw) : null;

    const base: HostMetrics['database'] = {
      name: dbName,
      sizeMb: null,
      host,
      port,
    };

    try {
      const [sizeRows, metaRows, connRows, hitRows, topRows] = await Promise.all([
        this.dataSource.query(
          `SELECT pg_database_size(current_database())::bigint AS bytes`,
        ),
        this.dataSource.query(`
          SELECT
            version() AS version,
            EXTRACT(EPOCH FROM (now() - pg_postmaster_start_time()))::bigint AS uptime_sec,
            current_setting('max_connections')::int AS max_connections
        `),
        this.dataSource.query(`
          SELECT
            count(*)::int AS total,
            count(*) FILTER (WHERE state = 'active')::int AS active,
            count(*) FILTER (WHERE state = 'idle')::int AS idle,
            count(*) FILTER (WHERE state = 'idle in transaction')::int AS idle_in_transaction,
            count(*) FILTER (WHERE wait_event_type IS NOT NULL AND state = 'active')::int AS waiting
          FROM pg_stat_activity
          WHERE datname = current_database()
        `),
        this.dataSource.query(`
          SELECT
            blks_hit,
            blks_read,
            xact_commit,
            xact_rollback,
            deadlocks
          FROM pg_stat_database
          WHERE datname = current_database()
        `),
        this.dataSource.query(`
          SELECT
            n.nspname AS schema,
            c.relname AS name,
            pg_total_relation_size(c.oid)::bigint AS bytes
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE c.relkind IN ('r', 'm')
            AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          ORDER BY pg_total_relation_size(c.oid) DESC
          LIMIT 5
        `),
      ]);

      const bytes = Number(sizeRows?.[0]?.bytes ?? 0);
      base.sizeMb = Math.round((bytes / (1024 * 1024)) * 100) / 100;

      const meta = metaRows?.[0] ?? {};
      const ver = String(meta.version ?? '');
      base.version = ver.split(',')[0]?.trim() || ver.slice(0, 80) || null;
      base.uptimeSec =
        meta.uptime_sec != null ? Number(meta.uptime_sec) : null;
      base.maxConnections =
        meta.max_connections != null ? Number(meta.max_connections) : null;

      const conn = connRows?.[0];
      if (conn) {
        base.connections = {
          total: Number(conn.total ?? 0),
          active: Number(conn.active ?? 0),
          idle: Number(conn.idle ?? 0),
          idleInTransaction: Number(conn.idle_in_transaction ?? 0),
          waiting: Number(conn.waiting ?? 0),
        };
      }

      const hit = hitRows?.[0];
      if (hit) {
        const blksHit = Number(hit.blks_hit ?? 0);
        const blksRead = Number(hit.blks_read ?? 0);
        const denom = blksHit + blksRead;
        base.cacheHitRatioPercent =
          denom > 0 ? Math.round((blksHit / denom) * 1000) / 10 : null;
        base.transactionsCommitted = Number(hit.xact_commit ?? 0);
        base.transactionsRolledBack = Number(hit.xact_rollback ?? 0);
        base.deadlocks = Number(hit.deadlocks ?? 0);
      }

      base.topRelations = (topRows ?? []).map(
        (r: { schema: string; name: string; bytes: string | number }) => ({
          schema: String(r.schema),
          name: String(r.name),
          sizeMb: Math.round((Number(r.bytes) / (1024 * 1024)) * 100) / 100,
        }),
      );

      return base;
    } catch (e) {
      return {
        ...base,
        error: e instanceof Error ? e.message : 'DB stats query failed',
      };
    }
  }

  getMailStatus(): {
    configured: boolean;
    transport: 'mailgun' | 'smtp' | 'none';
    from: string;
  } {
    const mailgunKey =
      this.configService.get<string>('email.mailgunApiKey') ??
      process.env.MAILGUN_API_KEY;
    const mailgunDomain =
      this.configService.get<string>('email.mailgunDomain') ??
      process.env.MAILGUN_DOMAIN;
    const smtpUser =
      this.configService.get<string>('email.user') ?? process.env.EMAIL_USER;
    const smtpPass =
      this.configService.get<string>('email.password') ??
      process.env.EMAIL_PASSWORD;
    const useMailgun = Boolean(mailgunKey && mailgunDomain);
    const useSmtp = !useMailgun && Boolean(smtpUser && smtpPass);
    return {
      configured: useMailgun || useSmtp,
      transport: useMailgun ? 'mailgun' : useSmtp ? 'smtp' : 'none',
      from:
        this.configService.get<string>('email.from') ??
        process.env.EMAIL_FROM ??
        'noreply@vit.com',
    };
  }

  async sendMailTest(to: string): Promise<{ sent: boolean; configured: boolean }> {
    const status = this.getMailStatus();
    if (!status.configured) {
      return { sent: false, configured: false };
    }
    const result = await this.emailService.sendTestEmail(to);
    return { sent: result.sent, configured: true };
  }

  private sampleProcessCpuPercent(): number | null {
    const cpus = os.cpus();
    let idle = 0;
    let total = 0;
    for (const cpu of cpus) {
      idle += cpu.times.idle;
      total +=
        cpu.times.user +
        cpu.times.nice +
        cpu.times.sys +
        cpu.times.idle +
        cpu.times.irq;
    }
    const now = Date.now();
    const prev = this.lastCpuSample;
    this.lastCpuSample = { idle, total, at: now };
    if (!prev || now - prev.at < 200) return null;
    const idleDelta = idle - prev.idle;
    const totalDelta = total - prev.total;
    if (totalDelta <= 0) return null;
    return Math.round((1 - idleDelta / totalDelta) * 1000) / 10;
  }

  private async readCgroupMemory(): Promise<{
    usedMb: number | null;
    limitMb: number | null;
  }> {
    try {
      const current = await fs
        .readFile('/sys/fs/cgroup/memory.current', 'utf8')
        .catch(() =>
          fs.readFile('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8'),
        );
      const maxRaw = await fs
        .readFile('/sys/fs/cgroup/memory.max', 'utf8')
        .catch(() =>
          fs.readFile('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8'),
        );
      const used = Number(String(current).trim());
      const maxStr = String(maxRaw).trim();
      const max =
        maxStr === 'max' || maxStr === '' ? NaN : Number(maxStr);
      return {
        usedMb: Number.isFinite(used)
          ? Math.round(used / (1024 * 1024))
          : null,
        limitMb:
          Number.isFinite(max) && max < os.totalmem() * 2
            ? Math.round(max / (1024 * 1024))
            : null,
      };
    } catch {
      return { usedMb: null, limitMb: null };
    }
  }

  private async statfsMb(
    path: string,
  ): Promise<HostMetrics['disk']['root']> {
    try {
      // Node 18.15+
      const statfs = (
        fs as unknown as {
          statfs?: (
            p: string,
          ) => Promise<{ bsize: number; blocks: number; bavail: number }>;
        }
      ).statfs;
      if (!statfs) return null;
      const s = await statfs(path);
      const total = s.blocks * s.bsize;
      const free = s.bavail * s.bsize;
      const used = total - free;
      const totalMb = Math.round(total / (1024 * 1024));
      const freeMb = Math.round(free / (1024 * 1024));
      const usedMb = Math.round(used / (1024 * 1024));
      return {
        path,
        totalMb,
        freeMb,
        usedMb,
        usedPercent:
          totalMb > 0 ? Math.round((usedMb / totalMb) * 1000) / 10 : 0,
      };
    } catch (e) {
      this.logger.debug(
        `statfs failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  private async getDirSizeMb(dir: string): Promise<number> {
    let total = 0;
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const ent of entries) {
      const full = `${dir}/${ent.name}`;
      if (ent.isDirectory()) {
        total += await this.getDirSizeMb(full);
      } else {
        const s = await fs.stat(full).catch(() => null);
        if (s) total += s.size;
      }
    }
    return total / (1024 * 1024);
  }

  private async tryDockerStats(): Promise<HostMetrics['docker']> {
    const sock = '/var/run/docker.sock';
    try {
      await fs.access(sock);
    } catch {
      return { available: false };
    }
    try {
      const list = (await this.dockerApiGet(
        '/containers/json?all=true',
      )) as Array<{
        Names?: string[];
        Status?: string;
        Id?: string;
        State?: string;
      }>;
      const vit = (list ?? []).filter((c) =>
        (c.Names ?? []).some((n) => n.replace(/^\//, '').startsWith('vit_')),
      );
      const containers = await Promise.all(
        vit.map(async (c) => {
          const name =
            (c.Names?.[0] ?? '').replace(/^\//, '') || c.Id?.slice(0, 12) || 'unknown';
          let cpuPercent: number | null = null;
          let memUsageMb: number | null = null;
          let memLimitMb: number | null = null;
          try {
            const stats = (await this.dockerApiGet(
              `/containers/${c.Id}/stats?stream=false`,
            )) as {
              cpu_stats?: {
                cpu_usage?: { total_usage?: number };
                system_cpu_usage?: number;
                online_cpus?: number;
              };
              precpu_stats?: {
                cpu_usage?: { total_usage?: number };
                system_cpu_usage?: number;
              };
              memory_stats?: { usage?: number; limit?: number };
            };
            const cpuDelta =
              (stats.cpu_stats?.cpu_usage?.total_usage ?? 0) -
              (stats.precpu_stats?.cpu_usage?.total_usage ?? 0);
            const sysDelta =
              (stats.cpu_stats?.system_cpu_usage ?? 0) -
              (stats.precpu_stats?.system_cpu_usage ?? 0);
            const online = stats.cpu_stats?.online_cpus ?? os.cpus().length;
            if (sysDelta > 0 && cpuDelta >= 0) {
              cpuPercent =
                Math.round((cpuDelta / sysDelta) * online * 1000) / 10;
            }
            if (stats.memory_stats?.usage != null) {
              memUsageMb = Math.round(stats.memory_stats.usage / (1024 * 1024));
            }
            if (stats.memory_stats?.limit != null) {
              memLimitMb = Math.round(stats.memory_stats.limit / (1024 * 1024));
            }
          } catch {
            // stats optional per container
          }
          return {
            name,
            status: c.Status ?? c.State ?? '',
            cpuPercent,
            memUsageMb,
            memLimitMb,
          };
        }),
      );
      return { available: true, containers };
    } catch (e) {
      return {
        available: true,
        error: e instanceof Error ? e.message : 'docker API failed',
      };
    }
  }

  private dockerApiGet(path: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          socketPath: '/var/run/docker.sock',
          path,
          method: 'GET',
          timeout: 5000,
        },
        (res) => {
          const chunks: Buffer[] = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');
            if ((res.statusCode ?? 500) >= 400) {
              reject(new Error(`Docker API ${res.statusCode}: ${body.slice(0, 200)}`));
              return;
            }
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(err);
            }
          });
        },
      );
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Docker API timeout'));
      });
      req.end();
    });
  }
}
