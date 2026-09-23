/// OneSignal push prep for the driver app.
///
/// When credentials arrive:
/// 1. Add to pubspec.yaml: `onesignal_flutter: ^5.x`
/// 2. Pass App ID via `--dart-define=ONESIGNAL_APP_ID=...`
/// 3. Call [OneSignalPushBootstrap.init] from main() then [loginUser] after successful auth.
///
/// Server targets `include_aliases.external_id` = driver user UUID (JWT `sub`).
/// See docs/ONESIGNAL-NOTIFICATIONS.md
library;

import 'package:flutter/foundation.dart';

/// Compile-time App ID (empty until you supply credentials).
const String kOneSignalAppId = String.fromEnvironment(
  'ONESIGNAL_APP_ID',
  defaultValue: '',
);

class OneSignalPushBootstrap {
  OneSignalPushBootstrap._();

  static bool get isConfigured => kOneSignalAppId.isNotEmpty;

  /// Placeholder — wire onesignal_flutter here after the package is added.
  static Future<void> init() async {
    if (!isConfigured) {
      debugPrint('OneSignal: ONESIGNAL_APP_ID not set — push disabled');
      return;
    }
    debugPrint(
      'OneSignal: App ID present ($kOneSignalAppId) — add onesignal_flutter and implement init',
    );
    // TODO(onesignal):
    // OneSignal.initialize(kOneSignalAppId);
    // OneSignal.Notifications.requestPermission(true);
  }

  /// Call after login with the driver user id (JWT sub).
  static Future<void> loginUser(String userId) async {
    if (!isConfigured || userId.isEmpty) return;
    debugPrint('OneSignal: loginUser($userId) — implement OneSignal.login');
    // TODO(onesignal): await OneSignal.login(userId);
  }

  static Future<void> logoutUser() async {
    if (!isConfigured) return;
    // TODO(onesignal): await OneSignal.logout();
  }
}
