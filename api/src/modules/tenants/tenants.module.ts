import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './tenant.entity';
import { TenantSlaDocument } from './tenant-sla-document.entity';
import { TenantReportRecipient } from './tenant-report-recipient.entity';
import { DailyTargetRule } from './daily-target-rule.entity';
import { BrandKit } from './brand-kit.entity';
import { TenantBrandSnapshot } from './tenant-brand-snapshot.entity';
import { TenantBrandPreviewToken } from './tenant-brand-preview-token.entity';
import { TenantsController } from './tenants.controller';
import { TenantPolicyController } from './tenant-policy.controller';
import { BrandController } from './brand.controller';
import { TenantsService } from './tenants.service';
import { BrandService } from './brand.service';
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
      BrandKit,
      TenantBrandSnapshot,
      TenantBrandPreviewToken,
    ]),
    AuditModule,
    EmailModule,
    forwardRef(() => TenancyModule),
    forwardRef(() => CommercialModule),
  ],
  controllers: [
    TenantsController,
    TenantPolicyController,
    BrandController,
    PublicTenantsController,
    TenantReportRecipientsController,
    DailyTargetRulesController,
  ],
  providers: [
    TenantsService,
    BrandService,
    TenantSchemasService,
    TenantReportRecipientsService,
    DailyTargetRulesService,
  ],
  exports: [
    TenantsService,
    BrandService,
    TenantSchemasService,
    TenantReportRecipientsService,
    DailyTargetRulesService,
  ],
})
export class TenantsModule {}
