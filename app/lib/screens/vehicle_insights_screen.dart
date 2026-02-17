import 'package:fl_chart/fl_chart.dart';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme.dart';

class VehicleInsightsScreen extends StatefulWidget {
  const VehicleInsightsScreen({super.key});

  @override
  State<VehicleInsightsScreen> createState() => _VehicleInsightsScreenState();
}

class _VehicleInsightsScreenState extends State<VehicleInsightsScreen> {
  final _api = ApiService();
  bool _loading = true;
  List<Map<String, dynamic>> _stats = [];
  List<Map<String, dynamic>> _trends = [];
  String? _selectedVehicle;
  int _days = 30;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final stats = await _api.fetchVehicleStats();
      final trends = await _api.fetchVehicleTrends(days: _days);
      if (!mounted) return;
      setState(() {
        _stats = stats;
        _trends = trends;
        if (_selectedVehicle == null && stats.isNotEmpty) {
          _selectedVehicle = stats.first['vehicle']?.toString();
        }
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _stats = [];
        _trends = [];
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final selectedStats = _stats.firstWhere(
      (item) => item['vehicle']?.toString() == _selectedVehicle,
      orElse: () => <String, dynamic>{},
    );
    final filteredTrends = _trends
        .where((item) => item['vehicle']?.toString() == _selectedVehicle)
        .toList();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Vehicle Insights'),
        centerTitle: true,
        backgroundColor: isDarkMode ? AppTheme.darkBackground : null,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.maybePop(context),
        ),
      ),
      backgroundColor: isDarkMode ? AppTheme.darkBackground : Colors.white,
      body: _loading
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: AppTheme.primary),
                  const SizedBox(height: 16),
                  Text(
                    'Loading insights...',
                    style: TextStyle(
                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.all(16),
                children: [
                  _vehicleSelector(isDarkMode),
                  const SizedBox(height: 16),
                  _summaryCards(selectedStats, isDarkMode),
                  const SizedBox(height: 24),
                  _trendChart(filteredTrends, isDarkMode),
                ],
              ),
            ),
    );
  }

  Widget _vehicleSelector(bool isDarkMode) {
    final vehicles = _stats.map((item) => item['vehicle']?.toString() ?? '').where((v) => v.isNotEmpty).toList();
    if (vehicles.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppTheme.radius),
          border: Border.all(color: isDarkMode ? Colors.grey[700]! : Colors.grey[300]!),
        ),
        child: Text(
          'No trip data yet. Log income to see insights.',
          style: TextStyle(color: isDarkMode ? Colors.white70 : Colors.black54),
        ),
      );
    }

    return Row(
      children: [
        Expanded(
          child: DropdownButtonFormField<String>(
            value: _selectedVehicle ?? vehicles.first,
            decoration: InputDecoration(
              labelText: 'Vehicle',
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTheme.radius)),
            ),
            items: vehicles.map((vehicle) {
              return DropdownMenuItem(
                value: vehicle,
                child: Text(vehicle),
              );
            }).toList(),
            onChanged: (value) => setState(() => _selectedVehicle = value),
          ),
        ),
        const SizedBox(width: 12),
        DropdownButton<int>(
          value: _days,
          items: const [
            DropdownMenuItem(value: 7, child: Text('7d')),
            DropdownMenuItem(value: 30, child: Text('30d')),
            DropdownMenuItem(value: 90, child: Text('90d')),
          ],
          onChanged: (value) {
            if (value == null) return;
            setState(() => _days = value);
            _load();
          },
        ),
      ],
    );
  }

  Widget _summaryCards(Map<String, dynamic> stats, bool isDarkMode) {
    final totalIncome = _toDouble(stats['totalIncome']);
    final totalExpenses = _toDouble(stats['totalExpenses']);
    final totalPetrol = _toDouble(stats['totalPetrolCost']);
    final totalDistance = _toDouble(stats['totalDistance']);
    final costPerKm = _toDouble(stats['costPerKm']);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Summary',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: isDarkMode ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 12),
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _metricCard('Income', 'R ${totalIncome.toStringAsFixed(2)}', isDarkMode),
            _metricCard('Expenses', 'R ${totalExpenses.toStringAsFixed(2)}', isDarkMode),
            _metricCard('Fuel Cost', 'R ${totalPetrol.toStringAsFixed(2)}', isDarkMode),
            _metricCard('Distance', '${totalDistance.toStringAsFixed(0)} km', isDarkMode),
            _metricCard('Cost / km', 'R ${costPerKm.toStringAsFixed(2)}', isDarkMode),
          ],
        ),
      ],
    );
  }

  Widget _metricCard(String title, String value, bool isDarkMode) {
    return Container(
      width: 160,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTheme.radius),
        color: isDarkMode ? AppTheme.darkSurface : Colors.white,
        border: Border.all(color: AppTheme.primary.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(color: isDarkMode ? Colors.white70 : Colors.black54),
          ),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: isDarkMode ? Colors.white : Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  Widget _trendChart(List<Map<String, dynamic>> trends, bool isDarkMode) {
    if (trends.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppTheme.radius),
          border: Border.all(color: isDarkMode ? Colors.grey[700]! : Colors.grey[300]!),
        ),
        child: Text(
          'No trend data for this period.',
          style: TextStyle(color: isDarkMode ? Colors.white70 : Colors.black54),
        ),
      );
    }

    final sorted = List<Map<String, dynamic>>.from(trends)
      ..sort((a, b) => DateTime.parse(a['day'].toString()).compareTo(DateTime.parse(b['day'].toString())));
    final incomeSpots = <FlSpot>[];
    final costSpots = <FlSpot>[];
    for (var i = 0; i < sorted.length; i++) {
      final income = _toDouble(sorted[i]['totalIncome']);
      final cost = _toDouble(sorted[i]['costPerKm']);
      incomeSpots.add(FlSpot(i.toDouble(), income));
      costSpots.add(FlSpot(i.toDouble(), cost));
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Trend (Income & Cost / km)',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: isDarkMode ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 12),
        SizedBox(
          height: 220,
          child: LineChart(
            LineChartData(
              gridData: FlGridData(show: false),
              titlesData: FlTitlesData(
                leftTitles: AxisTitles(
                  sideTitles: SideTitles(showTitles: true, reservedSize: 40),
                ),
                bottomTitles: AxisTitles(
                  sideTitles: SideTitles(
                    showTitles: true,
                    interval: (sorted.length / 4).ceilToDouble().clamp(1, sorted.length.toDouble()),
                    getTitlesWidget: (value, meta) {
                      final index = value.toInt();
                      if (index < 0 || index >= sorted.length) {
                        return const SizedBox.shrink();
                      }
                      final date = DateTime.parse(sorted[index]['day'].toString());
                      return Padding(
                        padding: const EdgeInsets.only(top: 6),
                        child: Text('${date.day}/${date.month}', style: const TextStyle(fontSize: 10)),
                      );
                    },
                  ),
                ),
              ),
              borderData: FlBorderData(show: false),
              lineBarsData: [
                LineChartBarData(
                  spots: incomeSpots,
                  isCurved: true,
                  color: AppTheme.primary,
                  barWidth: 3,
                  dotData: FlDotData(show: false),
                ),
                LineChartBarData(
                  spots: costSpots,
                  isCurved: true,
                  color: Colors.orange,
                  barWidth: 2,
                  dotData: FlDotData(show: false),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            _legendDot(AppTheme.primary, 'Income'),
            const SizedBox(width: 12),
            _legendDot(Colors.orange, 'Cost / km'),
          ],
        ),
      ],
    );
  }

  Widget _legendDot(Color color, String label) {
    return Row(
      children: [
        Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Text(label, style: const TextStyle(fontSize: 12)),
      ],
    );
  }

  double _toDouble(Object? value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0;
  }
}

