import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:app/theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('AppTheme', () {
    test('radius and pillRadius are positive', () {
      expect(AppTheme.radius, greaterThan(0));
      expect(AppTheme.pillRadius, greaterThan(0));
    });

    test('primary color is teal', () {
      expect(AppTheme.primary, Colors.teal);
    });

    test('light() returns a non-null ThemeData', () {
      final theme = AppTheme.light();
      expect(theme, isNotNull);
      expect(theme.brightness, Brightness.light);
      expect(theme.colorScheme.primary, AppTheme.primary);
    }, skip: 'GoogleFonts loading can fail in test environment');

    test('dark() returns a non-null ThemeData', () {
      final theme = AppTheme.dark();
      expect(theme, isNotNull);
      expect(theme.brightness, Brightness.dark);
      expect(theme.colorScheme.primary, AppTheme.primary);
    }, skip: 'GoogleFonts loading can fail in test environment');

    test('danger and success colors are defined', () {
      expect(AppTheme.danger, isNotNull);
      expect(AppTheme.success, isNotNull);
    });
  });
}

