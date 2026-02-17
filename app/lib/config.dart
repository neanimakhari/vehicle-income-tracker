/// API base URL for the mobile app (include /v1 if your API uses versioned routes).
/// Default: 192.168.0.118:3000 (this machine's Wi‑Fi IP; API verified reachable).
/// Override: flutter run --dart-define=API_BASE_URL=http://OTHER_IP:3000
class AppConfig {
  static const String _rawBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://192.168.0.118:3000',
  );

  /// Base URL with /v1 suffix so all tenant routes work (e.g. /v1/tenant/auth/login).
  static String get apiBaseUrl =>
      _rawBaseUrl.endsWith('/v1') ? _rawBaseUrl : '$_rawBaseUrl/v1';

  /// App version shown in sidebar. Keep in sync with pubspec.yaml version.
  static const appVersion = String.fromEnvironment(
    'APP_VERSION',
    defaultValue: '1.0.0',
  );
}



