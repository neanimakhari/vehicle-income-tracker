import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { EmailService } from '../modules/email/email.service';

@Injectable()
@Catch()
export class OpsAlertExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(OpsAlertExceptionFilter.name);
  private readonly lastSent = new Map<string, number>();

  constructor(
    private readonly emailService: EmailService,
    private readonly configService: ConfigService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;
    let message = 'Internal server error';
    if (typeof exceptionResponse === 'string') {
      message = exceptionResponse;
    } else if (
      exceptionResponse &&
      typeof exceptionResponse === 'object' &&
      'message' in exceptionResponse
    ) {
      const m = (exceptionResponse as { message?: string | string[] }).message;
      message = Array.isArray(m) ? m.join(' ') : (m ?? message);
    } else if (exception instanceof Error) {
      message = exception.message || message;
    }

    const stack =
      exception instanceof Error ? (exception.stack ?? '').slice(0, 4000) : '';

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}: ${message}`,
        stack || undefined,
      );
      void this.maybeAlert({
        method: request.method,
        path: request.path || request.url,
        status,
        message,
        stack,
      });
    }

    const body =
      exception instanceof HttpException
        ? exception.getResponse()
        : { statusCode: status, message: 'Internal server error' };

    response.status(status).json(
      typeof body === 'string'
        ? { statusCode: status, message: body }
        : body,
    );
  }

  private async maybeAlert(payload: {
    method: string;
    path: string;
    status: number;
    message: string;
    stack: string;
  }) {
    const enabled =
      this.configService.get<boolean>('ops.errorAlertEnabled') ??
      process.env.ERROR_ALERT_ENABLED !== 'false';
    if (!enabled) return;

    const throttleMs =
      this.configService.get<number>('ops.errorAlertThrottleMs') ??
      Number(process.env.ERROR_ALERT_THROTTLE_MS ?? 10 * 60 * 1000);
    const fingerprint = `${payload.status}|${payload.method}|${payload.path}|${payload.message}`.slice(
      0,
      300,
    );
    const now = Date.now();
    const last = this.lastSent.get(fingerprint) ?? 0;
    if (now - last < throttleMs) return;
    this.lastSent.set(fingerprint, now);

    try {
      await this.emailService.sendOpsAlert(payload);
    } catch (err) {
      this.logger.warn(`Ops alert email failed: ${(err as Error).message}`);
    }
  }
}
