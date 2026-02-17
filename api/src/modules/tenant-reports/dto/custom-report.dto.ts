import { IsOptional, IsString, IsArray, IsDateString, IsEnum } from 'class-validator';

export enum ReportGroupBy {
  DAY = 'day',
  WEEK = 'week',
  MONTH = 'month',
  DRIVER = 'driver',
  VEHICLE = 'vehicle',
  NONE = 'none',
}

export enum ReportMetric {
  INCOME = 'income',
  EXPENSES = 'expenses',
  NET_INCOME = 'netIncome',
  TRIPS = 'trips',
  PETROL_COST = 'petrolCost',
  PETROL_LITRES = 'petrolLitres',
  DISTANCE = 'distance',
  FUEL_EFFICIENCY = 'fuelEfficiency',
}

export class CustomReportDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  singleDate?: string; // For single day reports

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  driverIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  vehicles?: string[];

  @IsOptional()
  @IsEnum(ReportGroupBy)
  groupBy?: ReportGroupBy;

  @IsOptional()
  @IsArray()
  @IsEnum(ReportMetric, { each: true })
  metrics?: ReportMetric[];
}

