import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/services/session.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // Stub flutter_secure_storage so Session.clear()/load() don't hit platform
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
    channel,
    (MethodCall methodCall) async {
      if (methodCall.method == 'read' || methodCall.method == 'readAll') return null;
      if (methodCall.method == 'delete' || methodCall.method == 'write' || methodCall.method == 'deleteAll') return null;
      return null;
    },
  );

  group('Session', () {
    tearDown(() async {
      await Session.clear();
    });

    test('clear() sets in-memory accessToken to null', () async {
      Session.accessToken = 'fake-token';
      await Session.clear();
      expect(Session.accessToken, isNull);
    });

    test('clear() sets tenantId and email to null', () async {
      Session.tenantId = 't1';
      Session.email = 'a@b.com';
      await Session.clear();
      expect(Session.tenantId, isNull);
      expect(Session.email, isNull);
    });

    test('clear() sets rememberMe to true (default)', () async {
      Session.rememberMe = false;
      await Session.clear();
      expect(Session.rememberMe, isTrue);
    });
  });
}

