import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenancyModule } from '../../tenancy/tenancy.module';
import { AuditModule } from '../audit/audit.module';
import { CommercialModule } from '../commercial/commercial.module';
import { TransportGroup } from './transport-group.entity';
import { TransportPassenger } from './transport-passenger.entity';
import { TransportAssignment } from './transport-assignment.entity';
import { TransportFeePause } from './transport-fee-pause.entity';
import { TransportBillingPeriod } from './transport-billing-period.entity';
import { TransportPaymentClaim } from './transport-payment-claim.entity';
import { TenantIncome } from '../tenant-incomes/tenant-income.entity';
import { TenantVehicle } from '../tenant-vehicles/tenant-vehicle.entity';
import { TenantTransportService } from './tenant-transport.service';
import { TenantTransportController } from './tenant-transport.controller';

@Module({
  imports: [
    TenancyModule,
    AuditModule,
    CommercialModule,
    TypeOrmModule.forFeature([
      TransportGroup,
      TransportPassenger,
      TransportAssignment,
      TransportFeePause,
      TransportBillingPeriod,
      TransportPaymentClaim,
      TenantIncome,
      TenantVehicle,
    ]),
  ],
  controllers: [TenantTransportController],
  providers: [TenantTransportService],
  exports: [TenantTransportService],
})
export class TenantTransportModule {}
