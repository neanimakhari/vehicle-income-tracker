import 'package:flutter_test/flutter_test.dart';
import 'package:app/services/api_service.dart';

void main() {
  group('ApiService', () {
    test('fetchLastOdometer with empty vehicle returns nulls without HTTP call', () async {
      final api = ApiService(baseUrl: 'http://test.example.com/v1');
      final result = await api.fetchLastOdometer('');
      expect(result['lastEndKm'], isNull);
      expect(result['lastLoggedOn'], isNull);
    });

    test('incomesPageSize is positive', () {
      expect(ApiService.incomesPageSize, greaterThan(0));
    });

    test('constructor with baseUrl uses provided url', () {
      const custom = 'http://custom:4000/v1';
      final api = ApiService(baseUrl: custom);
      expect(api.baseUrl, custom);
    });
  });
}

