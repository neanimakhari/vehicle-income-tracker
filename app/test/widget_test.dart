import 'package:flutter/services.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/main.dart';
import 'package:app/services/session.dart';
import 'package:app/screens/login_screen.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  // Stub flutter_secure_storage so VITApp/HomeGate don't hit platform (Session.load in main, etc.)
  const channel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
    channel,
    (MethodCall methodCall) async {
      if (methodCall.method == 'read' || methodCall.method == 'readAll') return null;
      if (methodCall.method == 'delete' || methodCall.method == 'write' || methodCall.method == 'deleteAll') return null;
      return null;
    },
  );

  group('VITApp', () {
    setUp(() async {
      await Session.clear();
    });

    testWidgets('app builds and shows login when not authenticated', (WidgetTester tester) async {
      await tester.pumpWidget(const VITApp());
      await tester.pumpAndSettle(const Duration(seconds: 3));
      expect(find.byType(LoginScreen), findsOneWidget);
    });

    testWidgets('app has correct title', (WidgetTester tester) async {
      await tester.pumpWidget(const VITApp());
      await tester.pumpAndSettle(const Duration(seconds: 3));
      final app = tester.widget<MaterialApp>(find.byType(MaterialApp));
      expect(app.title, 'VIT Mobile');
    });
  });
}
