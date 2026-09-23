import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_service.dart';

class OfflineQueueItem {
  OfflineQueueItem({
    required this.id,
    required this.type,
    required this.status,
    required this.attempts,
    required this.createdAt,
    required this.updatedAt,
    required this.payload,
    this.lastError,
    this.nextAttemptAt,
  });

  final String id;
  final String type;
  String status; // pending | failed
  int attempts;
  final String createdAt;
  String updatedAt;
  final Map<String, dynamic> payload;
  String? lastError;
  String? nextAttemptAt;

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'status': status,
        'attempts': attempts,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
        'payload': payload,
        if (lastError != null) 'lastError': lastError,
        if (nextAttemptAt != null) 'nextAttemptAt': nextAttemptAt,
      };

  factory OfflineQueueItem.fromJson(Map<String, dynamic> json) {
    final payloadRaw = json['payload'];
    return OfflineQueueItem(
      id: json['id']?.toString() ??
          'legacy-${json['createdAt'] ?? DateTime.now().millisecondsSinceEpoch}',
      type: json['type']?.toString() ?? 'income',
      status: json['status']?.toString() ?? 'pending',
      attempts: json['attempts'] is int
          ? json['attempts'] as int
          : int.tryParse('${json['attempts']}') ?? 0,
      createdAt: json['createdAt']?.toString() ??
          DateTime.now().toIso8601String(),
      updatedAt: json['updatedAt']?.toString() ??
          json['createdAt']?.toString() ??
          DateTime.now().toIso8601String(),
      payload: payloadRaw is Map<String, dynamic>
          ? payloadRaw
          : Map<String, dynamic>.from(payloadRaw as Map? ?? {}),
      lastError: json['lastError']?.toString(),
      nextAttemptAt: json['nextAttemptAt']?.toString(),
    );
  }
}

class OfflineQueue {
  static const _queueKey = 'offlineQueue';
  static const _maxAttempts = 8;
  static final _storage = FlutterSecureStorage();

  static Duration _backoffFor(int attempts) {
    // 30s → 2m → 10m → … cap ~1h
    final seconds = switch (attempts) {
      0 || 1 => 30,
      2 => 120,
      3 => 600,
      4 => 1800,
      _ => 3600,
    };
    return Duration(seconds: seconds);
  }

  static String _newId() =>
      'oq-${DateTime.now().microsecondsSinceEpoch}-${_randSuffix()}';

  static String _randSuffix() =>
      (DateTime.now().millisecondsSinceEpoch % 9973).toRadixString(16);

  static Future<List<OfflineQueueItem>> _loadItems() async {
    final raw = await _storage.read(key: _queueKey);
    if (raw == null || raw.isEmpty) return [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded
        .whereType<Map>()
        .map((e) => OfflineQueueItem.fromJson(Map<String, dynamic>.from(e)))
        .toList();
  }

  static Future<void> _saveItems(List<OfflineQueueItem> items) async {
    await _storage.write(
      key: _queueKey,
      value: jsonEncode(items.map((e) => e.toJson()).toList()),
    );
  }

  static Future<int> pendingCount() async {
    final items = await _loadItems();
    return items.where((i) => i.status == 'pending' || i.status == 'failed').length;
  }

  static Future<List<OfflineQueueItem>> listItems() => _loadItems();

  static Future<void> clearQueue() async {
    await _saveItems([]);
  }

  static Future<void> enqueueIncome(Map<String, dynamic> payload) async {
    final items = await _loadItems();
    final now = DateTime.now().toIso8601String();
    items.add(OfflineQueueItem(
      id: _newId(),
      type: 'income',
      status: 'pending',
      attempts: 0,
      createdAt: now,
      updatedAt: now,
      payload: payload,
    ));
    await _saveItems(items);
  }

  static Future<void> removeItem(String id) async {
    final items = await _loadItems();
    items.removeWhere((i) => i.id == id);
    await _saveItems(items);
  }

  static Future<void> retryItem(String id) async {
    final items = await _loadItems();
    final idx = items.indexWhere((i) => i.id == id);
    if (idx < 0) return;
    items[idx].status = 'pending';
    items[idx].nextAttemptAt = null;
    items[idx].lastError = null;
    items[idx].updatedAt = DateTime.now().toIso8601String();
    await _saveItems(items);
  }

  static Future<void> retryAllFailed() async {
    final items = await _loadItems();
    final now = DateTime.now().toIso8601String();
    for (final item in items) {
      if (item.status == 'failed') {
        item.status = 'pending';
        item.nextAttemptAt = null;
        item.lastError = null;
        item.updatedAt = now;
      }
    }
    await _saveItems(items);
  }

  /// Sync due items. Never drops the tail on a single failure.
  static Future<int> syncPending(ApiService api) async {
    final items = await _loadItems();
    if (items.isEmpty) return 0;

    final now = DateTime.now();
    var synced = 0;
    var changed = false;

    for (final item in items) {
      if (item.type != 'income') continue;
      if (item.status == 'failed' && item.attempts >= _maxAttempts) continue;
      if (item.nextAttemptAt != null) {
        final next = DateTime.tryParse(item.nextAttemptAt!);
        if (next != null && next.isAfter(now)) continue;
      }

      try {
        await api.createIncome(item.payload);
        item.status = 'synced';
        synced += 1;
        changed = true;
      } catch (e) {
        item.attempts += 1;
        item.lastError = e.toString();
        item.updatedAt = now.toIso8601String();
        if (item.attempts >= _maxAttempts) {
          item.status = 'failed';
          item.nextAttemptAt = null;
        } else {
          item.status = 'pending';
          item.nextAttemptAt =
              now.add(_backoffFor(item.attempts)).toIso8601String();
        }
        changed = true;
        // Continue remaining items — do not break / drop tail
      }
    }

    if (changed) {
      final remaining =
          items.where((i) => i.status != 'synced').toList(growable: false);
      await _saveItems(remaining);
    }
    return synced;
  }
}
