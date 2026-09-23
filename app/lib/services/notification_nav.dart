import 'package:flutter/material.dart';
import '../screens/alerts_screen.dart';
import '../screens/income_log_screen.dart';
import '../screens/maintenance_screen.dart';

/// Navigate from OneSignal / vitapp:// deep links into the right screen.
class NotificationNav {
  NotificationNav._();

  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  static void handleUri(Uri uri) {
    final host = uri.host.toLowerCase();
    final id = uri.queryParameters['id'];
    switch (host) {
      case 'alerts':
        openAlerts(highlightId: id);
        break;
      case 'income-log':
        _push(const IncomeLogScreen());
        break;
      case 'maintenance':
        _push(const MaintenanceScreen());
        break;
      case 'tracking':
        openAlerts();
        break;
      default:
        if (host.isNotEmpty) openAlerts(highlightId: id);
    }
  }

  static void handleDeepLinkString(String? link) {
    if (link == null || link.isEmpty) return;
    final uri = Uri.tryParse(link);
    if (uri == null) return;
    if (uri.scheme == 'vitapp') {
      handleUri(uri);
      return;
    }
    // Fall back: treat opaque path as alerts id
    openAlerts(highlightId: link);
  }

  static void openAlerts({String? highlightId}) {
    _push(AlertsScreen(highlightId: highlightId));
  }

  static void fromOneSignalData(Map<String, dynamic> data) {
    final deepLink = data['deepLink']?.toString();
    if (deepLink != null && deepLink.isNotEmpty) {
      handleDeepLinkString(deepLink);
      return;
    }
    final id = data['notificationId']?.toString();
    openAlerts(highlightId: id);
  }

  static void _push(Widget screen) {
    final nav = navigatorKey.currentState;
    if (nav == null) return;
    nav.push(MaterialPageRoute(builder: (_) => screen));
  }
}
