import 'dotenv/config';
import { DataSource } from 'typeorm';
import { AuthUser } from '../auth/auth-user.entity';
import { Tenant } from '../modules/tenants/tenant.entity';
import { AuditLog } from '../modules/audit/audit.entity';
import { InitPlatform1700000000000 } from './migrations/1700000000000-init-platform';
import { AddIncomeDetails1700000000001 } from './migrations/1700000000001-add-income-details';
import { AddAuthMfa1700000000002 } from './migrations/1700000000002-add-auth-mfa';
import { AddTenantMfaPolicy1700000000003 } from './migrations/1700000000003-add-tenant-mfa-policy';
import { AddTenantUserMfa1700000000004 } from './migrations/1700000000004-add-tenant-user-mfa';
import { AddTenantUserMfaPolicy1700000000005 } from './migrations/1700000000005-add-tenant-user-mfa-policy';
import { AddTenantSecuritySettings1700000000006 } from './migrations/1700000000006-add-tenant-security-settings';
import { AddAuthSecurityFields1700000000007 } from './migrations/1700000000007-add-auth-security-fields';
import { AddTenantUserSecurityFields1700000000008 } from './migrations/1700000000008-add-tenant-user-security-fields';
import { AddDeviceBindings1700000000009 } from './migrations/1700000000009-add-device-bindings';
import { AddRefreshTokens1700000000010 } from './migrations/1700000000010-add-refresh-tokens';
import { AddDriverProfileFields1700000000011 } from './migrations/1700000000011-add-driver-profile-fields';
import { AddProfilePicture1700000000012 } from './migrations/1700000000012-add-profile-picture';
import { AddVehicleDocumentationFields1700000000013 } from './migrations/1700000000013-add-vehicle-documentation-fields';
import { AddTenantBusinessFields1700000000014 } from './migrations/1700000000014-add-tenant-business-fields';
import { AddTenantLimits1700000000015 } from './migrations/1700000000015-add-tenant-limits';
import { AddAuthUserPasswordReset1700000000016 } from './migrations/1700000000016-add-auth-user-password-reset';
import { AddWebhookSubscriptions1700000000017 } from './migrations/1700000000017-add-webhook-subscriptions';
import { ProfilePictureText1700000000018 } from './migrations/1700000000018-profile-picture-text';
import { AddExpenseReceiptImage1700000000019 } from './migrations/1700000000019-add-expense-receipt-image';
import { AddIncomeApprovalStatus1700000000020 } from './migrations/1700000000020-add-income-approval-status';
import { AddDriverExpiryUpdateRequests1700000000021 } from './migrations/1700000000021-add-driver-expiry-update-requests';

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 5432),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_DATABASE ?? 'vit_platform',
  schema: process.env.DB_DEFAULT_SCHEMA ?? 'platform',
  entities: [AuthUser, Tenant, AuditLog],
  migrations: [
    InitPlatform1700000000000,
    AddIncomeDetails1700000000001,
    AddAuthMfa1700000000002,
    AddTenantMfaPolicy1700000000003,
    AddTenantUserMfa1700000000004,
    AddTenantUserMfaPolicy1700000000005,
    AddTenantSecuritySettings1700000000006,
    AddAuthSecurityFields1700000000007,
    AddTenantUserSecurityFields1700000000008,
    AddDeviceBindings1700000000009,
    AddRefreshTokens1700000000010,
    AddDriverProfileFields1700000000011,
    AddProfilePicture1700000000012,
    AddVehicleDocumentationFields1700000000013,
    AddTenantBusinessFields1700000000014,
    AddTenantLimits1700000000015,
    AddAuthUserPasswordReset1700000000016,
    AddWebhookSubscriptions1700000000017,
    ProfilePictureText1700000000018,
    AddExpenseReceiptImage1700000000019,
    AddIncomeApprovalStatus1700000000020,
    AddDriverExpiryUpdateRequests1700000000021,
  ],
});

