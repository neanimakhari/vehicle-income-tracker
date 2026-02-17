import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/offline_queue.dart';
import '../services/session.dart';
import '../theme.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key});

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  final _api = ApiService();
  bool _loading = true;
  final List<_AlertItem> _alerts = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    _alerts.clear();
    try {
      final policy = await _api.fetchTenantPolicy();
      final requireMfaUsers = policy['requireMfaUsers'] == true;
      if (requireMfaUsers && Session.mfaEnabled != true) {
        _alerts.add(
          _AlertItem(
            title: 'MFA required',
            body: 'Enable MFA to keep access to the app.',
            severity: AlertSeverity.high,
          ),
        );
      }

      final pending = await OfflineQueue.pendingCount();
      if (pending > 0) {
        _alerts.add(
          _AlertItem(
            title: 'Offline items',
            body: '$pending income log(s) are waiting to sync.',
            severity: AlertSeverity.medium,
          ),
        );
      }

      final maintenance = await _api.fetchMaintenanceTasks();
      for (final task in maintenance) {
        final status = task['status']?.toString();
        if (status == 'overdue' || status == 'due_soon') {
          _alerts.add(
            _AlertItem(
              title: 'Maintenance ${status == 'overdue' ? 'overdue' : 'due soon'}',
              body: task['vehicleLabel']?.toString() ?? 'Vehicle',
              severity: status == 'overdue' ? AlertSeverity.high : AlertSeverity.medium,
            ),
          );
        }
      }

      // Documents expiring soon (licence, PRDP, medical)
      try {
        final profile = await _api.fetchDriverProfile();
        final now = DateTime.now();
        final in60Days = now.add(const Duration(days: 60));
        const labels = {
          'licenseExpiry': 'Driver\'s licence',
          'prdpExpiry': 'PRDP certificate',
          'medicalCertificateExpiry': 'Medical certificate',
        };
        for (final entry in labels.entries) {
          final v = profile[entry.key]?.toString();
          if (v == null || v.isEmpty) continue;
          final d = DateTime.tryParse(v);
          if (d == null) continue;
          if (d.isBefore(now)) {
            _alerts.add(_AlertItem(
              title: '${entry.value} expired',
              body: 'Expired on ${_formatAlertDate(d)}. Update in Profile.',
              severity: AlertSeverity.high,
            ));
          } else if (d.isBefore(in60Days)) {
            final days = d.difference(now).inDays;
            _alerts.add(_AlertItem(
              title: '${entry.value} expiring soon',
              body: 'Expires ${_formatAlertDate(d)} (in $days days). Update in Profile.',
              severity: days <= 14 ? AlertSeverity.high : AlertSeverity.medium,
            ));
          }
        }
      } catch (_) {}

      final trends = await _api.fetchVehicleTrends(days: 7);
      final fuelTotals = <String, double>{};
      for (final item in trends) {
        final vehicle = item['vehicle']?.toString();
        if (vehicle == null) continue;
        final litres = _toDouble(item['totalPetrolLitres']);
        fuelTotals[vehicle] = (fuelTotals[vehicle] ?? 0) + litres;
      }
      for (final entry in fuelTotals.entries) {
        if (entry.value < 20) {
          _alerts.add(
            _AlertItem(
              title: 'Low fuel activity',
              body: '${entry.key} has low fuel activity this week.',
              severity: AlertSeverity.low,
            ),
          );
        }
      }
    } catch (_) {
      // Ignore errors; alerts are best-effort.
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Alerts'),
        backgroundColor: isDarkMode ? AppTheme.darkBackground : null,
        centerTitle: true,
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
                    'Loading alerts...',
                    style: TextStyle(
                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            )
          : _alerts.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_circle_outline, size: 64, color: isDarkMode ? Colors.grey[600] : Colors.grey[400]),
                      const SizedBox(height: 16),
                      Text(
                        'All clear',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w600,
                          color: isDarkMode ? Colors.white : Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'No alerts right now.',
                        style: TextStyle(color: isDarkMode ? Colors.grey[400] : Colors.grey[600], fontSize: 14),
                      ),
                    ],
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _alerts.length,
                    itemBuilder: (context, index) {
                      final alert = _alerts[index];
                      return Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(AppTheme.radius),
                          color: isDarkMode ? AppTheme.darkSurface : Colors.white,
                          border: Border.all(color: _severityColor(alert.severity).withOpacity(0.3)),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.notifications, color: _severityColor(alert.severity)),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    alert.title,
                                    style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      color: isDarkMode ? Colors.white : Colors.black87,
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(alert.body),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
    );
  }

  Color _severityColor(AlertSeverity severity) {
    switch (severity) {
      case AlertSeverity.high:
        return Colors.red;
      case AlertSeverity.medium:
        return Colors.orange;
      case AlertSeverity.low:
        return Colors.blue;
    }
  }

  double _toDouble(Object? value) {
    if (value == null) return 0;
    if (value is num) return value.toDouble();
    return double.tryParse(value.toString()) ?? 0;
  }

  static String _formatAlertDate(DateTime d) {
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }
}

enum AlertSeverity { low, medium, high }

class _AlertItem {
  _AlertItem({
    required this.title,
    required this.body,
    required this.severity,
  });

  final String title;
  final String body;
  final AlertSeverity severity;
}

