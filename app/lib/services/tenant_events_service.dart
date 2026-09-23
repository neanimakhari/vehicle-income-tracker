import 'dart:async';
import 'package:flutter/widgets.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../config.dart';
import 'api_service.dart';
import 'brand_theme_controller.dart';
import 'session.dart';

/// Listens for tenant `brand.updated` and refreshes BrandThemeController.
/// Falls back to resume + periodic policy poll.
class TenantEventsService with WidgetsBindingObserver {
  TenantEventsService._();
  static final TenantEventsService instance = TenantEventsService._();

  io.Socket? _socket;
  Timer? _pollTimer;
  bool _started = false;
  bool _refreshing = false;

  void start() {
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    _connect();
    _pollTimer = Timer.periodic(const Duration(minutes: 10), (_) {
      unawaited(refreshBrand());
    });
  }

  void stop() {
    if (!_started) return;
    _started = false;
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    _pollTimer = null;
    _socket?.dispose();
    _socket = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(refreshBrand());
      if (_socket == null || _socket?.disconnected == true) {
        _connect();
      }
    }
  }

  void _connect() {
    final token = Session.accessToken;
    final tenant = Session.tenantId;
    if (token == null || tenant == null || tenant.isEmpty) return;

    _socket?.dispose();
    final origin = AppConfig.apiOrigin;
    _socket = io.io(
      '$origin/tenant-events',
      io.OptionBuilder()
          .setTransports(['websocket', 'polling'])
          .setAuth({'token': token, 'tenantId': tenant})
          .setQuery({'tenantId': tenant})
          .enableReconnection()
          .build(),
    );
    _socket!.onConnect((_) {
      _socket!.emit('join', {'tenantId': tenant});
    });
    _socket!.on('brand.updated', (_) {
      unawaited(refreshBrand());
    });
  }

  Future<void> refreshBrand() async {
    if (_refreshing) return;
    if (Session.accessToken == null) return;
    _refreshing = true;
    try {
      final policy = await ApiService().fetchTenantPolicy();
      BrandThemeController.instance.applyFromPolicy(policy);
    } catch (_) {
      // Keep current brand; next poll/socket will retry
    } finally {
      _refreshing = false;
    }
  }
}
