import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Inject,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { ThrottlerException } from '@nestjs/throttler';
import { ThrottlerStorage } from '@nestjs/throttler';
import { TenantContextService } from '../tenancy/tenant-context.service';

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

@Injectable()
export class TenantAwareThrottlerGuard implements CanActivate {
  constructor(
    @Inject(ThrottlerStorage)
    private readonly storage: ThrottlerStorage,
    private readonly configService: ConfigService,
    private readonly tenantContext: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { ip?: string; user?: { sub?: string; id?: string } }>();
    const res = context.switchToHttp().getResponse<{ header: (name: string, value: string | number) => void }>();
    const ttl = this.configService.get<number>('rateLimit.ttl') ?? 60;
    const perTenantLimit = this.configService.get<number>('rateLimit.perTenantLimit') ?? 500;
    const perUserLimit = this.configService.get<number>('rateLimit.perUserLimit') ?? 100;
    const blockDuration = 0;

    const tenantId = this.tenantContext.getTenantId();
    const userId = req.user?.sub ?? req.user?.id;
    const ip = req.ip ?? 'unknown';
    const tenantKey = sha256(`tenant-${tenantId ?? 'anon'}`);
    const userKey = sha256(`user-${userId ?? ip}`);

    const [tenantRecord, userRecord] = await Promise.all([
      this.storage.increment(tenantKey, ttl, perTenantLimit, blockDuration, 'tenant'),
      this.storage.increment(userKey, ttl, perUserLimit, blockDuration, 'user'),
    ]);

    if (tenantRecord.isBlocked) {
      if (tenantRecord.timeToBlockExpire) {
        res.header('Retry-After', String(tenantRecord.timeToBlockExpire));
      }
      throw new ThrottlerException('Too many requests for this tenant. Try again later.');
    }
    if (userRecord.isBlocked) {
      if (userRecord.timeToBlockExpire) {
        res.header('Retry-After', String(userRecord.timeToBlockExpire));
      }
      throw new ThrottlerException('Too many requests. Try again later.');
    }

    res.header('X-RateLimit-Limit-Tenant', String(perTenantLimit));
    res.header('X-RateLimit-Remaining-Tenant', String(Math.max(0, perTenantLimit - tenantRecord.totalHits)));
    res.header('X-RateLimit-Limit-User', String(perUserLimit));
    res.header('X-RateLimit-Remaining-User', String(Math.max(0, perUserLimit - userRecord.totalHits)));
    return true;
  }
}

