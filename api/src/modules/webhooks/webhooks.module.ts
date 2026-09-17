import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { WebhookSubscription } from './webhook-subscription.entity';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';
import { CommercialModule } from '../commercial/commercial.module';

@Module({
  imports: [
    TenancyModule,
    TypeOrmModule.forFeature([WebhookSubscription]),
    CommercialModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
