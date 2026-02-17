"use client";

import { useState, useEffect } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
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
  Download,
  FileText,
  Calendar,
  Users,
  Car,
  TrendingUp,
  Filter,
  X,
  CheckSquare,
  Square,
} from "lucide-react";
import { fetchJsonClient, getApiUrl } from "../../lib/api-client";

const COLORS = ['#14b8a6', '#0d9488', '#0f766e', '#115e59', '#134e4a', '#042f2e', '#0891b2', '#06b6d4'];

interface CustomReportData {
  aggregated: any[];
  detailed: any[];
  summary: {
    totalRecords: number;
    totalIncome: number;
    totalExpenses: number;
    totalPetrolCost: number;
  };
  filters: {
    availableDrivers: Array<{ driver_id: string; driver_name: string }>;
    availableVehicles: string[];
  };
}

export function AdvancedReportBuilder() {
  const [showBuilder, setShowBuilder] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<CustomReportData | null>(null);
  const [availableDrivers, setAvailableDrivers] = useState<Array<{ driver_id: string; driver_name: string }>>([]);
  const [availableVehicles, setAvailableVehicles] = useState<string[]>([]);
  
  // Filter states
  const [dateMode, setDateMode] = useState<'range' | 'single'>('range');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [singleDate, setSingleDate] = useState('');
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [selectedVehicles, setSelectedVehicles] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<'none' | 'day' | 'week' | 'month' | 'driver' | 'vehicle'>('none');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['income', 'expenses', 'trips']);
  const [chartType, setChartType] = useState<'bar' | 'line' | 'area' | 'pie'>('bar');

  // Fetch available drivers and vehicles on mount
  useEffect(() => {
    async function fetchInitialData() {
      try {
        // Generate a basic report to get available filters
        const data = await fetchJsonClient<CustomReportData>(
          `/tenant/reports/custom`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              metrics: ['income'],
            }),
          }
        );
        if (data && data.filters) {
          setAvailableDrivers(data.filters.availableDrivers || []);
          setAvailableVehicles(data.filters.availableVehicles || []);
        }
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    }
    fetchInitialData();
  }, []);

  const metrics = [
    { id: 'income', label: 'Income' },
    { id: 'expenses', label: 'Expenses' },
    { id: 'netIncome', label: 'Net Income' },
    { id: 'trips', label: 'Trips' },
    { id: 'petrolCost', label: 'Petrol Cost' },
    { id: 'petrolLitres', label: 'Petrol Litres' },
    { id: 'distance', label: 'Distance (KM)' },
    { id: 'fuelEfficiency', label: 'Fuel Efficiency' },
  ];

  async function generateReport() {
    setLoading(true);
    try {
      const payload: any = {};
      
      if (dateMode === 'single') {
        if (!singleDate) {
          alert("Please select a date");
          return;
        }
        payload.singleDate = singleDate;
      } else {
        if (!startDate || !endDate) {
          alert("Please select start and end dates");
          return;
        }
        payload.startDate = startDate;
        payload.endDate = endDate;
      }

      if (selectedDrivers.length > 0) {
        payload.driverIds = selectedDrivers;
      }

      if (selectedVehicles.length > 0) {
        payload.vehicles = selectedVehicles;
      }

      if (groupBy !== 'none') {
        payload.groupBy = groupBy;
      }

      if (selectedMetrics.length > 0) {
        payload.metrics = selectedMetrics;
      }

      const data = await fetchJsonClient<CustomReportData>(
        `/tenant/reports/custom`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        }
      );

      if (!data) {
        alert("Failed to generate report");
        return;
      }

      setReportData(data);
      // Update available drivers and vehicles from the report
      if (data.filters) {
        setAvailableDrivers(data.filters.availableDrivers || []);
        setAvailableVehicles(data.filters.availableVehicles || []);
      }
      setShowBuilder(false);
    } catch (error) {
      console.error("Error generating report:", error);
      alert("Failed to generate report");
    } finally {
      setLoading(false);
    }
  }

  function toggleDriver(driverId: string) {
    setSelectedDrivers(prev =>
      prev.includes(driverId)
        ? prev.filter(id => id !== driverId)
        : [...prev, driverId]
    );
  }

  function toggleVehicle(vehicle: string) {
    setSelectedVehicles(prev =>
      prev.includes(vehicle)
        ? prev.filter(v => v !== vehicle)
        : [...prev, vehicle]
    );
  }

  function toggleMetric(metric: string) {
    setSelectedMetrics(prev =>
      prev.includes(metric)
        ? prev.filter(m => m !== metric)
        : [...prev, metric]
    );
  }

  function exportReport(format: 'json' | 'csv') {
    if (!reportData) return;

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `custom-report-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // CSV export
      const headers = ['Date', 'Vehicle', 'Driver', 'Income', 'Expenses', 'Petrol Cost', 'Trips'];
      const rows = reportData.detailed.map((r: any) => [
        new Date(r.logged_on).toLocaleDateString(),
        r.vehicle || '',
        r.driver_name || '',
        r.income || 0,
        r.expense_price || 0,
        r.petrol_poured || 0,
        1,
      ]);
      const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `custom-report-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  function renderChart() {
    if (!reportData || !reportData.aggregated || reportData.aggregated.length === 0) {
      return (
        <div className="text-center py-12 text-zinc-500 dark:text-zinc-400">
          No data to display. Generate a report with grouping enabled to see charts.
        </div>
      );
    }

    // Format data for charts - convert date periods to readable format
    const data = reportData.aggregated.map((item: any) => {
      const formatted: any = { ...item };
      if (item.period && (groupBy === 'day' || groupBy === 'week' || groupBy === 'month')) {
        // Format date period
        const date = new Date(item.period);
        if (groupBy === 'day') {
          formatted.period = date.toLocaleDateString();
        } else if (groupBy === 'week') {
          formatted.period = `Week of ${date.toLocaleDateString()}`;
        } else if (groupBy === 'month') {
          formatted.period = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        }
      }
      return formatted;
    });
    const periodKey = 'period';

    if (chartType === 'pie' && selectedMetrics.length > 0) {
      const pieData = data.map((item: any, index: number) => ({
        name: item.period || `Item ${index + 1}`,
        value: Number(item.income || 0),
      }));

      return (
        <ResponsiveContainer width="100%" height={400}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${percent != null ? (percent * 100).toFixed(0) : 0}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {pieData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value: number | undefined) => value != null ? `R ${value.toFixed(2)}` : ''} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'line') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={periodKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {selectedMetrics.includes('income') && (
              <Line type="monotone" dataKey="income" stroke="#14b8a6" name="Income" />
            )}
            {selectedMetrics.includes('expenses') && (
              <Line type="monotone" dataKey="expenses" stroke="#ef4444" name="Expenses" />
            )}
            {selectedMetrics.includes('netIncome') && (
              <Line type="monotone" dataKey="net_income" stroke="#10b981" name="Net Income" />
            )}
            {selectedMetrics.includes('trips') && (
              <Line type="monotone" dataKey="trips" stroke="#3b82f6" name="Trips" />
            )}
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === 'area') {
      return (
        <ResponsiveContainer width="100%" height={400}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={periodKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            {selectedMetrics.includes('income') && (
              <Area type="monotone" dataKey="income" stackId="1" stroke="#14b8a6" fill="#14b8a6" name="Income" />
            )}
            {selectedMetrics.includes('expenses') && (
              <Area type="monotone" dataKey="expenses" stackId="1" stroke="#ef4444" fill="#ef4444" name="Expenses" />
            )}
            {selectedMetrics.includes('netIncome') && (
              <Area type="monotone" dataKey="net_income" stackId="1" stroke="#10b981" fill="#10b981" name="Net Income" />
            )}
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    // Bar chart (default)
    return (
      <ResponsiveContainer width="100%" height={400}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={periodKey} />
          <YAxis />
          <Tooltip />
          <Legend />
          {selectedMetrics.includes('income') && (
            <Bar dataKey="income" fill="#14b8a6" name="Income" />
          )}
          {selectedMetrics.includes('expenses') && (
            <Bar dataKey="expenses" fill="#ef4444" name="Expenses" />
          )}
          {selectedMetrics.includes('netIncome') && (
            <Bar dataKey="net_income" fill="#10b981" name="Net Income" />
          )}
          {selectedMetrics.includes('trips') && (
            <Bar dataKey="trips" fill="#3b82f6" name="Trips" />
          )}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <div className="space-y-6">
      {/* Builder Toggle */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Filter className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            Advanced Custom Report Builder
          </h3>
          <button
            onClick={() => setShowBuilder(!showBuilder)}
            className="btn btn-secondary flex items-center gap-2"
          >
            {showBuilder ? <X className="h-4 w-4" /> : <Filter className="h-4 w-4" />}
            {showBuilder ? 'Close Builder' : 'Open Builder'}
          </button>
        </div>

        {showBuilder && (
          <div className="space-y-6 border-t border-zinc-200 dark:border-zinc-800 pt-6">
            {/* Date Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Date Selection Mode
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={dateMode === 'range'}
                    onChange={() => setDateMode('range')}
                    className="text-teal-600"
                  />
                  <span className="text-sm">Date Range</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={dateMode === 'single'}
                    onChange={() => setDateMode('single')}
                    className="text-teal-600"
                  />
                  <span className="text-sm">Single Day</span>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2 mt-4">
                {dateMode === 'single' ? (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                      Select Date
                    </label>
                    <input
                      type="date"
                      value={singleDate}
                      onChange={(e) => setSingleDate(e.target.value)}
                      className="input w-full"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="input w-full"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="input w-full"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Driver Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                <Users className="h-4 w-4 inline mr-2" />
                Filter by Drivers (Optional - leave empty for all drivers)
              </label>
              {availableDrivers.length > 0 ? (
                <div className="max-h-40 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg p-2">
                  {availableDrivers.map((driver) => (
                    <label 
                      key={driver.driver_id} 
                      onClick={() => toggleDriver(driver.driver_id)}
                      className="flex items-center gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded cursor-pointer"
                    >
                      {selectedDrivers.includes(driver.driver_id) ? (
                        <CheckSquare className="h-4 w-4 text-teal-600" />
                      ) : (
                        <Square className="h-4 w-4 text-zinc-400" />
                      )}
                      <span className="text-sm">{driver.driver_name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No drivers available. Generate a report first to see available drivers.</p>
              )}
            </div>

            {/* Vehicle Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                <Car className="h-4 w-4 inline mr-2" />
                Filter by Vehicles (Optional - leave empty for all vehicles)
              </label>
              {availableVehicles.length > 0 ? (
                <div className="max-h-40 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-lg p-2">
                  {availableVehicles.map((vehicle) => (
                    <label 
                      key={vehicle} 
                      onClick={() => toggleVehicle(vehicle)}
                      className="flex items-center gap-2 p-2 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded cursor-pointer"
                    >
                      {selectedVehicles.includes(vehicle) ? (
                        <CheckSquare className="h-4 w-4 text-teal-600" />
                      ) : (
                        <Square className="h-4 w-4 text-zinc-400" />
                      )}
                      <span className="text-sm">{vehicle}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No vehicles available. Generate a report first to see available vehicles.</p>
              )}
            </div>

            {/* Group By */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Group By
              </label>
              <select
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as any)}
                className="input w-full"
              >
                <option value="none">No Grouping (Detailed Records)</option>
                <option value="day">By Day</option>
                <option value="week">By Week</option>
                <option value="month">By Month</option>
                <option value="driver">By Driver</option>
                <option value="vehicle">By Vehicle</option>
              </select>
            </div>

            {/* Metrics Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                Metrics to Include
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {metrics.map((metric) => (
                  <label 
                    key={metric.id} 
                    onClick={() => toggleMetric(metric.id)}
                    className="flex items-center gap-2 p-2 border border-zinc-200 dark:border-zinc-800 rounded cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                  >
                    {selectedMetrics.includes(metric.id) ? (
                      <CheckSquare className="h-4 w-4 text-teal-600" />
                    ) : (
                      <Square className="h-4 w-4 text-zinc-400" />
                    )}
                    <span className="text-sm">{metric.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Chart Type */}
            {groupBy !== 'none' && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                  Chart Type
                </label>
                <div className="flex gap-4">
                  {['bar', 'line', 'area', 'pie'].map((type) => (
                    <label key={type} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={chartType === type}
                        onChange={() => setChartType(type as any)}
                        className="text-teal-600"
                      />
                      <span className="text-sm capitalize">{type}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={generateReport}
              disabled={loading}
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Generating Report...</span>
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  <span>Generate Custom Report</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Report Results */}
      {reportData && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="card p-6">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50 mb-4">Report Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Total Records</p>
                <p className="text-xl font-bold text-zinc-900 dark:text-zinc-50">{reportData.summary.totalRecords}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Total Income</p>
                <p className="text-xl font-bold text-teal-600">R {reportData.summary.totalIncome.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Total Expenses</p>
                <p className="text-xl font-bold text-red-600">R {reportData.summary.totalExpenses.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">Total Petrol Cost</p>
                <p className="text-xl font-bold text-orange-600">R {reportData.summary.totalPetrolCost.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Chart */}
          {groupBy !== 'none' && reportData.aggregated.length > 0 && (
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Visualization</h3>
                <div className="flex gap-2">
                  <button
                    onClick={() => exportReport('json')}
                    className="btn btn-secondary flex items-center gap-2 text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Export JSON
                  </button>
                  <button
                    onClick={() => exportReport('csv')}
                    className="btn btn-secondary flex items-center gap-2 text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Export CSV
                  </button>
                </div>
              </div>
              {renderChart()}
            </div>
          )}

          {/* Detailed Table */}
          <div className="card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Detailed Records</h3>
              <div className="flex gap-2">
                <button
                  onClick={() => exportReport('json')}
                  className="btn btn-secondary flex items-center gap-2 text-sm"
                >
                  <Download className="h-4 w-4" />
                  Export JSON
                </button>
                <button
                  onClick={() => exportReport('csv')}
                  className="btn btn-secondary flex items-center gap-2 text-sm"
                >
                  <Download className="h-4 w-4" />
                  Export CSV
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800">
                <thead className="bg-zinc-50 dark:bg-zinc-900">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Date</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Vehicle</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Driver</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Income</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Expenses</th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase">Petrol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {reportData.detailed.slice(0, 100).map((record: any) => (
                    <tr key={record.id}>
                      <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50">
                        {new Date(record.logged_on).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50">{record.vehicle}</td>
                      <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50">{record.driver_name}</td>
                      <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50">R {Number(record.income || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50">R {Number(record.expense_price || 0).toFixed(2)}</td>
                      <td className="px-3 py-3 text-sm text-zinc-900 dark:text-zinc-50">R {Number(record.petrol_poured || 0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {reportData.detailed.length > 100 && (
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-4 text-center">
                  Showing first 100 of {reportData.detailed.length} records. Export to see all.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

