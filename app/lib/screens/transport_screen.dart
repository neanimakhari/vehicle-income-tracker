import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../theme.dart';
import '../utils/app_toast.dart';

/// Driver Phase 1b: list passengers, submit fee claims, see claim status.
class TransportScreen extends StatefulWidget {
  const TransportScreen({super.key});

  @override
  State<TransportScreen> createState() => _TransportScreenState();
}

class _TransportScreenState extends State<TransportScreen>
    with SingleTickerProviderStateMixin {
  final _api = ApiService();
  late TabController _tabs;
  List<Map<String, dynamic>> _passengers = [];
  List<Map<String, dynamic>> _claims = [];
  bool _loading = true;
  String? _error;
  bool _moduleMissing = false;

  @override
  void initState() {
    super.initState();
    _tabs = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    if (Session.accessToken == null) return;
    setState(() {
      _loading = true;
      _error = null;
      _moduleMissing = false;
    });
    try {
      final results = await Future.wait([
        _api.fetchTransportPassengers(),
        _api.fetchTransportClaims(),
      ]);
      if (!mounted) return;
      setState(() {
        _passengers = results[0];
        _claims = results[1];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      final msg = e.toString();
      final missing = msg.contains('403') ||
          msg.toLowerCase().contains('module') ||
          msg.toLowerCase().contains('entitlement') ||
          msg.toLowerCase().contains('forbidden');
      setState(() {
        _loading = false;
        _moduleMissing = missing;
        _error = missing
            ? 'Scholar & staff transport is not enabled for this company.'
            : 'Could not load transport data. Pull to retry.';
      });
    }
  }

  Future<void> _openClaimSheet(Map<String, dynamic> passenger) async {
    final amountCtrl = TextEditingController(
      text: passenger['feeAmount']?.toString() ?? '',
    );
    final notesCtrl = TextEditingController();
    String method = 'cash';
    final formKey = GlobalKey<FormState>();
    final ok = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Theme.of(context).brightness == Brightness.dark
          ? AppTheme.darkSurface
          : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 20,
          ),
          child: StatefulBuilder(
            builder: (ctx, setLocal) {
              return Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      'Record payment',
                      style: Theme.of(ctx).textTheme.titleLarge?.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      passenger['name']?.toString() ?? 'Passenger',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                    const SizedBox(height: 16),
                    TextFormField(
                      controller: amountCtrl,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      decoration: const InputDecoration(
                        labelText: 'Amount (R)',
                        border: OutlineInputBorder(),
                      ),
                      validator: (v) {
                        final n = num.tryParse(v?.trim() ?? '');
                        if (n == null || n <= 0) return 'Enter a valid amount';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: method,
                      decoration: const InputDecoration(
                        labelText: 'Method',
                        border: OutlineInputBorder(),
                      ),
                      items: const [
                        DropdownMenuItem(value: 'cash', child: Text('Cash')),
                        DropdownMenuItem(value: 'eft', child: Text('EFT')),
                        DropdownMenuItem(value: 'card', child: Text('Card')),
                        DropdownMenuItem(value: 'other', child: Text('Other')),
                      ],
                      onChanged: (v) => setLocal(() => method = v ?? 'cash'),
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: notesCtrl,
                      decoration: const InputDecoration(
                        labelText: 'Notes (optional)',
                        border: OutlineInputBorder(),
                      ),
                      maxLines: 2,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Your admin will approve this before it counts as income.',
                      style: TextStyle(fontSize: 12, color: Colors.grey[600]),
                    ),
                    const SizedBox(height: 16),
                    FilledButton(
                      onPressed: () {
                        if (formKey.currentState?.validate() != true) return;
                        Navigator.pop(ctx, true);
                      },
                      child: const Text('Submit'),
                    ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
    if (ok != true || !mounted) return;
    final amount = num.tryParse(amountCtrl.text.trim());
    if (amount == null) return;
    try {
      await _api.submitTransportClaim(
        passengerId: passenger['id'].toString(),
        amount: amount,
        method: method,
        notes: notesCtrl.text.trim().isEmpty ? null : notesCtrl.text.trim(),
      );
      if (!mounted) return;
      AppToast.success(context, 'Payment submitted for approval');
      await _load();
    } catch (e) {
      if (!mounted) return;
      AppToast.error(context, 'Submit failed. Try again.', e);
    }
  }

  Color _statusColor(String status, bool dark) {
    switch (status) {
      case 'approved':
        return AppTheme.success;
      case 'rejected':
        return AppTheme.danger;
      default:
        return dark ? Colors.amber[300]! : Colors.orange[800]!;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scholar & staff'),
        bottom: TabBar(
          controller: _tabs,
          tabs: const [
            Tab(text: 'Passengers'),
            Tab(text: 'My claims'),
          ],
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          _moduleMissing ? Icons.lock_outline : Icons.error_outline,
                          size: 48,
                          color: Colors.grey,
                        ),
                        const SizedBox(height: 12),
                        Text(_error!, textAlign: TextAlign.center),
                        const SizedBox(height: 16),
                        if (!_moduleMissing)
                          FilledButton(onPressed: _load, child: const Text('Retry')),
                      ],
                    ),
                  ),
                )
              : RefreshIndicator(
                  onRefresh: _load,
                  child: TabBarView(
                    controller: _tabs,
                    children: [
                      _passengers.isEmpty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: const [
                                SizedBox(height: 120),
                                Center(
                                  child: Text(
                                    'No passengers assigned yet.\nAsk your admin to set them up.',
                                    textAlign: TextAlign.center,
                                  ),
                                ),
                              ],
                            )
                          : ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.all(16),
                              itemCount: _passengers.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (ctx, i) {
                                final p = _passengers[i];
                                final fee = p['feeAmount'];
                                final type = p['type']?.toString() ?? 'scholar';
                                return Card(
                                  color: isDark ? AppTheme.darkSurface : Colors.white,
                                  child: ListTile(
                                    title: Text(
                                      p['name']?.toString() ?? 'Passenger',
                                      style: const TextStyle(fontWeight: FontWeight.w600),
                                    ),
                                    subtitle: Text(
                                      [
                                        type,
                                        if (fee != null) 'Fee R $fee',
                                        if (p['contactName'] != null)
                                          p['contactName'].toString(),
                                      ].where((s) => s.toString().isNotEmpty).join(' · '),
                                    ),
                                    trailing: FilledButton.tonal(
                                      onPressed: () => _openClaimSheet(p),
                                      child: const Text('Paid'),
                                    ),
                                  ),
                                );
                              },
                            ),
                      _claims.isEmpty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              children: const [
                                SizedBox(height: 120),
                                Center(child: Text('No claims yet.')),
                              ],
                            )
                          : ListView.separated(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.all(16),
                              itemCount: _claims.length,
                              separatorBuilder: (_, __) => const SizedBox(height: 8),
                              itemBuilder: (ctx, i) {
                                final c = _claims[i];
                                final status = (c['status']?.toString() ?? 'pending').toLowerCase();
                                final amount = c['amount'];
                                final paidAt = c['paidAt']?.toString() ?? c['createdAt']?.toString() ?? '';
                                final dateLabel = paidAt.length >= 10 ? paidAt.substring(0, 10) : paidAt;
                                return Card(
                                  color: isDark ? AppTheme.darkSurface : Colors.white,
                                  child: ListTile(
                                    title: Text(
                                      'R ${amount ?? 0}',
                                      style: const TextStyle(fontWeight: FontWeight.w600),
                                    ),
                                    subtitle: Text(dateLabel),
                                    trailing: Text(
                                      status.toUpperCase(),
                                      style: TextStyle(
                                        fontWeight: FontWeight.bold,
                                        color: _statusColor(status, isDark),
                                        fontSize: 12,
                                      ),
                                    ),
                                  ),
                                );
                              },
                            ),
                    ],
                  ),
                ),
    );
  }
}
