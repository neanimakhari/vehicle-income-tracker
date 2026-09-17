import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { TenantSlaDocument } from './tenant-sla-document.entity';
import { TenantReportRecipient } from './tenant-report-recipient.entity';
import { DailyTargetRule } from './daily-target-rule.entity';
import { TenantsController } from './tenants.controller';
import { TenantPolicyController } from './tenant-policy.controller';
import { TenantsService } from './tenants.service';
import { TenantSchemasService } from './tenants.schemas.service';
import { AuditModule } from '../audit/audit.module';
import { EmailModule } from '../email/email.module';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { PublicTenantsController } from './public-tenants.controller';
import { TenantReportRecipientsController } from './tenant-report-recipients.controller';
import { TenantReportRecipientsService } from './tenant-report-recipients.service';
import { DailyTargetRulesController } from './daily-target-rules.controller';
import { DailyTargetRulesService } from './daily-target-rules.service';
import { CommercialModule } from '../commercial/commercial.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      TenantSlaDocument,
      TenantReportRecipient,
      DailyTargetRule,
    ]),
    AuditModule,
    EmailModule,
    forwardRef(() => TenancyModule),
    forwardRef(() => CommercialModule),
  ],
  controllers: [
    TenantsController,
    TenantPolicyController,
    PublicTenantsController,
    TenantReportRecipientsController,
    DailyTargetRulesController,
  ],
  providers: [
    TenantsService,
    TenantSchemasService,
    TenantReportRecipientsService,
    DailyTargetRulesService,
  ],
  exports: [
    TenantsService,
    TenantSchemasService,
    TenantReportRecipientsService,
    DailyTargetRulesService,
  ],
})
export class TenantsModule {}

