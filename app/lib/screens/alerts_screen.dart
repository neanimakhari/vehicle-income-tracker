import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/offline_queue.dart';
import '../services/session.dart';
import '../theme.dart';

class AlertsScreen extends StatefulWidget {
  const AlertsScreen({super.key, this.highlightId});

  /// When opened from a push / deep link, focus this notification and mark read.
  final String? highlightId;

  @override
  State<AlertsScreen> createState() => _AlertsScreenState();
}

class _AlertsScreenState extends State<AlertsScreen> {
  final _api = ApiService();
  bool _loading = true;
  final List<_AlertItem> _messages = [];
  final List<_AlertItem> _checks = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    _messages.clear();
    _checks.clear();
    try {
      try {
        final notifications = await _api.fetchTenantNotifications();
        for (final n in notifications) {
          final title = n['title']?.toString();
          final message = n['message']?.toString();
          if (title == null || title.isEmpty) continue;
          final createdAt = DateTime.tryParse(n['createdAt']?.toString() ?? '');
          final ageLabel =
              createdAt != null ? _formatAlertDate(createdAt) : null;
          final id = n['id']?.toString();
          final read = n['read'] == true;
          _messages.add(
            _AlertItem(
              id: id,
              title: title,
              body: ageLabel != null
                  ? '${message ?? ''}\n$ageLabel'.trim()
                  : (message ?? ''),
              severity: AlertSeverity.medium,
              read: read,
              isMessage: true,
            ),
          );
        }
      } catch (_) {}

      final policy = await _api.fetchTenantPolicy();
      final requireMfaUsers = policy['requireMfaUsers'] == true;
      if (requireMfaUsers && Session.mfaEnabled != true) {
        _checks.add(
          _AlertItem(
            title: 'MFA required',
            body: 'Enable MFA to keep access to the app.',
            severity: AlertSeverity.high,
          ),
        );
      }

      final pending = await OfflineQueue.pendingCount();
      if (pending > 0) {
        _checks.add(
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
          _checks.add(
            _AlertItem(
              title:
                  'Maintenance ${status == 'overdue' ? 'overdue' : 'due soon'}',
              body: task['vehicleLabel']?.toString() ?? 'Vehicle',
              severity: status == 'overdue'
                  ? AlertSeverity.high
                  : AlertSeverity.medium,
            ),
          );
        }
      }

      try {
        final profile = await _api.fetchDriverProfile();
        final now = DateTime.now();
        final in60Days = now.add(const Duration(days: 60));
        const labels = {
          'licenseExpiry': "Driver's licence",
          'prdpExpiry': 'PRDP certificate',
          'medicalCertificateExpiry': 'Medical certificate',
        };
        for (final entry in labels.entries) {
          final v = profile[entry.key]?.toString();
          if (v == null || v.isEmpty) continue;
          final d = DateTime.tryParse(v);
          if (d == null) continue;
          if (d.isBefore(now)) {
            _checks.add(_AlertItem(
              title: '${entry.value} expired',
              body: 'Expired on ${_formatAlertDate(d)}. Update in Profile.',
              severity: AlertSeverity.high,
            ));
          } else if (d.isBefore(in60Days)) {
            final days = d.difference(now).inDays;
            _checks.add(_AlertItem(
              title: '${entry.value} expiring soon',
              body:
                  'Expires ${_formatAlertDate(d)} (in $days days). Update in Profile.',
              severity:
                  days <= 14 ? AlertSeverity.high : AlertSeverity.medium,
            ));
          }
        }
      } catch (_) {}
    } catch (_) {
      // Ignore errors; alerts are best-effort.
    } finally {
      if (mounted) {
        setState(() => _loading = false);
        final highlight = widget.highlightId;
        if (highlight != null && highlight.isNotEmpty) {
          _markRead(highlight);
        }
      }
    }
  }

  Future<void> _markRead(String id) async {
    try {
      await _api.markNotificationRead(id);
      setState(() {
        for (final m in _messages) {
          if (m.id == id) m.read = true;
        }
      });
    } catch (_) {}
  }

  Future<void> _markAllRead() async {
    try {
      await _api.markAllNotificationsRead();
      setState(() {
        for (final m in _messages) {
          m.read = true;
        }
      });
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final unread = _messages.where((m) => !m.read).length;
    final empty = _messages.isEmpty && _checks.isEmpty;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Alerts'),
        backgroundColor: isDarkMode ? AppTheme.darkBackground : null,
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.maybePop(context),
        ),
        actions: [
          if (unread > 0)
            TextButton(
              onPressed: _markAllRead,
              child: const Text('Mark all read'),
            ),
        ],
      ),
      backgroundColor: isDarkMode ? AppTheme.darkBackground : Colors.white,
      body: _loading
          ? Center(
              child: CircularProgressIndicator(
                color: Theme.of(context).colorScheme.primary,
              ),
            )
          : empty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.check_circle_outline,
                          size: 64,
                          color: isDarkMode
                              ? Colors.grey[600]
                              : Colors.grey[400]),
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
                        style: TextStyle(
                          color: isDarkMode
                              ? Colors.grey[400]
                              : Colors.grey[600],
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
                      if (_messages.isNotEmpty) ...[
                        _sectionLabel(context, 'Messages', unread),
                        ..._messages.map((a) => _tile(context, a, isDarkMode)),
                        const SizedBox(height: 12),
                      ],
                      if (_checks.isNotEmpty) ...[
                        _sectionLabel(context, 'Checks', 0),
                        ..._checks.map((a) => _tile(context, a, isDarkMode)),
                      ],
                    ],
                  ),
                ),
    );
  }

  Widget _sectionLabel(BuildContext context, String label, int unread) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4),
      child: Row(
        children: [
          Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: Theme.of(context).colorScheme.primary,
            ),
          ),
          if (unread > 0) ...[
            const SizedBox(width: 8),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: Colors.red,
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                '$unread new',
                style: const TextStyle(color: Colors.white, fontSize: 11),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _tile(BuildContext context, _AlertItem alert, bool isDarkMode) {
    final highlighted = widget.highlightId != null &&
        alert.id != null &&
        alert.id == widget.highlightId;
    return InkWell(
      onTap: alert.id != null && !alert.read
          ? () => _markRead(alert.id!)
          : null,
      child: Container(
        margin: const EdgeInsets.only(bottom: 12),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppTheme.radius),
          color: isDarkMode ? AppTheme.darkSurface : Colors.white,
          border: Border.all(
            color: highlighted
                ? Theme.of(context).colorScheme.primary
                : _severityColor(alert.severity).withOpacity(0.3),
            width: highlighted ? 2 : 1,
          ),
        ),
        child: Row(
          children: [
            Icon(
              alert.read
                  ? Icons.notifications_none
                  : Icons.notifications_active,
              color: _severityColor(alert.severity),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    alert.title,
                    style: TextStyle(
                      fontWeight:
                          alert.read ? FontWeight.w500 : FontWeight.bold,
                      color: isDarkMode ? Colors.white : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(alert.body),
                ],
              ),
            ),
            if (!alert.read && alert.isMessage)
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(
                  color: Colors.red,
                  shape: BoxShape.circle,
                ),
              ),
          ],
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

  static String _formatAlertDate(DateTime d) {
    return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
  }
}

enum AlertSeverity { low, medium, high }

class _AlertItem {
  _AlertItem({
    this.id,
    required this.title,
    required this.body,
    required this.severity,
    this.read = true,
    this.isMessage = false,
  });

  final String? id;
  final String title;
  final String body;
  final AlertSeverity severity;
  bool read;
  final bool isMessage;
}
