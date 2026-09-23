import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/offline_queue.dart';
import '../theme.dart';
import '../utils/app_toast.dart';
import 'income_log_screen.dart';

class OfflineQueueScreen extends StatefulWidget {
  const OfflineQueueScreen({super.key});

  @override
  State<OfflineQueueScreen> createState() => _OfflineQueueScreenState();
}

class _OfflineQueueScreenState extends State<OfflineQueueScreen> {
  bool _loading = true;
  bool _syncing = false;
  List<OfflineQueueItem> _items = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final items = await OfflineQueue.listItems();
    if (!mounted) return;
    setState(() {
      _items = items;
      _loading = false;
    });
  }

  Future<void> _sync() async {
    setState(() => _syncing = true);
    try {
      final n = await OfflineQueue.syncPending(ApiService());
      if (!mounted) return;
      AppToast.success(context, n > 0 ? 'Synced $n item(s)' : 'Nothing synced');
      await _load();
    } catch (e) {
      if (mounted) AppToast.error(context, 'Sync failed', e);
    } finally {
      if (mounted) setState(() => _syncing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final primary = Theme.of(context).colorScheme.primary;
    return Scaffold(
      backgroundColor: isDark ? AppTheme.darkBackground : Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Pending sync'),
        backgroundColor: isDark ? AppTheme.darkBackground : primary,
        foregroundColor: Colors.white,
        actions: [
          if (_items.any((i) => i.status == 'failed'))
            TextButton(
              onPressed: _syncing
                  ? null
                  : () async {
                      await OfflineQueue.retryAllFailed();
                      await _sync();
                    },
              child: const Text('Retry failed', style: TextStyle(color: Colors.white)),
            ),
          IconButton(
            onPressed: _syncing ? null : _sync,
            icon: _syncing
                ? const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Icon(Icons.sync),
          ),
        ],
      ),
      body: _loading
          ? Center(child: CircularProgressIndicator(color: primary))
          : _items.isEmpty
              ? _EmptyPending(onLogIncome: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const IncomeLogScreen()),
                  );
                })
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView.separated(
                    padding: const EdgeInsets.all(16),
                    itemCount: _items.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 8),
                    itemBuilder: (context, index) {
                      final item = _items[index];
                      final amount = item.payload['income'];
                      final vehicle = item.payload['vehicleId'] ?? item.payload['vehicleLabel'];
                      return Card(
                        child: ListTile(
                          leading: Icon(
                            item.status == 'failed'
                                ? Icons.error_outline
                                : Icons.cloud_upload_outlined,
                            color: item.status == 'failed'
                                ? AppTheme.danger
                                : primary,
                          ),
                          title: Text('R ${amount ?? '—'}'),
                          subtitle: Text(
                            [
                              'Vehicle: $vehicle',
                              'Status: ${item.status}',
                              if (item.lastError != null) item.lastError!,
                              item.createdAt,
                            ].join('\n'),
                          ),
                          isThreeLine: true,
                          trailing: PopupMenuButton<String>(
                            onSelected: (v) async {
                              if (v == 'retry') {
                                await OfflineQueue.retryItem(item.id);
                                await _sync();
                              } else if (v == 'remove') {
                                await OfflineQueue.removeItem(item.id);
                                await _load();
                              }
                            },
                            itemBuilder: (_) => const [
                              PopupMenuItem(value: 'retry', child: Text('Retry')),
                              PopupMenuItem(value: 'remove', child: Text('Remove')),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
    );
  }
}

class _EmptyPending extends StatelessWidget {
  const _EmptyPending({required this.onLogIncome});
  final VoidCallback onLogIncome;

  @override
  Widget build(BuildContext context) {
    final primary = Theme.of(context).colorScheme.primary;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_done_outlined, size: 56, color: primary.withOpacity(0.7)),
            const SizedBox(height: 16),
            const Text(
              'Nothing pending',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
            ),
            const SizedBox(height: 8),
            Text(
              'Offline income will appear here until it syncs.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey.shade600),
            ),
            const SizedBox(height: 24),
            FilledButton.icon(
              onPressed: onLogIncome,
              icon: const Icon(Icons.add),
              label: const Text('Log income'),
            ),
          ],
        ),
      ),
    );
  }
}
