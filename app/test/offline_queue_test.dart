import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vit_mobile/services/offline_queue.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final store = <String, String>{};
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(channel, (MethodCall methodCall) async {
    if (methodCall.method == 'read') {
      final key = (methodCall.arguments as Map)['key'] as String?;
      return key == null ? null : store[key];
    }
    if (methodCall.method == 'write') {
      final args = methodCall.arguments as Map;
      store[args['key'] as String] = args['value'] as String;
      return null;
    }
    if (methodCall.method == 'delete') {
      final key = (methodCall.arguments as Map)['key'] as String?;
      if (key != null) store.remove(key);
      return null;
    }
    if (methodCall.method == 'deleteAll') {
      store.clear();
      return null;
    }
    if (methodCall.method == 'readAll') return Map<String, String>.from(store);
    return null;
  });

  group('OfflineQueue', () {
    setUp(() async {
      store.clear();
      await OfflineQueue.clearQueue();
    });

    test('pendingCount is 0 after clear', () async {
      final count = await OfflineQueue.pendingCount();
      expect(count, 0);
    });

    test('enqueueIncome then pendingCount increases', () async {
      await OfflineQueue.enqueueIncome({
        'vehicleId': 'v1',
        'income': 100,
        'loggedOn': DateTime.now().toIso8601String(),
      });
      final count = await OfflineQueue.pendingCount();
      expect(count, 1);
    });

    test('clearQueue after enqueue leaves pendingCount 0', () async {
      await OfflineQueue.enqueueIncome({
        'vehicleId': 'v1',
        'income': 100,
        'loggedOn': DateTime.now().toIso8601String(),
      });
      await OfflineQueue.clearQueue();
      final count = await OfflineQueue.pendingCount();
      expect(count, 0);
    });

    test('listItems returns enqueued payload', () async {
      await OfflineQueue.enqueueIncome({'income': 50});
      final items = await OfflineQueue.listItems();
      expect(items.length, 1);
      expect(items.first.payload['income'], 50);
      expect(items.first.status, 'pending');
    });
  });
}
