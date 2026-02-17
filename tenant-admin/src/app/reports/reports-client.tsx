"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  TrendingUp,
  Car,
  Users,
  Fuel,
  Download,
  Mail,
  Settings,
} from "lucide-react";
import { fetchJsonClient } from "../../lib/api-client";
import { sendMonthlyReportAction } from "./send-report-action";
import { AdvancedReportBuilder } from "./advanced-report-builder";

interface Summary {
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
  incomeCount: number;
  expenseCount: number;
}

interface VehicleStat {
  vehicle: string;
  trips: number;
  totalIncome: number;
  totalExpenses: number;
  totalPetrolCost: number;
  totalPetrolLitres: number;
  totalDistance: number;
  costPerKm: number;
}

interface DriverStat {
  driverId: string;
  driverName: string;
  trips: number;
  totalIncome: number;
  totalExpenses: number;
  totalPetrolCost: number;
  avgIncomePerTrip: number;
  netIncome: number;
}

interface FuelEfficiency {
  vehicle: string;
  totalLitres: number;
  totalDistance: number;
  totalCost: number;
  kmPerLitre: number;
  costPerKm: number;
  costPerLitre: number;
}

const COLORS = ['#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a', '#042f2e'];

export function ReportsClient({
  summary,
  topVehicles,
  driverStats,
  fuelEfficiencyVehicles,
  fuelEfficiencyDrivers,
}: {
  summary: Summary | null;
  topVehicles: VehicleStat[];
  driverStats: DriverStat[];
  fuelEfficiencyVehicles: FuelEfficiency[];
  fuelEfficiencyDrivers: any[];
}) {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  async function generateCustomReport() {
    if (!dateRange.start || !dateRange.end) {
      alert("Please select start and end dates");
      return;
    }

    try {
      const report = await fetchJsonClient<any>(
        `/tenant/reports/monthly-report?startDate=${dateRange.start}&endDate=${dateRange.end}`
      );
      
      // Download as JSON
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${dateRange.start}-${dateRange.end}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report");
    }
  }

  async function sendMonthlyReport() {
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];
      
      const result = await sendMonthlyReportAction(startDate, endDate);
      
      if (result.success) {
        alert(`Monthly report sent successfully to ${result.email || 'admin email'}`);
      } else {
        alert(`Failed to send report: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error("Error sending report:", error);
      alert("Failed to send report. Please check email configuration.");
    }
  }

  const formatCurrency = (amount: number) => `R ${amount.toFixed(2)}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-teal-600 to-teal-700 bg-clip-text text-transparent">
            Reports & Analytics
          </h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Comprehensive financial insights and performance metrics
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <button
            onClick={sendMonthlyReport}
            className="btn btn-secondary flex items-center gap-2"
          >
            <Mail className="h-4 w-4" />
            Send Monthly Report
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total Income</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {summary ? formatCurrency(summary.totalIncome) : '—'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-100 dark:bg-teal-900/30">
              <DollarSign className="h-6 w-6 text-teal-600 dark:text-teal-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total Expenses</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {summary ? formatCurrency(summary.totalExpenses) : '—'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <TrendingUp className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Net Income</p>
              <p className={`mt-2 text-2xl font-bold ${
                summary && summary.netIncome >= 0
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}>
                {summary ? formatCurrency(summary.netIncome) : '—'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Total Trips</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {summary ? summary.incomeCount.toLocaleString() : '—'}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Car className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">Active Drivers</p>
              <p className="mt-2 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                {driverStats.length}
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
              <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Vehicles by Income */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
            <Car className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Top Vehicles by Income
          </h3>
          {topVehicles.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topVehicles.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="vehicle" />
                <YAxis />
                <Tooltip formatter={(value: number | undefined) => value != null ? formatCurrency(value) : ''} />
                <Legend />
                <Bar dataKey="totalIncome" fill="#14b8a6" name="Total Income" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-12">No vehicle data available</p>
          )}
        </div>

        {/* Top Drivers by Income */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Top Drivers by Income
          </h3>
          {driverStats.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={driverStats.slice(0, 5)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="driverName" />
                <YAxis />
                <Tooltip formatter={(value: number | undefined) => value != null ? formatCurrency(value) : ''} />
                <Legend />
                <Bar dataKey="totalIncome" fill="#0d9488" name="Total Income" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-12">No driver data available</p>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Fuel Efficiency by Vehicle */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
            <Fuel className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Fuel Efficiency by Vehicle
          </h3>
          {fuelEfficiencyVehicles.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={fuelEfficiencyVehicles}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="vehicle" />
                <YAxis />
                <Tooltip formatter={(value: number | undefined) => value != null ? `${value.toFixed(2)} km/L` : ''} />
                <Legend />
                <Bar dataKey="kmPerLitre" fill="#0f766e" name="KM per Litre" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-12">No fuel efficiency data available</p>
          )}
        </div>

        {/* Income Distribution */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Income Distribution
          </h3>
          {summary ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Income', value: summary.totalIncome },
                    { name: 'Expenses', value: summary.totalExpenses },
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${percent != null ? (percent * 100).toFixed(0) : 0}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {[summary.totalIncome, summary.totalExpenses].map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number | undefined) => value != null ? formatCurrency(value) : ''} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center py-12">No summary data available</p>
          )}
        </div>
      </div>

      {/* Advanced Custom Report Builder */}
      <AdvancedReportBuilder />

      {/* Detailed Tables */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Vehicles Table */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Top Vehicles</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Vehicle</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Income</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Trips</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {topVehicles.slice(0, 5).map((v) => (
                  <tr key={v.vehicle}>
                    <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50">{v.vehicle}</td>
                    <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50">{formatCurrency(v.totalIncome)}</td>
                    <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50">{v.trips}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Fuel Efficiency Table */}
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Fuel Efficiency</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
              <thead className="bg-zinc-50 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Vehicle</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">KM/L</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Cost/KM</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {fuelEfficiencyVehicles.slice(0, 5).map((f) => (
                  <tr key={f.vehicle}>
                    <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50">{f.vehicle}</td>
                    <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50">{f.kmPerLitre.toFixed(2)}</td>
                    <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50">{formatCurrency(f.costPerKm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

