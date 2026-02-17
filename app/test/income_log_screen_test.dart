import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/screens/income_log_screen.dart';
import 'package:app/theme.dart';

/// Use a tall viewport so the whole form is on-screen (avoids multiple Scrollables and scrollUntilVisible).
void _setTallViewport(WidgetTester tester) {
  tester.binding.window.physicalSizeTestValue = const ui.Size(400, 2400);
  addTearDown(() => tester.binding.window.clearPhysicalSizeTestValue());
}

void main() {
  group('IncomeLogScreen', () {
    testWidgets('shows Vehicle Income Log title', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: IncomeLogScreen()),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 3));
      expect(find.text('Vehicle Income Log'), findsOneWidget);
    });

    testWidgets('shows Trip Details and late income toggle', (WidgetTester tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: IncomeLogScreen()),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 3));
      expect(find.text('Trip Details'), findsOneWidget);
      expect(find.text('Log for a past date (late income)'), findsOneWidget);
      expect(find.byType(Switch), findsOneWidget);
    });

    testWidgets('toggling late income shows banner and date', (WidgetTester tester) async {
      _setTallViewport(tester);
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: IncomeLogScreen()),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 3));
      await tester.tap(find.byType(Switch));
      await tester.pumpAndSettle();
      expect(find.text('This income is for a past date and will require admin approval before it is fully recorded.'), findsOneWidget);
      expect(find.text('Income date'), findsOneWidget);
    });

    testWidgets('entering start and end km shows distance', (WidgetTester tester) async {
      _setTallViewport(tester);
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: IncomeLogScreen()),
        ),
      );
      await tester.pumpAndSettle(const Duration(seconds: 3));
      await tester.enterText(find.byType(TextFormField).at(0), '100');
      await tester.enterText(find.byType(TextFormField).at(1), '150');
      await tester.pumpAndSettle();
      expect(find.text('Distance: 50 km'), findsOneWidget);
    });
  });
}

