import 'package:flutter_test/flutter_test.dart';
import 'package:app/config.dart';

void main() {
  group('AppConfig', () {
    test('apiBaseUrl returns a non-empty string', () {
      expect(AppConfig.apiBaseUrl, isNotEmpty);
    });

    test('apiBaseUrl ends with /v1 when default base does not', () {
      // Default fromEnvironment is 192.168.0.118:3000, so result should be .../v1
      final url = AppConfig.apiBaseUrl;
      expect(url.endsWith('/v1'), isTrue);
    });

    test('appVersion returns a non-empty string', () {
      expect(AppConfig.appVersion, isNotEmpty);
    });
  });
}

