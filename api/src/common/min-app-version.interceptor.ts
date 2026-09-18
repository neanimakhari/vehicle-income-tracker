import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

/**
 * If client sends X-App-Version-Code below minSupportedVersionCode, block with UPDATE_REQUIRED.
 */
@Injectable()
export class MinAppVersionInterceptor implements NestInterceptor {
  constructor(private readonly config: ConfigService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{
      header: (name: string) => string | undefined;
      path?: string;
      url?: string;
    }>();
    const path = req.path || req.url || '';
    // Allow login, public, and download endpoints without version gate
    if (
      path.includes('/public/') ||
      path.includes('/tenant/auth/login') ||
      path.includes('/tenant/mobile-app/download') ||
      path.includes('/health')
    ) {
      return next.handle();
    }

    const raw = req.header('x-app-version-code');
    if (!raw) return next.handle();

    const clientCode = Number(raw);
    const min = Number(
      this.config.get<number>('ops.mobileAppMinVersionCode') ??
        process.env.MOBILE_APP_MIN_VERSION_CODE ??
        1,
    );
    if (Number.isFinite(clientCode) && clientCode < min) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'UPDATE_REQUIRED',
        message: `Please update the VIT app to continue (minimum version code ${min}).`,
        minSupportedVersionCode: min,
      });
    }
    return next.handle();
  }
}
