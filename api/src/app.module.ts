import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { TenantAwareThrottlerGuard } from './common/tenant-aware-throttler.guard';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { DatabaseModule } from './database/database.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { TenantContextMiddleware } from './tenancy/tenant-context.middleware';
import { AuthModule } from './auth/auth.module';
import { TenantUsersModule } from './modules/tenant-users/tenant-users.module';
import { TenantIncomesModule } from './modules/tenant-incomes/tenant-incomes.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { TenantAdminModule } from './tenant-admin/tenant-admin.module';
import { TenantVehiclesModule } from './modules/tenant-vehicles/tenant-vehicles.module';
import { TenantExpensesModule } from './modules/tenant-expenses/tenant-expenses.module';
import { TenantReportsModule } from './modules/tenant-reports/tenant-reports.module';
import { HealthModule } from './health/health.module';
import { TenantMaintenanceModule } from './modules/tenant-maintenance/tenant-maintenance.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      envFilePath: ['.env', 'api/.env'],
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('rateLimit.ttl') ?? 60,
            limit: configService.get<number>('rateLimit.limit') ?? 100,
          },
        ],
      }),
    }),
    DatabaseModule,
    AuthModule,
    TenantsModule,
    TenancyModule,
    TenantUsersModule,
    TenantIncomesModule,
    TenantVehiclesModule,
    TenantExpensesModule,
    TenantReportsModule,
    TenantMaintenanceModule,
    WebhooksModule,
    PlatformAdminModule,
    TenantAdminModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: TenantAwareThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantContextMiddleware).forRoutes('*');
  }
}
