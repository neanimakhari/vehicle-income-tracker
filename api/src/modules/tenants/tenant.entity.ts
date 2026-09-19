import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity({ name: 'tenants', schema: 'platform' })
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'require_mfa', default: false })
  requireMfa: boolean;

  @Column({ name: 'require_mfa_users', default: false })
  requireMfaUsers: boolean;

  @Column({ name: 'require_biometrics', default: false })
  requireBiometrics: boolean;

  @Column({ name: 'session_timeout_minutes', type: 'int', nullable: true })
  sessionTimeoutMinutes: number | null;

  @Column({ name: 'enforce_ip_allowlist', default: false })
  enforceIpAllowlist: boolean;

  @Column({ name: 'allowed_ips', type: 'text', array: true, nullable: true })
  allowedIps: string[] | null;

  @Column({ name: 'enforce_device_allowlist', default: false })
  enforceDeviceAllowlist: boolean;

  // Business / contact info
  @Column({ name: 'contact_name', type: 'varchar', nullable: true })
  contactName: string | null;

  @Column({ name: 'contact_email', type: 'varchar', nullable: true })
  contactEmail: string | null;

  @Column({ name: 'contact_phone', type: 'varchar', nullable: true })
  contactPhone: string | null;

  @Column({ name: 'address', type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'registration_number', type: 'varchar', nullable: true })
  registrationNumber: string | null;

  @Column({ name: 'tax_id', type: 'varchar', nullable: true })
  taxId: string | null;

  @Column({ name: 'website', type: 'varchar', nullable: true })
  website: string | null;

  @Column({ name: 'notes', type: 'text', nullable: true })
  notes: string | null;

  @Column({ name: 'max_drivers', type: 'int', nullable: true })
  maxDrivers: number | null;

  @Column({ name: 'max_storage_mb', type: 'int', nullable: true })
  maxStorageMb: number | null;

  @Column({ name: 'feature_flags', type: 'text', array: true, default: '{}' })
  featureFlags: string[];

  @Column({ name: 'missing_income_reminder_enabled', default: true })
  missingIncomeReminderEnabled: boolean;

  @Column({ name: 'missing_income_cutoff_hour', type: 'int', default: 21 })
  missingIncomeCutoffHour: number;

  @Column({
    name: 'missing_income_timezone',
    type: 'varchar',
    default: 'Africa/Johannesburg',
  })
  missingIncomeTimezone: string;

  @Column({ name: 'missing_income_escalation_enabled', default: true })
  missingIncomeEscalationEnabled: boolean;

  @Column({ name: 'missing_income_escalation_hour', type: 'int', default: 8 })
  missingIncomeEscalationHour: number;

  /** Default daily income target (ZAR) applied when a driver has no personal target */
  @Column({ name: 'default_daily_target_amount', type: 'numeric', nullable: true, default: null })
  defaultDailyTargetAmount: number | null;

  /** When false, SYS accounts cannot Enter this tenant (PLATFORM_ADMIN still can). */
  @Column({ name: 'allow_sys_enter', default: true })
  allowSysEnter: boolean;

  /** Live brand: vit_default | custom */
  @Column({ name: 'brand_mode', default: 'vit_default' })
  brandMode: string;

  @Column({ name: 'brand_display_name', type: 'varchar', nullable: true })
  brandDisplayName: string | null;

  @Column({ name: 'brand_primary_hex', type: 'varchar', length: 7, nullable: true })
  brandPrimaryHex: string | null;

  @Column({ name: 'brand_accent_hex', type: 'varchar', length: 7, nullable: true })
  brandAccentHex: string | null;

  @Column({ name: 'brand_sidebar_style', default: 'colored' })
  brandSidebarStyle: string;

  @Column({ name: 'brand_font_family', type: 'varchar', nullable: true })
  brandFontFamily: string | null;

  @Column({ name: 'brand_border_radius', type: 'varchar', nullable: true })
  brandBorderRadius: string | null;

  @Column({ name: 'brand_density', type: 'varchar', nullable: true })
  brandDensity: string | null;

  @Column({ name: 'brand_primary_dark_hex', type: 'varchar', length: 7, nullable: true })
  brandPrimaryDarkHex: string | null;

  @Column({ name: 'brand_logo_path', type: 'varchar', nullable: true })
  brandLogoPath: string | null;

  @Column({ name: 'brand_logo_mime', type: 'varchar', nullable: true })
  brandLogoMime: string | null;

  @Column({ name: 'brand_logo_data', type: 'text', nullable: true })
  brandLogoData: string | null;

  @Column({ name: 'brand_login_bg_path', type: 'varchar', nullable: true })
  brandLoginBgPath: string | null;

  @Column({ name: 'brand_login_bg_mime', type: 'varchar', nullable: true })
  brandLoginBgMime: string | null;

  @Column({ name: 'brand_login_bg_data', type: 'text', nullable: true })
  brandLoginBgData: string | null;

  @Column({ name: 'brand_draft_json', type: 'jsonb', nullable: true })
  brandDraftJson: Record<string, unknown> | null;

  @Column({ name: 'brand_kit_id', type: 'uuid', nullable: true })
  brandKitId: string | null;

  @Column({ name: 'brand_updated_at', type: 'timestamptz', nullable: true })
  brandUpdatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
