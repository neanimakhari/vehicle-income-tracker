import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class Session {
  static const _tokenKey = 'accessToken';
  static const _refreshTokenKey = 'refreshToken';
  static const _tenantKey = 'tenantId';
  static const _tenantNameKey = 'tenantName';
  static const _emailKey = 'email';
  static const _roleKey = 'role';
  static const _userIdKey = 'userId';
  static const _mfaEnabledKey = 'mfaEnabled';
  static const _deviceBindingIdKey = 'deviceBindingId';
  static const _requireBiometricsKey = 'requireBiometrics';
  static const _sessionTimeoutKey = 'sessionTimeoutMinutes';
  static const _rememberMeKey = 'rememberMe';
  static final _storage = FlutterSecureStorage();

  static String? accessToken;
  static String? refreshToken;
  static String? tenantId;
  static String? tenantName;
  static String? email;
  static String? role;
  static String? userId;
  static bool? mfaEnabled;
  static String? deviceBindingId;
  static bool? requireBiometrics;
  static int? sessionTimeoutMinutes;
  static bool rememberMe = true;

  static Future<void> load() async {
    accessToken = await _storage.read(key: _tokenKey);
    refreshToken = await _storage.read(key: _refreshTokenKey);
    tenantId = await _storage.read(key: _tenantKey);
    tenantName = await _storage.read(key: _tenantNameKey);
    email = await _storage.read(key: _emailKey);
    role = await _storage.read(key: _roleKey);
    userId = await _storage.read(key: _userIdKey);
    final mfaValue = await _storage.read(key: _mfaEnabledKey);
    mfaEnabled = mfaValue == null ? null : mfaValue == 'true';
    deviceBindingId = await _storage.read(key: _deviceBindingIdKey);
    final biometricValue = await _storage.read(key: _requireBiometricsKey);
    requireBiometrics = biometricValue == null ? null : biometricValue == 'true';
    final timeoutValue = await _storage.read(key: _sessionTimeoutKey);
    sessionTimeoutMinutes = timeoutValue == null ? null : int.tryParse(timeoutValue);
    final rememberValue = await _storage.read(key: _rememberMeKey);
    rememberMe = rememberValue != 'false';
  }

  static Future<void> save() async {
    if (accessToken != null) {
      await _storage.write(key: _tokenKey, value: accessToken);
    } else {
      await _storage.delete(key: _tokenKey);
    }
    if (refreshToken != null) {
      await _storage.write(key: _refreshTokenKey, value: refreshToken);
    } else {
      await _storage.delete(key: _refreshTokenKey);
    }
    if (tenantId != null) {
      await _storage.write(key: _tenantKey, value: tenantId);
    } else {
      await _storage.delete(key: _tenantKey);
    }
    if (tenantName != null) {
      await _storage.write(key: _tenantNameKey, value: tenantName);
    } else {
      await _storage.delete(key: _tenantNameKey);
    }
    if (email != null) {
      await _storage.write(key: _emailKey, value: email);
    } else {
      await _storage.delete(key: _emailKey);
    }
    if (role != null) {
      await _storage.write(key: _roleKey, value: role);
    } else {
      await _storage.delete(key: _roleKey);
    }
    if (userId != null) {
      await _storage.write(key: _userIdKey, value: userId);
    } else {
      await _storage.delete(key: _userIdKey);
    }
    if (mfaEnabled != null) {
      await _storage.write(key: _mfaEnabledKey, value: mfaEnabled.toString());
    } else {
      await _storage.delete(key: _mfaEnabledKey);
    }
    if (deviceBindingId != null) {
      await _storage.write(key: _deviceBindingIdKey, value: deviceBindingId);
    } else {
      await _storage.delete(key: _deviceBindingIdKey);
    }
    if (requireBiometrics != null) {
      await _storage.write(
        key: _requireBiometricsKey,
        value: requireBiometrics.toString(),
      );
    } else {
      await _storage.delete(key: _requireBiometricsKey);
    }
    if (sessionTimeoutMinutes != null) {
      await _storage.write(
        key: _sessionTimeoutKey,
        value: sessionTimeoutMinutes.toString(),
      );
    } else {
      await _storage.delete(key: _sessionTimeoutKey);
    }
    await _storage.write(key: _rememberMeKey, value: rememberMe.toString());
    if (!rememberMe) {
      await _storage.delete(key: _emailKey);
      await _storage.delete(key: _tenantKey);
    }
  }

  /// Full clear (e.g. on 401 or account switch). Removes all stored data.
  static Future<void> clear() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _tenantKey);
    await _storage.delete(key: _tenantNameKey);
    await _storage.delete(key: _emailKey);
    await _storage.delete(key: _roleKey);
    await _storage.delete(key: _userIdKey);
    await _storage.delete(key: _mfaEnabledKey);
    await _storage.delete(key: _deviceBindingIdKey);
    await _storage.delete(key: _requireBiometricsKey);
    await _storage.delete(key: _sessionTimeoutKey);
    await _storage.delete(key: _rememberMeKey);
    accessToken = null;
    refreshToken = null;
    tenantId = null;
    tenantName = null;
    email = null;
    role = null;
    userId = null;
    mfaEnabled = null;
    deviceBindingId = null;
    requireBiometrics = null;
    sessionTimeoutMinutes = null;
    rememberMe = true;
  }

  /// Logout: clear access token and all user-specific state so a new login sees a clean slate.
  /// Clears in-memory user fields so no UI shows the previous user; keeps refreshToken, tenantId, email
  /// in storage so "Login with Biometrics" can refresh for the same user.
  static Future<void> clearForLogout() async {
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _userIdKey);
    await _storage.delete(key: _roleKey);
    await _storage.delete(key: _mfaEnabledKey);
    await _storage.delete(key: _tenantNameKey);
    accessToken = null;
    userId = null;
    role = null;
    mfaEnabled = null;
    tenantName = null;
    email = null;
    tenantId = null;
  }
}

