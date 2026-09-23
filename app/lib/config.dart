/// API base URL for the mobile app (include /v1 if your API uses versioned routes).
/// Default: production API (HTTPS). For local dev use:
///   flutter run --dart-define=API_BASE_URL=http://YOUR_IP:3000
class AppConfig {
  static const String _rawBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://vit-api.vehinc.co.za',
  );

  /// Base URL with /v1 suffix so all tenant routes work (e.g. /v1/tenant/auth/login).
  static String get apiBaseUrl =>
      _rawBaseUrl.endsWith('/v1') ? _rawBaseUrl : '$_rawBaseUrl/v1';

  /// Origin without /v1 — for Socket.IO namespaces.
  static String get apiOrigin {
    final base = _rawBaseUrl.endsWith('/v1')
        ? _rawBaseUrl.substring(0, _rawBaseUrl.length - 3)
        : _rawBaseUrl;
    return base.endsWith('/') ? base.substring(0, base.length - 1) : base;
  }

  /// App version shown in sidebar. Keep in sync with pubspec.yaml version.
  static const appVersion = String.fromEnvironment(
    'APP_VERSION',
    defaultValue: '1.0.8',
  );
}



