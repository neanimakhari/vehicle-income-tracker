import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { createReadStream, existsSync, readFileSync, statSync } from 'fs';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Tenant } from '../tenants/tenant.entity';
import { TenantUser } from './tenant-user.entity';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { TenantAwareRepository } from '../../tenancy/tenant-aware.repository';

type TicketPayload = {
  jti: string;
  userId: string;
  tenantId: string;
  versionCode: number;
  channel: string;
  exp: number;
};

type InvitePayload = {
  jti: string;
  userId: string;
  tenantId: string;
  email: string;
  exp: number;
};

@Injectable()
export class MobileAppDownloadService {
  private readonly consumedTickets = new Set<string>();
  private readonly ticketHits = new Map<string, number[]>();
  private readonly inviteHits = new Map<string, number[]>();

  constructor(
    private readonly config: ConfigService,
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly audit: AuditService,
    private readonly email: EmailService,
  ) {}

  private tenantUsers() {
    return new TenantAwareRepository(this.dataSource, this.tenantScope, TenantUser);
  }

  getLatestMeta(channel = 'prod') {
    const isStaging = channel === 'staging';
    return {
      platform: 'android' as const,
      channel: isStaging ? 'staging' : 'prod',
      versionName:
        (isStaging
          ? this.config.get<string>('ops.mobileAppStagingVersionName')
          : this.config.get<string>('ops.mobileAppVersionName')) ??
        process.env.MOBILE_APP_VERSION_NAME ??
        '1.0.2',
      versionCode: Number(
        (isStaging
          ? this.config.get<number>('ops.mobileAppStagingVersionCode')
          : this.config.get<number>('ops.mobileAppVersionCode')) ??
          process.env.MOBILE_APP_VERSION_CODE ??
          3,
      ),
      minSupportedVersionCode: Number(
        this.config.get<number>('ops.mobileAppMinVersionCode') ??
          process.env.MOBILE_APP_MIN_VERSION_CODE ??
          1,
      ),
      sha256:
        (isStaging
          ? this.config.get<string>('ops.mobileAppStagingSha256')
          : this.config.get<string>('ops.mobileAppSha256')) ??
        process.env.MOBILE_APP_APK_SHA256 ??
        '',
      releaseNotes:
        process.env.MOBILE_APP_RELEASE_NOTES ??
        'Bug fixes and improvements.',
      publishedAt: new Date().toISOString(),
    };
  }

  private secret(): string {
    return (
      this.config.get<string>('ops.mobileAppDownloadSecret') ??
      process.env.MOBILE_APP_DOWNLOAD_SECRET ??
      this.config.get<string>('auth.jwtSecret') ??
      process.env.JWT_SECRET ??
      'vit-mobile-download'
    );
  }

  private sign(payloadB64: string): string {
    return createHmac('sha256', this.secret()).update(payloadB64).digest('base64url');
  }

