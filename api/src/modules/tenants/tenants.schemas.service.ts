import { Injectable, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class TenantSchemasService {
  constructor(private readonly dataSource: DataSource) {}

  async ensureTenantSchema(slug: string): Promise<void> {
    const schemaName = this.toSchemaName(slug);
    await this.dataSource.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."users" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "first_name" varchar NOT NULL,
        "last_name" varchar NOT NULL,
        "email" varchar NOT NULL UNIQUE,
        "phone_number" varchar NULL,
        "password_hash" varchar NOT NULL,
        "mfa_enabled" boolean NOT NULL DEFAULT false,
        "mfa_secret" varchar NULL,
        "failed_login_attempts" int NOT NULL DEFAULT 0,
        "locked_until" timestamptz NULL DEFAULT NULL,
        "last_login_ip" varchar NULL DEFAULT NULL,
        "last_login_at" timestamptz NULL DEFAULT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "id_number" varchar NULL,
        "passport_number" varchar NULL,
        "date_of_birth" date NULL,
        "license_number" varchar NULL,
        "license_expiry" date NULL,
        "prdp_number" varchar NULL,
        "prdp_expiry" date NULL,
        "medical_certificate_expiry" date NULL,
        "bank_name" varchar NULL,
        "bank_account_number" varchar NULL,
        "bank_branch_code" varchar NULL,
        "account_holder_name" varchar NULL,
        "salary" numeric NULL,
        "daily_target_amount" numeric NULL,
        "address" text NULL,
               "emergency_contact_name" varchar NULL,
               "emergency_contact_phone" varchar NULL,
               "profile_picture" text NULL,
               "password_reset_token" varchar NULL,
               "password_reset_expires" timestamptz NULL,
               "email_verified" boolean NOT NULL DEFAULT false,
               "email_verification_token" varchar NULL,
               "email_verification_expires" timestamptz NULL,
               "must_change_password" boolean NOT NULL DEFAULT true,
               "created_at" timestamptz NOT NULL DEFAULT now(),
               "updated_at" timestamptz NOT NULL DEFAULT now()
             )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."driver_documents" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "document_type" varchar NOT NULL,
        "file_name" varchar NOT NULL,
        "file_path" varchar NOT NULL,
        "file_size" int NOT NULL,
        "mime_type" varchar NOT NULL,
        "uploaded_by" varchar NULL,
        "notes" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "FK_driver_documents_user_id" FOREIGN KEY ("user_id") REFERENCES "${schemaName}"."users"("id") ON DELETE CASCADE
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."vehicle_incomes" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vehicle" varchar NOT NULL,
        "driver_name" varchar NOT NULL,
        "income" numeric NOT NULL DEFAULT 0,
        "starting_km" int NULL DEFAULT NULL,
        "end_km" int NULL DEFAULT NULL,
        "petrol_poured" numeric NULL DEFAULT NULL,
        "petrol_litres" numeric NULL DEFAULT NULL,
        "expense_detail" varchar NULL DEFAULT NULL,
        "expense_price" numeric NULL DEFAULT NULL,
        "expense_image" text NULL DEFAULT NULL,
        "petrol_slip" text NULL DEFAULT NULL,
        "petrol_logs" text NULL DEFAULT NULL,
        "expense_logs" text NULL DEFAULT NULL,
        "income_logs" text NULL DEFAULT NULL,
        "income_stream" varchar NOT NULL DEFAULT 'general',
        "trip_id" uuid NULL DEFAULT NULL,
        "scholar_payment_id" uuid NULL DEFAULT NULL,
        "driver_id" uuid NULL DEFAULT NULL,
        "logged_on" timestamptz NOT NULL,
        "approval_status" varchar(20) NOT NULL DEFAULT 'auto',
        "approved_at" timestamptz NULL DEFAULT NULL,
        "approved_by" uuid NULL DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."trips" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vehicle_id" uuid NULL DEFAULT NULL,
        "driver_id" uuid NULL DEFAULT NULL,
        "status" varchar(30) NOT NULL DEFAULT 'scheduled',
        "trip_type" varchar NOT NULL DEFAULT 'general',
        "pickup_location" varchar NULL DEFAULT NULL,
        "dropoff_location" varchar NULL DEFAULT NULL,
        "scheduled_at" timestamptz NULL DEFAULT NULL,
        "started_at" timestamptz NULL DEFAULT NULL,
        "completed_at" timestamptz NULL DEFAULT NULL,
        "fare_amount" numeric NULL DEFAULT NULL,
        "distance_km" numeric NULL DEFAULT NULL,
        "notes" text NULL DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."scholar_payments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "scholar_name" varchar NOT NULL,
        "guardian_name" varchar NULL DEFAULT NULL,
        "amount" numeric NOT NULL DEFAULT 0,
        "status" varchar NOT NULL DEFAULT 'pending',
        "due_date" date NULL DEFAULT NULL,
        "paid_at" timestamptz NULL DEFAULT NULL,
        "notes" text NULL DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `ALTER TABLE "${schemaName}"."vehicles" ADD COLUMN IF NOT EXISTS "seat_capacity" int NULL`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."transport_groups" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "kind" varchar NOT NULL DEFAULT 'school',
        "default_amount" numeric NOT NULL DEFAULT 0,
        "cadence" varchar NOT NULL DEFAULT 'monthly',
        "due_day" int NULL,
        "grace_days" int NOT NULL DEFAULT 7,
        "notes" text NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."transport_passengers" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "type" varchar NOT NULL DEFAULT 'scholar',
        "name" varchar NOT NULL,
        "contact_name" varchar NULL,
        "phone" varchar NULL,
        "notes" text NULL,
        "household_id" uuid NULL,
        "group_id" uuid NULL,
        "vehicle_id" uuid NULL,
        "driver_user_id" uuid NULL,
        "fee_amount" numeric NULL,
        "fee_cadence" varchar NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."transport_assignments" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "passenger_id" uuid NOT NULL,
        "vehicle_id" uuid NOT NULL,
        "driver_user_id" uuid NULL,
        "effective_from" date NOT NULL DEFAULT CURRENT_DATE,
        "effective_to" date NULL,
        "notes" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."transport_fee_pauses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "label" varchar NOT NULL,
        "start_date" date NOT NULL,
        "end_date" date NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."transport_billing_periods" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "passenger_id" uuid NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "cadence" varchar NOT NULL DEFAULT 'monthly',
        "expected_amount" numeric NOT NULL DEFAULT 0,
        "due_date" date NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."transport_payment_claims" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "passenger_id" uuid NOT NULL,
        "billing_period_id" uuid NULL,
        "vehicle_id" uuid NULL,
        "amount" numeric NOT NULL DEFAULT 0,
        "method" varchar NOT NULL DEFAULT 'cash',
        "paid_at" timestamptz NOT NULL DEFAULT now(),
        "status" varchar NOT NULL DEFAULT 'pending',
        "notes" text NULL,
        "reject_reason" text NULL,
        "submitted_by_user_id" uuid NULL,
        "collected_by_driver_id" uuid NULL,
        "approved_by_user_id" uuid NULL,
        "approved_at" timestamptz NULL,
        "income_id" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."gps_tracking_points" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vehicle_id" uuid NULL DEFAULT NULL,
        "vehicle_label" varchar NULL DEFAULT NULL,
        "device_id" varchar NULL DEFAULT NULL,
        "source" varchar NULL DEFAULT 'dashcam',
        "latitude" numeric NOT NULL,
        "longitude" numeric NOT NULL,
        "speed_kph" numeric NULL DEFAULT NULL,
        "heading" numeric NULL DEFAULT NULL,
        "ignition_on" boolean NULL DEFAULT NULL,
        "external_voltage" numeric NULL DEFAULT NULL,
        "backup_battery_level" smallint NULL DEFAULT NULL,
        "gps_fix_ok" boolean NULL DEFAULT NULL,
        "satellites" smallint NULL DEFAULT NULL,
        "engine_rpm" numeric NULL DEFAULT NULL,
        "fuel_rate_lph" numeric NULL DEFAULT NULL,
        "fuel_level_percent" numeric NULL DEFAULT NULL,
        "odometer_km" numeric NULL DEFAULT NULL,
        "coolant_c" numeric NULL DEFAULT NULL,
        "engine_load_percent" numeric NULL DEFAULT NULL,
        "overspeed" boolean NULL DEFAULT NULL,
        "recorded_at" timestamptz NOT NULL,
        "raw_payload" text NULL DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `ALTER TABLE "${schemaName}"."vehicles"
       ADD COLUMN IF NOT EXISTS "tracker_imei" varchar NULL`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."vehicles" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "label" varchar NOT NULL,
        "registration_number" varchar NOT NULL UNIQUE,
        "make" varchar NULL,
        "model" varchar NULL,
        "year" int NULL,
        "color" varchar NULL,
        "vin" varchar NULL,
        "engine_number" varchar NULL,
        "license_disk_number" varchar NULL,
        "license_disk_expiry" date NULL,
        "insurance_provider" varchar NULL,
        "insurance_policy_number" varchar NULL,
        "insurance_amount" numeric NULL,
        "insurance_expiry" date NULL,
        "owner_name" varchar NULL,
        "owner_contact" varchar NULL,
        "owner_address" text NULL,
        "roadworthy_certificate_number" varchar NULL,
        "roadworthy_expiry" date NULL,
        "permit_number" varchar NULL,
        "permit_expiry" date NULL,
        "notes" text NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."expenses" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "description" varchar NOT NULL,
        "amount" numeric NOT NULL DEFAULT 0,
        "logged_on" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."maintenance_tasks" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "vehicle_id" uuid NULL DEFAULT NULL,
        "vehicle_label" varchar NOT NULL,
        "registration_number" varchar NULL DEFAULT NULL,
        "maintenance_type" varchar NULL DEFAULT 'other',
        "due_km" int NULL DEFAULT NULL,
        "due_date" date NULL DEFAULT NULL,
        "last_service_km" int NULL DEFAULT NULL,
        "last_service_date" date NULL DEFAULT NULL,
        "service_interval_km" int NULL DEFAULT NULL,
        "service_interval_days" int NULL DEFAULT NULL,
        "cost" numeric NULL DEFAULT NULL,
        "notes" text NULL DEFAULT NULL,
        "is_completed" boolean NOT NULL DEFAULT false,
        "completed_at" timestamptz NULL DEFAULT NULL,
        "completed_km" int NULL DEFAULT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."webhook_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "url" varchar NOT NULL,
        "secret" varchar(512) NOT NULL,
        "event_types" jsonb NOT NULL DEFAULT '[]',
        "active" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."notification_categories" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name" varchar NOT NULL,
        "description" text NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
    );
    await this.dataSource.query(
      `CREATE TABLE IF NOT EXISTS "${schemaName}"."notifications" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "category_id" uuid NULL,
        "title" varchar NOT NULL,
        "message" text NOT NULL,
        "target_role" varchar NULL,
        "target_user_id" uuid NULL,
        "status" varchar NOT NULL DEFAULT 'sent',
        "created_by" uuid NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "fk_notifications_category_id" FOREIGN KEY ("category_id")
          REFERENCES "${schemaName}"."notification_categories"("id") ON DELETE SET NULL
      )`,
    );
    await this.dataSource.query(
      `INSERT INTO "${schemaName}"."notification_categories" ("name","description","is_default")
       SELECT x.name, x.description, true
       FROM (VALUES
         ('Alerts', 'General alerts'),
         ('Payments', 'Payment notices'),
         ('Maintenance', 'Maintenance updates'),
         ('System', 'System messages')
       ) AS x(name, description)
       WHERE NOT EXISTS (
         SELECT 1 FROM "${schemaName}"."notification_categories" c WHERE c.name = x.name
       )`,
    );
  }

  toSchemaName(slug: string): string {
    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(slug)) {
      throw new BadRequestException('Invalid tenant slug');
    }
    return `tenant_${slug.replace(/-/g, '_')}`;
  }

  /** Get usage metrics for a tenant schema (billing-friendly). Returns zeros if schema/tables missing. */
  async getUsage(slug: string): Promise<{
    drivers: number;
    incomes: number;
    vehicles: number;
    totalIncome: number;
  }> {
    const schema = this.toSchemaName(slug);
    try {
      const [driversRow] = await this.dataSource.query(
        `SELECT COUNT(*)::int AS c FROM "${schema}"."users"`,
      );
      const [incomesRow] = await this.dataSource.query(
        `SELECT COUNT(*)::int AS c FROM "${schema}"."vehicle_incomes"`,
      );
      const [vehiclesRow] = await this.dataSource.query(
        `SELECT COUNT(*)::int AS c FROM "${schema}"."vehicles"`,
      );
      const [sumRow] = await this.dataSource.query(
        `SELECT COALESCE(SUM(income), 0)::float AS total FROM "${schema}"."vehicle_incomes"`,
      );
      return {
        drivers: Number((driversRow as { c: number })?.c ?? 0),
        incomes: Number((incomesRow as { c: number })?.c ?? 0),
        vehicles: Number((vehiclesRow as { c: number })?.c ?? 0),
        totalIncome: Number((sumRow as { total: number })?.total ?? 0),
      };
    } catch {
      return { drivers: 0, incomes: 0, vehicles: 0, totalIncome: 0 };
    }
  }
}
