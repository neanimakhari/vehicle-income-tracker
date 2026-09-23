import 'package:flutter/foundation.dart';
import 'package:onesignal_flutter/onesignal_flutter.dart';

/// Official OneSignal App ID for Vehinc / VIT (from OneSignal dashboard).
const String kOneSignalAppId = '8c514c8b-305c-45b2-ba6f-4ef92fa77ed0';

/// Centralized OneSignal wrapper — all SDK calls go through here.
/// See docs/ONESIGNAL-NOTIFICATIONS.md
class OneSignalService {
  OneSignalService._();
  static final OneSignalService instance = OneSignalService._();

  bool _initialized = false;

  bool get isInitialized => _initialized;

  /// Call once from [main] after [WidgetsFlutterBinding.ensureInitialized],
  /// before [runApp]. Do **not** request push permission here.
  Future<void> initialize({String appId = kOneSignalAppId}) async {
    if (_initialized) return;
    if (appId.isEmpty) {
      debugPrint('OneSignal: empty App ID — skip init');
      return;
    }

    if (kDebugMode) {
      OneSignal.Debug.setLogLevel(OSLogLevel.verbose);
    }

    OneSignal.initialize(appId);
    _initialized = true;
    debugPrint('OneSignal: initialized ($appId)');
  }

  /// Bind push identity to VIT user UUID (JWT `sub`) for server `external_id` targeting.
  Future<void> login(String externalUserId) async {
    if (!_initialized || externalUserId.isEmpty) return;
    OneSignal.login(externalUserId);
  }

  /// Login + request notification permission so the device becomes OneSignal-subscribed.
  /// Call after password login and on cold start when a session is already restored.
  Future<void> bindUserAndSubscribe(String externalUserId) async {
    if (!_initialized || externalUserId.isEmpty) return;
    OneSignal.login(externalUserId);
    try {
      await OneSignal.Notifications.requestPermission(true);
    } catch (e) {
      debugPrint('OneSignal: requestPermission failed: $e');
    }
  }

  Future<void> logout() async {
    if (!_initialized) return;
    OneSignal.logout();
  }

  Future<bool> requestPermission({bool fallbackToSettings = true}) async {
    if (!_initialized) return false;
    return OneSignal.Notifications.requestPermission(fallbackToSettings);
  }

  void setEmail(String email) {
    if (!_initialized || email.isEmpty) return;
    OneSignal.User.addEmail(email);
  }

  void setSmsNumber(String number) {
    if (!_initialized || number.isEmpty) return;
    OneSignal.User.addSms(number);
  }

  void setTag(String key, String value) {
    if (!_initialized || key.isEmpty) return;
    OneSignal.User.addTagWithKey(key, value);
  }

  void setLogLevel(OSLogLevel level) {
    OneSignal.Debug.setLogLevel(level);
  }

  void setNotificationClickListener(
    void Function(OSNotificationClickEvent) handler,
  ) {
    OneSignal.Notifications.addClickListener(handler);
  }

  void setNotificationForegroundListener(
    void Function(OSNotificationWillDisplayEvent) handler,
  ) {
    OneSignal.Notifications.addForegroundWillDisplayListener(handler);
  }
}

/// Back-compat aliases used by earlier scaffold hooks.
class OneSignalPushBootstrap {
  OneSignalPushBootstrap._();

  static bool get isConfigured => kOneSignalAppId.isNotEmpty;

  static Future<void> init() => OneSignalService.instance.initialize();

  static Future<void> loginUser(String userId) =>
      OneSignalService.instance.login(userId);

  static Future<void> logoutUser() => OneSignalService.instance.logout();
}