  private encode<T extends object>(payload: T): string {
    const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${payloadB64}.${this.sign(payloadB64)}`;
  }

  private decode<T>(token: string): T {
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) throw new UnauthorizedException('Invalid ticket');
    const expected = this.sign(payloadB64);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Invalid ticket');
    }
    return JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as T;
  }

  private rateLimit(map: Map<string, number[]>, key: string, max: number, windowMs: number) {
    const now = Date.now();
    const arr = (map.get(key) ?? []).filter((t) => now - t < windowMs);
    if (arr.length >= max) {
      throw new HttpException(
        'Too many download requests. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    arr.push(now);
    map.set(key, arr);
  }

  private apkPath(channel: string): string {
    if (channel === 'staging') {
      return (
        this.config.get<string>('ops.mobileAppStagingApkPath') ??
        process.env.MOBILE_APP_STAGING_APK_PATH ??
        '/var/www/vit-app-private-staging/releases/vit-latest.apk'
      );
    }
    return (
      this.config.get<string>('ops.mobileAppApkPath') ??
      process.env.MOBILE_APP_APK_PATH ??
      '/var/www/vit-app-private/releases/vit-latest.apk'
    );
  }

  private apiPublicBase(): string {
    return (
      this.config.get<string>('ops.apiPublicUrl') ??
      process.env.API_PUBLIC_URL ??
      'https://vit-api.vehinc.co.za/v1'
    ).replace(/\/$/, '');
  }

  async createDownloadTicket(actor: {
    sub: string;
    email: string;
    role: string;
    tenantId: string;
  }, channel = 'prod') {
    if (actor.role !== 'TENANT_USER') {
      throw new ForbiddenException('Only drivers can download the app');
    }
    this.rateLimit(this.ticketHits, `${actor.tenantId}:${actor.sub}`, 5, 60 * 60 * 1000);

    const tenant = await this.tenants.findOne({ where: { slug: actor.tenantId } });
    if (!tenant?.isActive) throw new ForbiddenException('Tenant is not active');

    const user = await this.tenantUsers().withSchema((repo) =>
      repo.findOne({ where: { id: actor.sub } }),
    );
    if (!user?.isActive) throw new ForbiddenException('Account is not active');

    const meta = this.getLatestMeta(channel);
    const jti = randomBytes(16).toString('hex');
    const exp = Math.floor(Date.now() / 1000) + 10 * 60;
    const ticket = this.encode<TicketPayload>({
      jti,
      userId: actor.sub,
      tenantId: actor.tenantId,
      versionCode: meta.versionCode,
      channel: meta.channel,
      exp,
    });

    await this.audit.log({
      action: 'mobile_app.download_ticket',
      actorUserId: actor.sub,
      actorRole: actor.role,
      targetType: 'mobile_app',
      targetId: String(meta.versionCode),
      metadata: { tenantId: actor.tenantId, email: actor.email, channel: meta.channel },
    });

    return {
      ticket,
      downloadUrl: `${this.apiPublicBase()}/tenant/mobile-app/download?ticket=${encodeURIComponent(ticket)}`,
      expiresAt: new Date(exp * 1000).toISOString(),
      ...meta,
    };
  }

  openDownloadStream(ticket: string) {
    const payload = this.decode<TicketPayload>(ticket);
    if (payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Download link expired');
    }
    if (this.consumedTickets.has(payload.jti)) {
      throw new UnauthorizedException('Download link already used');
    }
    this.consumedTickets.add(payload.jti);

    const path = this.apkPath(payload.channel);
    if (!existsSync(path)) {
      throw new NotFoundException('App package not available yet. Contact your admin.');
    }
    const stat = statSync(path);
    const stream = createReadStream(path);

    void this.audit.log({
      action: 'mobile_app.download',
      actorUserId: payload.userId,
      actorRole: 'TENANT_USER',
      targetType: 'mobile_app',
      targetId: String(payload.versionCode),
      metadata: { tenantId: payload.tenantId, channel: payload.channel, bytes: stat.size },
    });

    return {
      stream,
      size: stat.size,
      filename: `vit-${payload.channel}-${payload.versionCode}.apk`,
      sha256: this.getLatestMeta(payload.channel).sha256,
    };
  }

  async createInstallInvite(admin: {
    sub: string;
    role: string;
    tenantId: string;
  }, driverUserId: string) {
    if (admin.role !== 'TENANT_ADMIN') {
      throw new ForbiddenException();
    }
    this.rateLimit(this.inviteHits, `${admin.tenantId}:${admin.sub}`, 20, 60 * 60 * 1000);

    const user = await this.tenantUsers().withSchema((repo) =>
      repo.findOne({ where: { id: driverUserId } }),
    );
    if (!user) {
      throw new NotFoundException('Driver not found');
    }
    const tenant = await this.tenants.findOne({ where: { slug: admin.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');

    const jti = randomBytes(16).toString('hex');
    const exp = Math.floor(Date.now() / 1000) + 48 * 60 * 60;
    const token = this.encode<InvitePayload>({
      jti,
      userId: user.id,
      tenantId: admin.tenantId,
      email: user.email,
      exp,
    });
    const appBase =
      this.config.get<string>('ops.vitAppUrl') ??
      process.env.VIT_APP_URL ??
      'https://vit-app.vehinc.co.za';
    const inviteUrl = `${appBase.replace(/\/$/, '')}/?invite=${encodeURIComponent(token)}`;

    await this.email.sendAppInstallInvite(user.email, tenant.name, inviteUrl);
    await this.audit.log({
      action: 'mobile_app.install_invite',
      actorUserId: admin.sub,
      actorRole: admin.role,
      targetType: 'tenant_user',
      targetId: user.id,
      metadata: { email: user.email, tenantId: admin.tenantId },
    });

    return { sent: true, email: user.email, expiresAt: new Date(exp * 1000).toISOString() };
  }

  resolveInvite(token: string): { tenantId: string; email: string; exp: number } {
    const payload = this.decode<InvitePayload>(token);
    if (payload.exp * 1000 < Date.now()) {
      throw new UnauthorizedException('Invite expired');
    }
    if (this.consumedTickets.has(`invite:${payload.jti}`)) {
      throw new UnauthorizedException('Invite already used');
    }
    return { tenantId: payload.tenantId, email: payload.email, exp: payload.exp };
  }

  markInviteUsed(token: string) {
    const payload = this.decode<InvitePayload>(token);
    this.consumedTickets.add(`invite:${payload.jti}`);
  }

  static fileSha256(path: string): string {
    const hash = createHash('sha256');
    hash.update(readFileSync(path));
    return hash.digest('hex');
  }
}
