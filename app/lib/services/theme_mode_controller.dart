import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists Light / Dark / System appearance. Survives logout.
class ThemeModeController extends ChangeNotifier {
  ThemeModeController._();
  static final ThemeModeController instance = ThemeModeController._();

  static const _key = 'themeMode';
  static final _storage = FlutterSecureStorage();

  ThemeMode mode = ThemeMode.system;
  bool loaded = false;

  Future<void> load() async {
    final raw = await _storage.read(key: _key);
    mode = switch (raw) {
      'light' => ThemeMode.light,
      'dark' => ThemeMode.dark,
      _ => ThemeMode.system,
    };
    loaded = true;
    notifyListeners();
  }

  Future<void> setMode(ThemeMode next) async {
    mode = next;
    final value = switch (next) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
    };
    await _storage.write(key: _key, value: value);
    notifyListeners();
  }

  String get label => switch (mode) {
        ThemeMode.light => 'Light',
        ThemeMode.dark => 'Dark',
        ThemeMode.system => 'System',
      };
}
