import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_windowmanager/flutter_windowmanager.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:app_links/app_links.dart';
import 'services/session.dart';
import 'services/api_service.dart';
import 'services/offline_queue.dart';
import 'services/security_settings.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';
import 'screens/mfa_setup_screen.dart';
import 'screens/biometric_lock_screen.dart';
import 'screens/security_blocked_screen.dart';
import 'screens/reset_password_link_screen.dart';
import 'screens/verify_email_link_screen.dart';
import 'screens/splash_screen.dart';
import 'theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Session.load();
  await SecuritySettings.load();
  if (Platform.isAndroid) {
    await FlutterWindowManager.addFlags(FlutterWindowManager.FLAG_SECURE);
  }
  runApp(const VITApp());
}

class VITApp extends StatelessWidget {
  const VITApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VIT Mobile',
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      home: const InitialRoute(),
    );
  }
}

/// Resolves initial route: deep link (reset/verify) or default HomeGate.
class InitialRoute extends StatefulWidget {
  const InitialRoute({super.key});

  @override
  State<InitialRoute> createState() => _InitialRouteState();
}

class _InitialRouteState extends State<InitialRoute> {
  final AppLinks _appLinks = AppLinks();
  Widget? _initialScreen;

  @override
  void initState() {
    super.initState();
    _resolveInitialLink();
    _appLinks.uriLinkStream.listen(_onLink);
  }

  Future<void> _resolveInitialLink() async {
    try {
      final uri = await _appLinks.getInitialLink();
      if (uri != null && mounted) _applyDeepLink(uri);
    } catch (_) {}
  }

  void _onLink(Uri uri) {
    _applyDeepLink(uri);
  }

  void _applyDeepLink(Uri uri) {
    final host = uri.host.toLowerCase();
    final token = uri.queryParameters['token'];
    final tenant = uri.queryParameters['tenant'];
    if (token == null || token.isEmpty) return;
    Widget? screen;
    if (host == 'reset-password') {
      screen = ResetPasswordLinkScreen(token: token, tenantId: tenant);
    } else if (host == 'verify-email') {
      screen = VerifyEmailLinkScreen(token: token, tenantId: tenant);
    }
    if (screen != null && mounted) {
      setState(() => _initialScreen = screen);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_initialScreen != null) {
      return _initialScreen!;
    }
    return const HomeGate();
  }
}

class HomeGate extends StatefulWidget {
  const HomeGate({super.key});

  @override
  State<HomeGate> createState() => _HomeGateState();
}

class _HomeGateState extends State<HomeGate> with WidgetsBindingObserver {
  bool _loading = true;
  bool _requiresMfa = false;
  bool _locked = false;
  bool _securityBlocked = false;
  final _connectivity = Connectivity();
  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  bool _isOnline = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _setupConnectivityListener();
    _resolveGate();
  }

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  void _setupConnectivityListener() {
    // Check initial connectivity
    _connectivity.checkConnectivity().then((results) {
      _isOnline = results.any((result) => 
        result != ConnectivityResult.none
      );
    });

    // Listen for connectivity changes
    _connectivitySubscription = _connectivity.onConnectivityChanged.listen((results) {
      final wasOffline = !_isOnline;
      _isOnline = results.any((result) => 
        result != ConnectivityResult.none
      );

      // If we just came back online and have pending items, sync them
      if (_isOnline && wasOffline && Session.accessToken != null) {
        _syncOfflineItems();
      }
    });
  }

  Future<void> _syncOfflineItems() async {
    try {
      final api = ApiService();
      await OfflineQueue.syncPending(api);
      // Note: We don't show a notification here because:
      // 1. The dashboard already shows pending count
      // 2. User can manually sync and see feedback there
      // 3. Auto-sync should be silent to avoid interrupting the user
    } catch (_) {
      // Silently fail - will retry on next connectivity change or app start
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive) {
      SecuritySettings.updateLastInactive(DateTime.now());
    }
    if (state == AppLifecycleState.resumed) {
      _evaluateLock();
    }
  }

  Future<void> _resolveGate() async {
    // Root/jailbreak detection removed - package not available
    // You can add it back later with a working package if needed
    // For now, we'll skip this check
    if (Session.accessToken == null) {
      setState(() => _loading = false);
      return;
    }
    try {
      final api = ApiService();
      final policy = await api.fetchTenantPolicy();
      final requireMfaUsers = policy['requireMfaUsers'] == true;
      Session.requireBiometrics = policy['requireBiometrics'] == true;
      Session.sessionTimeoutMinutes = policy['sessionTimeoutMinutes'] is int
          ? policy['sessionTimeoutMinutes'] as int
          : int.tryParse(policy['sessionTimeoutMinutes']?.toString() ?? '');
      await Session.save();
      final requiresBiometrics =
          (Session.requireBiometrics == true) || SecuritySettings.biometricsEnabled;
      setState(() {
        _requiresMfa = requireMfaUsers && Session.mfaEnabled != true;
        if (requiresBiometrics) {
          _locked = true;
        }
      });
      await OfflineQueue.syncPending(api);
      _evaluateLock();
    } catch (_) {
      setState(() {
        _requiresMfa = false;
      });
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  void _evaluateLock() {
    if (Session.accessToken == null) return;
    final requiresBiometrics =
        (Session.requireBiometrics == true) || SecuritySettings.biometricsEnabled;
    if (!requiresBiometrics) return;
    final timeoutMinutes =
        Session.sessionTimeoutMinutes ?? SecuritySettings.lockTimeoutMinutes;
    final lastInactive = SecuritySettings.lastInactiveAt;
    if (lastInactive == null) return;
    final elapsed = DateTime.now().difference(lastInactive).inMinutes;
    if (elapsed >= timeoutMinutes) {
      setState(() => _locked = true);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const SplashScreen();
    }
    if (_securityBlocked) {
      return const SecurityBlockedScreen();
    }
    if (Session.accessToken == null) {
      return const LoginScreen();
    }
    if (_requiresMfa) {
      return const MfaSetupScreen(returnToHome: true);
    }
    if (_locked) {
      return BiometricLockScreen(
        onUnlocked: () {
          SecuritySettings.updateLastInactive(DateTime.now());
          setState(() => _locked = false);
        },
      );
    }
    return HomeScreen(key: ValueKey('${Session.userId ?? Session.email ?? ""}'));
  }
}
