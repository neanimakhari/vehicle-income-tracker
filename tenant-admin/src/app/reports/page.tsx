import { requireAuth } from "@/lib/auth";
import { fetchJson } from "../../lib/api";
import { ReportsClient } from "./reports-client";

async function fetchSummary() {
  const summary = await fetchJson<{
    totalIncome: number;
    totalExpenses: number;
    netIncome: number;
    incomeCount: number;
    expenseCount: number;
  }>("/tenant/reports/summary");
  return summary ?? null;
}

async function fetchTopVehicles() {
  const vehicles = await fetchJson<Array<{
    vehicle: string;
    trips: number;
    totalIncome: number;
    totalExpenses: number;
    totalPetrolCost: number;
    totalPetrolLitres: number;
    totalDistance: number;
    costPerKm: number;
  }>>("/tenant/reports/top-vehicles?limit=10");
  return vehicles ?? [];
}

async function fetchDriverStats() {
  const drivers = await fetchJson<Array<{
    driverId: string;
    driverName: string;
    trips: number;
    totalIncome: number;
    totalExpenses: number;
    totalPetrolCost: number;
    avgIncomePerTrip: number;
    netIncome: number;
  }>>("/tenant/reports/driver-stats");
  return drivers ?? [];
}

async function fetchFuelEfficiencyVehicles() {
  const efficiency = await fetchJson<Array<{
    vehicle: string;
    totalLitres: number;
    totalDistance: number;
    totalCost: number;
    kmPerLitre: number;
    costPerKm: number;
    costPerLitre: number;
  }>>("/tenant/reports/fuel-efficiency/vehicles");
  return efficiency ?? [];
}

async function fetchFuelEfficiencyDrivers() {
  const efficiency = await fetchJson<Array<{
    driverId: string;
    driverName: string;
    totalLitres: number;
    totalDistance: number;
    totalCost: number;
    trips: number;
    kmPerLitre: number;
    costPerKm: number;
  }>>("/tenant/reports/fuel-efficiency/drivers");
  return efficiency ?? [];
}

export default async function ReportsPage() {
  await requireAuth();
  
  const [summary, topVehicles, driverStats, fuelEfficiencyVehicles, fuelEfficiencyDrivers] = await Promise.all([
    fetchSummary(),
    fetchTopVehicles(),
    fetchDriverStats(),
    fetchFuelEfficiencyVehicles(),
    fetchFuelEfficiencyDrivers(),
  ]);

  return (
    <ReportsClient
      summary={summary}
      topVehicles={topVehicles}
      driverStats={driverStats}
      fuelEfficiencyVehicles={fuelEfficiencyVehicles}
      fuelEfficiencyDrivers={fuelEfficiencyDrivers}
    />
  );
}
