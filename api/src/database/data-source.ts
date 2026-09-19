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
import { EnsureIncomeApprovalColumns1700000000022 } from './migrations/1700000000022-ensure-income-approval-columns';
import { AddMustChangePassword1700000000023 } from './migrations/1700000000023-add-must-change-password';
import { AddMissingIncomeReminderSettings1700000000024 } from './migrations/1700000000024-add-missing-income-reminder-settings';
import { AddVehicleDocumentsAndMaintenanceProofs1700000000025 } from './migrations/1700000000025-add-vehicle-documents-and-maintenance-proofs';
import { AddMultiEntryLogColumns1700000000026 } from './migrations/1700000000026-add-multi-entry-log-columns';
import { AddNotificationsAndFeatureFlags1700000000027 } from './migrations/1700000000027-add-notifications-and-feature-flags';
import { AddPaymentsTripsAndIncomeStreams1700000000028 } from './migrations/1700000000028-add-payments-trips-and-income-streams';
import { AddGpsTrackingPoints1700000000029 } from './migrations/1700000000029-add-gps-tracking-points';
import { AddPlatformTenantSlaDocuments1700000000030 } from './migrations/1700000000030-add-platform-tenant-sla-documents';
import { AddDailyIncomeTargets1700000000031 } from './migrations/1700000000031-add-daily-income-targets';
import { AddReportRecipientsAndTargetRules1700000000032 } from './migrations/1700000000032-add-report-recipients-and-target-rules';
import { AddCommercialPackagingAndSys1700000000033 } from './migrations/1700000000033-add-commercial-packaging-and-sys';
import { AddScholarStaffTransport1700000000034 } from './migrations/1700000000034-add-scholar-staff-transport';
import { AddPlatformSettingsAndSysEnter1700000000035 } from './migrations/1700000000035-add-platform-settings-and-sys-enter';
import { AddDriverEmailIndex1700000000036 } from './migrations/1700000000036-add-driver-email-index';
import { AddTenantBranding1700000000037 } from './migrations/1700000000037-add-tenant-branding';
import { BrandDepthUpgrade1700000000038 } from './migrations/1700000000038-brand-depth-upgrade';
import { AddGpsTrackingDepth1700000000039 } from './migrations/1700000000039-add-gps-tracking-depth';

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
    EnsureIncomeApprovalColumns1700000000022,
    AddMustChangePassword1700000000023,
    AddMissingIncomeReminderSettings1700000000024,
    AddVehicleDocumentsAndMaintenanceProofs1700000000025,
    AddMultiEntryLogColumns1700000000026,
    AddNotificationsAndFeatureFlags1700000000027,
    AddPaymentsTripsAndIncomeStreams1700000000028,
    AddGpsTrackingPoints1700000000029,
    AddPlatformTenantSlaDocuments1700000000030,
    AddDailyIncomeTargets1700000000031,
    AddReportRecipientsAndTargetRules1700000000032,
    AddCommercialPackagingAndSys1700000000033,
    AddScholarStaffTransport1700000000034,
    AddPlatformSettingsAndSysEnter1700000000035,
    AddDriverEmailIndex1700000000036,
    AddTenantBranding1700000000037,
    BrandDepthUpgrade1700000000038,
    AddGpsTrackingDepth1700000000039,
  ],
});
