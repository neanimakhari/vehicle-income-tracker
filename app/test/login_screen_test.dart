import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/screens/login_screen.dart';
import 'package:app/theme.dart';

void main() {
  group('LoginScreen', () {
    testWidgets('shows email and password fields', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: const LoginScreen(),
        ),
      );
      expect(find.text('Email'), findsOneWidget);
      expect(find.text('Password'), findsOneWidget);
    });

    testWidgets('shows Tenant and Login button', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: const LoginScreen(),
        ),
      );
      expect(find.text('Tenant'), findsOneWidget);
      expect(find.text('Sign in'), findsOneWidget);
    });

    testWidgets('can enter email and password', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: const LoginScreen(),
        ),
      );
      // Tenant=0, Email=1, Password=2, MFA=3
      await tester.enterText(find.byType(TextFormField).at(1), 'test@example.com');
      await tester.enterText(find.byType(TextFormField).at(2), 'password123');
      expect(find.text('test@example.com'), findsOneWidget);
      expect(find.text('password123'), findsOneWidget);
    });
  });
}

