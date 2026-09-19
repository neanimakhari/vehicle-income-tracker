import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TenantEventsGateway } from './tenant-events.gateway';
import { TenantEventsService } from './tenant-events.service';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('auth.jwtSecret') ?? process.env.JWT_SECRET,
      }),
    }),
    forwardRef(() => WebhooksModule),
  ],
  providers: [TenantEventsGateway, TenantEventsService],
  exports: [TenantEventsService],
})
export class TenantEventsModule {}
