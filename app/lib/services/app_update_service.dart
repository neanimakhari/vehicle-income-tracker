import 'dart:convert';
import 'dart:io';

import 'package:crypto/crypto.dart';
import 'package:http/http.dart' as http;
import 'package:open_filex/open_filex.dart';
import 'package:package_info_plus/package_info_plus.dart';
import 'package:path_provider/path_provider.dart';

import '../config.dart';
import 'session.dart';

class MobileAppLatest {
  MobileAppLatest({
    required this.versionName,
    required this.versionCode,
    required this.minSupportedVersionCode,
    required this.sha256,
    required this.releaseNotes,
  });

  final String versionName;
  final int versionCode;
  final int minSupportedVersionCode;
  final String sha256;
  final String releaseNotes;

  factory MobileAppLatest.fromJson(Map<String, dynamic> json) {
    return MobileAppLatest(
      versionName: json['versionName']?.toString() ?? '',
      versionCode: int.tryParse('${json['versionCode']}') ?? 0,
      minSupportedVersionCode:
          int.tryParse('${json['minSupportedVersionCode']}') ?? 1,
      sha256: json['sha256']?.toString() ?? '',
      releaseNotes: json['releaseNotes']?.toString() ?? '',
    );
  }
}

class AppUpdateService {
  static Future<MobileAppLatest?> checkForUpdate() async {
    if (!Platform.isAndroid) return null;
    try {
      final info = await PackageInfo.fromPlatform();
      final currentCode = int.tryParse(info.buildNumber) ?? 0;
      final res = await http
          .get(Uri.parse('${AppConfig.apiBaseUrl}/public/mobile-app/latest'))
          .timeout(const Duration(seconds: 12));
      if (res.statusCode != 200) return null;
      final latest = MobileAppLatest.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>,
      );
      if (latest.versionCode <= currentCode) return null;
      return latest;
    } catch (_) {
      return null;
    }
  }

  static Future<String?> downloadAuthenticatedApk(
    MobileAppLatest latest, {
    void Function(double progress)? onProgress,
  }) async {
    final access = Session.accessToken;
    final tenant = Session.tenantId;
    if (access == null || tenant == null) return null;

    final info = await PackageInfo.fromPlatform();
    final ticketRes = await http
        .post(
          Uri.parse('${AppConfig.apiBaseUrl}/tenant/mobile-app/download-ticket'),
          headers: {
            'Authorization': 'Bearer $access',
            'x-tenant-id': tenant,
            'x-app-version-code': info.buildNumber,
          },
        )
        .timeout(const Duration(seconds: 20));
    if (ticketRes.statusCode != 200 && ticketRes.statusCode != 201) {
      return null;
    }
    final ticketJson = jsonDecode(ticketRes.body) as Map<String, dynamic>;
    final url = ticketJson['downloadUrl']?.toString();
    if (url == null || url.isEmpty) return null;

    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/vit-update-${latest.versionCode}.apk');
    final req = http.Request('GET', Uri.parse(url));
    final streamed = await req.send();
    if (streamed.statusCode != 200) return null;
    final total = streamed.contentLength ?? 0;
    final sink = file.openWrite();
    var received = 0;
    await for (final chunk in streamed.stream) {
      sink.add(chunk);
      received += chunk.length;
      if (total > 0 && onProgress != null) onProgress(received / total);
    }
    await sink.close();

    final expected = latest.sha256.toLowerCase().trim();
    if (expected.isNotEmpty) {
      final bytes = await file.readAsBytes();
      final actual = sha256.convert(bytes).toString();
      if (actual != expected) {
        await file.delete();
        return null;
      }
    }
    return file.path;
  }

  static Future<void> installApk(String path) async {
    await OpenFilex.open(path);
  }
}
