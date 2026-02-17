import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './audit.entity';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { TenantAuditController } from './tenant-audit.controller';
import { TenancyModule } from '../../tenancy/tenancy.module';

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), TenancyModule],
  controllers: [AuditController, TenantAuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}

