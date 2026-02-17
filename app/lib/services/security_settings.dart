import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class SecuritySettings {
  static const _biometricsKey = 'biometricsEnabled';
  static const _lockTimeoutKey = 'lockTimeoutMinutes';
  static const _lastInactiveKey = 'lastInactiveAt';
  static final _storage = FlutterSecureStorage();

  static bool biometricsEnabled = false;
  static int lockTimeoutMinutes = 5;
  static DateTime? lastInactiveAt;

  static Future<void> load() async {
    final biometrics = await _storage.read(key: _biometricsKey);
    final timeout = await _storage.read(key: _lockTimeoutKey);
    final lastInactive = await _storage.read(key: _lastInactiveKey);
    biometricsEnabled = biometrics == 'true';
    lockTimeoutMinutes = int.tryParse(timeout ?? '') ?? 5;
    lastInactiveAt = lastInactive == null ? null : DateTime.tryParse(lastInactive);
  }

  static Future<void> save() async {
    await _storage.write(key: _biometricsKey, value: biometricsEnabled.toString());
    await _storage.write(key: _lockTimeoutKey, value: lockTimeoutMinutes.toString());
    if (lastInactiveAt != null) {
      await _storage.write(key: _lastInactiveKey, value: lastInactiveAt!.toIso8601String());
    } else {
      await _storage.delete(key: _lastInactiveKey);
    }
  }

  static Future<void> updateLastInactive(DateTime time) async {
    lastInactiveAt = time;
    await _storage.write(key: _lastInactiveKey, value: time.toIso8601String());
  }

  static Future<void> clear() async {
    biometricsEnabled = false;
    lockTimeoutMinutes = 5;
    lastInactiveAt = null;
    await _storage.delete(key: _biometricsKey);
    await _storage.delete(key: _lockTimeoutKey);
    await _storage.delete(key: _lastInactiveKey);
  }
}

