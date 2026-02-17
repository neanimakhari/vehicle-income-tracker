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
        "address" text NULL,
               "emergency_contact_name" varchar NULL,
               "emergency_contact_phone" varchar NULL,
               "profile_picture" text NULL,
               "password_reset_token" varchar NULL,
               "password_reset_expires" timestamptz NULL,
               "email_verified" boolean NOT NULL DEFAULT false,
               "email_verification_token" varchar NULL,
               "email_verification_expires" timestamptz NULL,
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
        "driver_id" uuid NULL DEFAULT NULL,
        "logged_on" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )`,
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

