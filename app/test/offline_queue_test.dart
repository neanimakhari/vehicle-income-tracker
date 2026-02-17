import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/services/offline_queue.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // Stub flutter_secure_storage (OfflineQueue uses it for queue persistence)
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
    channel,
    (MethodCall methodCall) async {
      if (methodCall.method == 'read' || methodCall.method == 'readAll') return null;
      if (methodCall.method == 'delete' || methodCall.method == 'write' || methodCall.method == 'deleteAll') return null;
      return null;
    },
  );

  group('OfflineQueue', () {
    setUp(() async {
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
  });
}

