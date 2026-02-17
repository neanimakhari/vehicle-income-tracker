import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'api_service.dart';

class OfflineQueue {
  static const _queueKey = 'offlineQueue';
  static final _storage = FlutterSecureStorage();

  static Future<List<Map<String, dynamic>>> _loadQueue() async {
    final raw = await _storage.read(key: _queueKey);
    if (raw == null || raw.isEmpty) {
      return [];
    }
    final decoded = jsonDecode(raw);
    if (decoded is List) {
      return decoded.cast<Map<String, dynamic>>();
    }
    return [];
  }

  static Future<void> _saveQueue(List<Map<String, dynamic>> queue) async {
    await _storage.write(key: _queueKey, value: jsonEncode(queue));
  }

  static Future<int> pendingCount() async {
    final queue = await _loadQueue();
    return queue.length;
  }

  /// Clears all pending offline items (e.g. on logout so the next user does not see or sync previous user's data).
  static Future<void> clearQueue() async {
    await _saveQueue([]);
  }

  static Future<void> enqueueIncome(Map<String, dynamic> payload) async {
    final queue = await _loadQueue();
    queue.add({
      'type': 'income',
      'createdAt': DateTime.now().toIso8601String(),
      'payload': payload,
    });
    await _saveQueue(queue);
  }

  static Future<int> syncPending(ApiService api) async {
    final queue = await _loadQueue();
    if (queue.isEmpty) {
      return 0;
    }
    final remaining = <Map<String, dynamic>>[];
    int synced = 0;
    for (final item in queue) {
      final type = item['type']?.toString();
      final payload = item['payload'];
      if (type == 'income' && payload is Map<String, dynamic>) {
        try {
          await api.createIncome(payload);
          synced += 1;
          continue;
        } catch (_) {
          remaining.add(item);
          break;
        }
      } else {
        remaining.add(item);
      }
    }
    if (remaining.length != queue.length) {
      await _saveQueue(remaining);
    }
    return synced;
  }
}

