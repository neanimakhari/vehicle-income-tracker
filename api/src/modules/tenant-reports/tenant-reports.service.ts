import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TenantScopeService } from '../../tenancy/tenant-scope.service';
import { EmailService } from '../email/email.service';
import { TenantContextService } from '../../tenancy/tenant-context.service';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class TenantReportsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantScope: TenantScopeService,
    private readonly emailService: EmailService,
    private readonly tenantContext: TenantContextService,
    private readonly tenantsService: TenantsService,
  ) {}

  async getSummary(actor?: { sub?: string; role?: string }) {
    return this.withTenantQueryRunner(async queryRunner => {
      if (actor?.role === 'TENANT_USER' && actor.sub) {
        const [incomeRaw, expenseRaw, incomeCountRaw] = await Promise.all([
          queryRunner.query(
            `SELECT COALESCE(SUM(income), 0) AS total
             FROM vehicle_incomes
             WHERE driver_id = $1`,
            [actor.sub],
          ),
          queryRunner.query(
            `SELECT COALESCE(SUM(expense_price), 0) AS total
             FROM vehicle_incomes
             WHERE driver_id = $1`,
            [actor.sub],
          ),
          queryRunner.query(
            `SELECT COUNT(*) AS total
             FROM vehicle_incomes
             WHERE driver_id = $1`,
            [actor.sub],
          ),
        ]);

        const totalIncome = Number(incomeRaw?.[0]?.total ?? 0);
        const totalExpenses = Number(expenseRaw?.[0]?.total ?? 0);
        const incomeCount = Number(incomeCountRaw?.[0]?.total ?? 0);
        return {
          totalIncome,
          totalExpenses,
          netIncome: totalIncome - totalExpenses,
          incomeCount,
          expenseCount: 0,
        };
      }

      const [incomeRaw, expenseRaw, incomeCountRaw, expenseCountRaw] =
        await Promise.all([
          queryRunner.query(
            `SELECT COALESCE(SUM(income), 0) AS total
             FROM vehicle_incomes`,
          ),
          queryRunner.query(
            `SELECT COALESCE(SUM(amount), 0) AS total
             FROM expenses`,
          ),
          queryRunner.query(`SELECT COUNT(*) AS total FROM vehicle_incomes`),
          queryRunner.query(`SELECT COUNT(*) AS total FROM expenses`),
        ]);

      const totalIncome = Number(incomeRaw?.[0]?.total ?? 0);
      const totalExpenses = Number(expenseRaw?.[0]?.total ?? 0);
      const incomeCount = Number(incomeCountRaw?.[0]?.total ?? 0);
      const expenseCount = Number(expenseCountRaw?.[0]?.total ?? 0);

      return {
        totalIncome,
        totalExpenses,
        netIncome: totalIncome - totalExpenses,
        incomeCount,
        expenseCount,
      };
    });
  }

  async getVehicleStats(actor?: { sub?: string; role?: string }) {
    return this.withTenantQueryRunner(async queryRunner => {
      const params: Array<string | number> = [];
      let whereClause = '';
      if (actor?.role === 'TENANT_USER' && actor.sub) {
        params.push(actor.sub);
        whereClause = `WHERE driver_id = $1`;
      }

      const rows = await queryRunner.query(
        `SELECT vehicle,
            COUNT(*) AS trips,
            COALESCE(SUM(income), 0) AS total_income,
            COALESCE(SUM(expense_price), 0) AS total_expenses,
            COALESCE(SUM(petrol_poured), 0) AS total_petrol_cost,
            COALESCE(SUM(petrol_litres), 0) AS total_petrol_litres,
            COALESCE(SUM(CASE
              WHEN end_km IS NOT NULL AND starting_km IS NOT NULL AND end_km > starting_km
              THEN end_km - starting_km
              ELSE 0
            END), 0) AS total_distance
          FROM vehicle_incomes
          ${whereClause}
          GROUP BY vehicle
          ORDER BY vehicle ASC`,
        params,
      );

      return rows.map((row: Record<string, string>) => {
        const totalDistance = Number(row.total_distance ?? 0);
        const totalExpenses = Number(row.total_expenses ?? 0);
        const totalPetrolCost = Number(row.total_petrol_cost ?? 0);
        const costPerKm =
          totalDistance > 0 ? (totalExpenses + totalPetrolCost) / totalDistance : 0;
        return {
          vehicle: row.vehicle,
          trips: Number(row.trips ?? 0),
          totalIncome: Number(row.total_income ?? 0),
          totalExpenses,
          totalPetrolCost,
          totalPetrolLitres: Number(row.total_petrol_litres ?? 0),
          totalDistance,
          costPerKm,
        };
      });
    });
  }

  async getVehicleTrends(days: number, actor?: { sub?: string; role?: string }) {
    const safeDays = Number.isFinite(days) && days > 0 ? Math.min(days, 365) : 30;
    return this.withTenantQueryRunner(async queryRunner => {
      const params: Array<string | number> = [safeDays];
      let whereClause =
        `WHERE logged_on >= NOW() - ($1 || ' days')::interval`;
      if (actor?.role === 'TENANT_USER' && actor.sub) {
        params.push(actor.sub);
        whereClause += ` AND driver_id = $2`;
      }

      const rows = await queryRunner.query(
        `SELECT vehicle,
            DATE_TRUNC('day', logged_on) AS day,
            COALESCE(SUM(income), 0) AS total_income,
            COALESCE(SUM(expense_price), 0) AS total_expenses,
            COALESCE(SUM(petrol_poured), 0) AS total_petrol_cost,
            COALESCE(SUM(petrol_litres), 0) AS total_petrol_litres,
            COALESCE(SUM(CASE
              WHEN end_km IS NOT NULL AND starting_km IS NOT NULL AND end_km > starting_km
              THEN end_km - starting_km
              ELSE 0
            END), 0) AS total_distance
          FROM vehicle_incomes
          ${whereClause}
          GROUP BY vehicle, DATE_TRUNC('day', logged_on)
          ORDER BY day ASC, vehicle ASC`,
        params,
      );

      return rows.map((row: Record<string, string>) => {
        const totalDistance = Number(row.total_distance ?? 0);
        const totalExpenses = Number(row.total_expenses ?? 0);
        const totalPetrolCost = Number(row.total_petrol_cost ?? 0);
        const costPerKm =
          totalDistance > 0 ? (totalExpenses + totalPetrolCost) / totalDistance : 0;
        return {
          vehicle: row.vehicle,
          day: row.day,
          totalIncome: Number(row.total_income ?? 0),
          totalExpenses,
          totalPetrolCost,
          totalPetrolLitres: Number(row.total_petrol_litres ?? 0),
          totalDistance,
          costPerKm,
        };
      });
    });
  }

  async getTopVehicles(limit: number = 10, actor?: { sub?: string; role?: string }) {
    return this.withTenantQueryRunner(async queryRunner => {
      const params: Array<string | number> = [limit];
      let whereClause = '';
      if (actor?.role === 'TENANT_USER' && actor.sub) {
        params.push(actor.sub);
        whereClause = `WHERE driver_id = $2`;
      }

      const rows = await queryRunner.query(
        `SELECT vehicle,
            COUNT(*) AS trips,
            COALESCE(SUM(income), 0) AS total_income,
            COALESCE(SUM(expense_price), 0) AS total_expenses,
            COALESCE(SUM(petrol_poured), 0) AS total_petrol_cost,
            COALESCE(SUM(petrol_litres), 0) AS total_petrol_litres,
            COALESCE(SUM(CASE
              WHEN end_km IS NOT NULL AND starting_km IS NOT NULL AND end_km > starting_km
              THEN end_km - starting_km
              ELSE 0
            END), 0) AS total_distance
          FROM vehicle_incomes
          ${whereClause}
          GROUP BY vehicle
          ORDER BY total_income DESC
          LIMIT $1`,
        params,
      );

      return rows.map((row: Record<string, string>) => ({
        vehicle: row.vehicle,
        trips: Number(row.trips ?? 0),
        totalIncome: Number(row.total_income ?? 0),
        totalExpenses: Number(row.total_expenses ?? 0),
        totalPetrolCost: Number(row.total_petrol_cost ?? 0),
        totalPetrolLitres: Number(row.total_petrol_litres ?? 0),
        totalDistance: Number(row.total_distance ?? 0),
        netIncome: Number(row.total_income ?? 0) - Number(row.total_expenses ?? 0) - Number(row.total_petrol_cost ?? 0),
      }));
    });
  }

  async getFuelEfficiencyByVehicle(actor?: { sub?: string; role?: string }) {
    return this.withTenantQueryRunner(async queryRunner => {
      const params: Array<string | number> = [];
      let whereClause = '';
      if (actor?.role === 'TENANT_USER' && actor.sub) {
        params.push(actor.sub);
        whereClause = `WHERE driver_id = $1`;
      }

      const rows = await queryRunner.query(
        `SELECT vehicle,
            COALESCE(SUM(petrol_litres), 0) AS total_litres,
            COALESCE(SUM(CASE
              WHEN end_km IS NOT NULL AND starting_km IS NOT NULL AND end_km > starting_km
              THEN end_km - starting_km
              ELSE 0
            END), 0) AS total_distance,
            COALESCE(SUM(petrol_poured), 0) AS total_cost
          FROM vehicle_incomes
          ${whereClause}
          GROUP BY vehicle
          HAVING SUM(petrol_litres) > 0
          ORDER BY vehicle ASC`,
        params,
      );

      return rows.map((row: Record<string, string>) => {
        const totalLitres = Number(row.total_litres ?? 0);
        const totalDistance = Number(row.total_distance ?? 0);
        const totalCost = Number(row.total_cost ?? 0);
        const kmPerLitre = totalLitres > 0 ? totalDistance / totalLitres : 0;
        const costPerKm = totalDistance > 0 ? totalCost / totalDistance : 0;
        const costPerLitre = totalLitres > 0 ? totalCost / totalLitres : 0;

        return {
          vehicle: row.vehicle,
          totalLitres,
          totalDistance,
          totalCost,
          kmPerLitre: Number(kmPerLitre.toFixed(2)),
          costPerKm: Number(costPerKm.toFixed(2)),
          costPerLitre: Number(costPerLitre.toFixed(2)),
        };
      });
    });
  }

  async getFuelEfficiencyByDriver(actor?: { sub?: string; role?: string }) {
    return this.withTenantQueryRunner(async queryRunner => {
      const params: Array<string | number> = [];
      let whereClause = '';
      if (actor?.role === 'TENANT_USER' && actor.sub) {
        params.push(actor.sub);
        whereClause = `WHERE driver_id = $1`;
      }

      const rows = await queryRunner.query(
        `SELECT 
            u.id AS driver_id,
            u.first_name || ' ' || u.last_name AS driver_name,
            COALESCE(SUM(vi.petrol_litres), 0) AS total_litres,
            COALESCE(SUM(CASE
              WHEN vi.end_km IS NOT NULL AND vi.starting_km IS NOT NULL AND vi.end_km > vi.starting_km
              THEN vi.end_km - vi.starting_km
              ELSE 0
            END), 0) AS total_distance,
            COALESCE(SUM(vi.petrol_poured), 0) AS total_cost,
            COUNT(*) AS trips
          FROM vehicle_incomes vi
          LEFT JOIN users u ON vi.driver_id = u.id
          ${whereClause}
          GROUP BY u.id, u.first_name, u.last_name
          HAVING SUM(vi.petrol_litres) > 0
          ORDER BY driver_name ASC`,
        params,
      );

      return rows.map((row: Record<string, string>) => {
        const totalLitres = Number(row.total_litres ?? 0);
        const totalDistance = Number(row.total_distance ?? 0);
        const totalCost = Number(row.total_cost ?? 0);
        const kmPerLitre = totalLitres > 0 ? totalDistance / totalLitres : 0;
        const costPerKm = totalDistance > 0 ? totalCost / totalDistance : 0;

        return {
          driverId: row.driver_id,
          driverName: row.driver_name,
          totalLitres,
          totalDistance,
          totalCost,
          trips: Number(row.trips ?? 0),
          kmPerLitre: Number(kmPerLitre.toFixed(2)),
          costPerKm: Number(costPerKm.toFixed(2)),
        };
      });
    });
  }

  async getDriverStats(actor?: { sub?: string; role?: string }) {
    return this.withTenantQueryRunner(async queryRunner => {
      const params: Array<string | number> = [];
      let whereClause = '';
      if (actor?.role === 'TENANT_USER' && actor.sub) {
        params.push(actor.sub);
        whereClause = `WHERE vi.driver_id = $1`;
      }

      const rows = await queryRunner.query(
        `SELECT 
            u.id AS driver_id,
            u.first_name || ' ' || u.last_name AS driver_name,
            COUNT(*) AS trips,
            COALESCE(SUM(vi.income), 0) AS total_income,
            COALESCE(SUM(vi.expense_price), 0) AS total_expenses,
            COALESCE(SUM(vi.petrol_poured), 0) AS total_petrol_cost,
            COALESCE(AVG(vi.income), 0) AS avg_income_per_trip
          FROM vehicle_incomes vi
          LEFT JOIN users u ON vi.driver_id = u.id
          ${whereClause}
          GROUP BY u.id, u.first_name, u.last_name
          ORDER BY total_income DESC`,
        params,
      );

      return rows.map((row: Record<string, string>) => ({
        driverId: row.driver_id,
        driverName: row.driver_name,
        trips: Number(row.trips ?? 0),
        totalIncome: Number(row.total_income ?? 0),
        totalExpenses: Number(row.total_expenses ?? 0),
        totalPetrolCost: Number(row.total_petrol_cost ?? 0),
        avgIncomePerTrip: Number(row.avg_income_per_trip ?? 0),
        netIncome: Number(row.total_income ?? 0) - Number(row.total_expenses ?? 0) - Number(row.total_petrol_cost ?? 0),
      }));
    });
  }

  async getMonthlyReport(startDate: Date, endDate: Date, actor?: { sub?: string; role?: string }) {
    return this.withTenantQueryRunner(async queryRunner => {
      const params: Array<string | number | Date> = [startDate, endDate];
      let whereClause = `WHERE logged_on >= $1 AND logged_on <= $2`;
      if (actor?.role === 'TENANT_USER' && actor.sub) {
        params.push(actor.sub);
        whereClause += ` AND driver_id = $3`;
      }

      const [summary, vehicleStats, driverStats, fuelEfficiency] = await Promise.all([
        queryRunner.query(
          `SELECT 
            COALESCE(SUM(income), 0) AS total_income,
            COALESCE(SUM(expense_price), 0) AS total_expenses,
            COALESCE(SUM(petrol_poured), 0) AS total_petrol_cost,
            COUNT(*) AS trips
          FROM vehicle_incomes
          ${whereClause}`,
          params,
        ),
        queryRunner.query(
          `SELECT vehicle,
            COALESCE(SUM(income), 0) AS total_income,
            COUNT(*) AS trips
          FROM vehicle_incomes
          ${whereClause}
          GROUP BY vehicle
          ORDER BY total_income DESC
          LIMIT 10`,
          params,
        ),
        queryRunner.query(
          `SELECT 
            u.first_name || ' ' || u.last_name AS driver_name,
            COALESCE(SUM(vi.income), 0) AS total_income,
            COUNT(*) AS trips
          FROM vehicle_incomes vi
          LEFT JOIN users u ON vi.driver_id = u.id
          ${whereClause}
          GROUP BY u.id, u.first_name, u.last_name
          ORDER BY total_income DESC
          LIMIT 10`,
          params,
        ),
        queryRunner.query(
          `SELECT vehicle,
            COALESCE(SUM(petrol_litres), 0) AS total_litres,
            COALESCE(SUM(CASE
              WHEN end_km IS NOT NULL AND starting_km IS NOT NULL AND end_km > starting_km
              THEN end_km - starting_km
              ELSE 0
            END), 0) AS total_distance
          FROM vehicle_incomes
          ${whereClause}
          GROUP BY vehicle
          HAVING SUM(petrol_litres) > 0`,
          params,
        ),
      ]);

      const summaryData = summary[0];
      const fuelEfficiencyData = fuelEfficiency.map((row: Record<string, string>) => {
        const litres = Number(row.total_litres ?? 0);
        const distance = Number(row.total_distance ?? 0);
        return {
          vehicle: row.vehicle,
          kmPerLitre: litres > 0 ? Number((distance / litres).toFixed(2)) : 0,
        };
      });

      return {
        period: { startDate, endDate },
        summary: {
          totalIncome: Number(summaryData.total_income ?? 0),
          totalExpenses: Number(summaryData.total_expenses ?? 0),
          totalPetrolCost: Number(summaryData.total_petrol_cost ?? 0),
          netIncome: Number(summaryData.total_income ?? 0) - Number(summaryData.total_expenses ?? 0) - Number(summaryData.total_petrol_cost ?? 0),
          trips: Number(summaryData.trips ?? 0),
        },
        topVehicles: vehicleStats.map((row: Record<string, string>) => ({
          vehicle: row.vehicle,
          totalIncome: Number(row.total_income ?? 0),
          trips: Number(row.trips ?? 0),
        })),
        topDrivers: driverStats.map((row: Record<string, string>) => ({
          driverName: row.driver_name,
          totalIncome: Number(row.total_income ?? 0),
          trips: Number(row.trips ?? 0),
        })),
        fuelEfficiency: fuelEfficiencyData,
      };
    });
  }

  async sendMonthlyReportEmail(startDate: Date, endDate: Date, email?: string) {
    const tenantId = this.tenantContext.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context missing');
    }

    const tenant = await this.tenantsService.findBySlug(tenantId);
    const reportData = await this.getMonthlyReport(startDate, endDate);

    // Get tenant admin email from platform auth_users if not provided
    let adminEmail = email;
    if (!adminEmail) {
      const adminUsers = await this.dataSource.query(
        `SELECT email FROM "platform"."auth_users" WHERE role = 'TENANT_ADMIN' AND tenant_id = $1 AND is_active = true LIMIT 1`,
        [tenantId],
      );
      adminEmail = adminUsers?.[0]?.email;
    }

    if (!adminEmail) {
      throw new Error('No tenant admin email found for this tenant');
    }

    await this.emailService.sendMonthlyReport(
      adminEmail,
      tenant.name || tenant.slug,
      reportData,
    );

    return { sent: true, email: adminEmail };
  }

  async getCustomReport(
    filters: {
      startDate?: Date;
      endDate?: Date;
      singleDate?: Date;
      driverIds?: string[];
      vehicles?: string[];
      groupBy?: 'day' | 'week' | 'month' | 'driver' | 'vehicle' | 'none';
      metrics?: string[];
    },
    actor?: { sub?: string; role?: string },
  ) {
    return this.withTenantQueryRunner(async queryRunner => {
      const params: Array<string | number | Date> = [];
      let whereConditions: string[] = [];
      let paramIndex = 1;

      // Date filtering
      if (filters.singleDate) {
        const startOfDay = new Date(filters.singleDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(filters.singleDate);
        endOfDay.setHours(23, 59, 59, 999);
        params.push(startOfDay, endOfDay);
        whereConditions.push(`logged_on >= $${paramIndex} AND logged_on <= $${paramIndex + 1}`);
        paramIndex += 2;
      } else if (filters.startDate || filters.endDate) {
        if (filters.startDate) {
          params.push(filters.startDate);
          whereConditions.push(`logged_on >= $${paramIndex}`);
          paramIndex++;
        }
        if (filters.endDate) {
          params.push(filters.endDate);
          whereConditions.push(`logged_on <= $${paramIndex}`);
          paramIndex++;
        }
      }

      // Driver filtering
      if (filters.driverIds && filters.driverIds.length > 0) {
        params.push(...filters.driverIds);
        const placeholders = filters.driverIds.map((_, i) => `$${paramIndex + i}`).join(', ');
        whereConditions.push(`driver_id IN (${placeholders})`);
        paramIndex += filters.driverIds.length;
      } else if (actor?.role === 'TENANT_USER' && actor.sub) {
        params.push(actor.sub);
        whereConditions.push(`driver_id = $${paramIndex}`);
        paramIndex++;
      }

      // Vehicle filtering
      if (filters.vehicles && filters.vehicles.length > 0) {
        params.push(...filters.vehicles);
        const placeholders = filters.vehicles.map((_, i) => `$${paramIndex + i}`).join(', ');
        whereConditions.push(`vehicle IN (${placeholders})`);
        paramIndex += filters.vehicles.length;
      }

      const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

      // Group by clause
      let groupByClause = '';
      let selectFields = '';
      const metrics = filters.metrics || ['income', 'expenses', 'netIncome', 'trips'];

      if (filters.groupBy === 'day') {
        groupByClause = `GROUP BY DATE_TRUNC('day', logged_on)`;
        selectFields = `DATE_TRUNC('day', logged_on) AS period,`;
      } else if (filters.groupBy === 'week') {
        groupByClause = `GROUP BY DATE_TRUNC('week', logged_on)`;
        selectFields = `DATE_TRUNC('week', logged_on) AS period,`;
      } else if (filters.groupBy === 'month') {
        groupByClause = `GROUP BY DATE_TRUNC('month', logged_on)`;
        selectFields = `DATE_TRUNC('month', logged_on) AS period,`;
      } else if (filters.groupBy === 'driver') {
        groupByClause = `GROUP BY driver_id, driver_name`;
        selectFields = `driver_id, driver_name AS period,`;
      } else if (filters.groupBy === 'vehicle') {
        groupByClause = `GROUP BY vehicle`;
        selectFields = `vehicle AS period,`;
      }

      // Build SELECT fields based on requested metrics
      const selectParts: string[] = [];
      if (selectFields) selectParts.push(selectFields);

      if (metrics.includes('income')) {
        selectParts.push(`COALESCE(SUM(income), 0) AS income`);
      }
      if (metrics.includes('expenses')) {
        selectParts.push(`COALESCE(SUM(expense_price), 0) AS expenses`);
      }
      if (metrics.includes('netIncome')) {
        selectParts.push(`COALESCE(SUM(income), 0) - COALESCE(SUM(expense_price), 0) - COALESCE(SUM(petrol_poured), 0) AS net_income`);
      }
      if (metrics.includes('trips')) {
        selectParts.push(`COUNT(*) AS trips`);
      }
      if (metrics.includes('petrolCost')) {
        selectParts.push(`COALESCE(SUM(petrol_poured), 0) AS petrol_cost`);
      }
      if (metrics.includes('petrolLitres')) {
        selectParts.push(`COALESCE(SUM(petrol_litres), 0) AS petrol_litres`);
      }
      if (metrics.includes('distance')) {
        selectParts.push(`COALESCE(SUM(CASE WHEN end_km IS NOT NULL AND starting_km IS NOT NULL AND end_km > starting_km THEN end_km - starting_km ELSE 0 END), 0) AS distance`);
      }
      if (metrics.includes('fuelEfficiency')) {
        selectParts.push(`CASE 
          WHEN COALESCE(SUM(petrol_litres), 0) > 0 
          THEN COALESCE(SUM(CASE WHEN end_km IS NOT NULL AND starting_km IS NOT NULL AND end_km > starting_km THEN end_km - starting_km ELSE 0 END), 0) / COALESCE(SUM(petrol_litres), 0)
          ELSE 0 
        END AS fuel_efficiency`);
      }

      // Get detailed records
      const detailedQuery = `
        SELECT 
          id,
          vehicle,
          driver_name,
          driver_id,
          income,
          expense_price,
          petrol_poured,
          petrol_litres,
          starting_km,
          end_km,
          logged_on,
          created_at
        FROM vehicle_incomes
        ${whereClause}
        ORDER BY logged_on DESC
      `;

      // Get aggregated data if groupBy is specified
      let aggregatedData: any[] = [];
      if (filters.groupBy && filters.groupBy !== 'none') {
        const aggregatedQuery = `
          SELECT ${selectParts.join(', ')}
          FROM vehicle_incomes
          ${whereClause}
          ${groupByClause}
          ORDER BY period
        `;
        aggregatedData = await queryRunner.query(aggregatedQuery, params);
      }

      const detailedRecords = await queryRunner.query(detailedQuery, params);

      // Get available drivers and vehicles for filters
      const [drivers, vehicles] = await Promise.all([
        queryRunner.query(`
          SELECT DISTINCT driver_id, driver_name 
          FROM vehicle_incomes 
          WHERE driver_id IS NOT NULL
          ORDER BY driver_name
        `),
        queryRunner.query(`
          SELECT DISTINCT vehicle 
          FROM vehicle_incomes 
          ORDER BY vehicle
        `),
      ]);

      return {
        aggregated: aggregatedData,
        detailed: detailedRecords,
        summary: {
          totalRecords: detailedRecords.length,
          totalIncome: detailedRecords.reduce((sum: number, r: any) => sum + Number(r.income || 0), 0),
          totalExpenses: detailedRecords.reduce((sum: number, r: any) => sum + Number(r.expense_price || 0), 0),
          totalPetrolCost: detailedRecords.reduce((sum: number, r: any) => sum + Number(r.petrol_poured || 0), 0),
        },
        filters: {
          availableDrivers: drivers,
          availableVehicles: vehicles.map((v: any) => v.vehicle),
        },
      };
    });
  }

  private async withTenantQueryRunner<T>(
    handler: (queryRunner: ReturnType<DataSource['createQueryRunner']>) => Promise<T>,
  ): Promise<T> {
    const schema = this.tenantScope.getTenantSchema();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    try {
      await queryRunner.query(`SET search_path TO "${schema}"`);
      return await handler(queryRunner);
    } finally {
      await queryRunner.release();
    }
  }
}

