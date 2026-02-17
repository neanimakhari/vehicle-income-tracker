import 'package:device_info_plus/device_info_plus.dart';

class DeviceInfoService {
  static final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();

  static Future<Map<String, String>> getDeviceDetails() async {
    try {
      final info = await _deviceInfo.deviceInfo;
      final data = info.data;
      final deviceId = data['androidId']?.toString() ??
          data['identifierForVendor']?.toString() ??
          data['id']?.toString() ??
          'unknown';
      final deviceName =
          data['model']?.toString() ??
          data['name']?.toString() ??
          data['device']?.toString() ??
          'unknown';
      return {
        'deviceId': deviceId,
        'deviceName': deviceName,
      };
    } catch (_) {
      return {
        'deviceId': 'unknown',
        'deviceName': 'unknown',
      };
    }
  }
}

