import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// First-run onboarding checklist (dismissible). Survives until completed/skipped.
class OnboardingChecklist {
  static const _skippedKey = 'onboardingSkipped';
  static const _firstIncomeKey = 'onboardingFirstIncomeDone';
  static final _storage = FlutterSecureStorage();

  static bool skipped = false;
  static bool firstIncomeLogged = false;

  static Future<void> load() async {
    skipped = await _storage.read(key: _skippedKey) == 'true';
    firstIncomeLogged = await _storage.read(key: _firstIncomeKey) == 'true';
  }

  static Future<void> skip() async {
    skipped = true;
    await _storage.write(key: _skippedKey, value: 'true');
  }

  static Future<void> markFirstIncome() async {
    firstIncomeLogged = true;
    await _storage.write(key: _firstIncomeKey, value: 'true');
  }

  /// Cleared on full logout of user-specific flags is optional; keep across logout
  /// so returning drivers are not nagged. Reset only if explicitly needed.
}
