import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

enum BrandResolveState { idle, loading, ready, fallback }

/// Tenant brand colors / logo / typography.
/// VIT is only applied as a true fallback after resolve fails or there is no tenant.
class BrandThemeController extends ChangeNotifier {
  BrandThemeController._();
  static final BrandThemeController instance = BrandThemeController._();

  BrandResolveState resolveState = BrandResolveState.idle;

  Color? primaryColor;
  Color? accentColor;
  Color? primaryDarkColor;
  String? logoUrl;
  String? loginBackgroundUrl;
  String? displayName;
  String? fontFamily;
  String? borderRadius;
  String? sidebarStyle;
  bool isCustom = false;

  bool get isResolving => resolveState == BrandResolveState.loading;
  bool get isBrandReady =>
      resolveState == BrandResolveState.ready ||
      resolveState == BrandResolveState.fallback;

  void beginResolve() {
    if (resolveState == BrandResolveState.loading) return;
    resolveState = BrandResolveState.loading;
    notifyListeners();
  }

  /// Always ends in [ready] or [fallback] — never leave UI stuck on loading.
  Future<void> resolveRememberedTenant(
    Future<Map<String, dynamic>> Function(String slug) fetchPolicy,
    String? slug, {
    Duration timeout = const Duration(seconds: 8),
  }) async {
    if (slug == null || slug.isEmpty) {
      resetToVit(asFallback: true);
      return;
    }
    beginResolve();
    try {
      final policy = await fetchPolicy(slug).timeout(timeout);
      applyFromPolicy(policy);
    } catch (_) {
      // Keep any previously applied chrome if we have it; otherwise VIT.
      if (isCustom && primaryColor != null) {
        resolveState = BrandResolveState.ready;
        notifyListeners();
      } else {
        resetToVit(asFallback: true);
      }
    }
  }

  void applyFromPolicy(Map<String, dynamic> policy) {
    final brand = policy['brand'];
    // Incomplete policy (e.g. no tenant context) must not wipe a good brand.
    if (brand is! Map) {
      if (isCustom && primaryColor != null) {
        resolveState = BrandResolveState.ready;
        notifyListeners();
      } else {
        resetToVit(asFallback: true);
      }
      return;
    }
    final mode = brand['mode']?.toString();
    if (mode != 'custom') {
      resetToVit(asFallback: true);
      return;
    }
    final primaryHex = brand['primaryColor']?.toString();
    final accentHex = brand['accentColor']?.toString();
    final darkHex = brand['primaryDarkColor']?.toString();
    primaryColor = _parseHex(primaryHex) ?? primaryColor;
    accentColor = _parseHex(accentHex) ?? accentColor;
    primaryDarkColor = _parseHex(darkHex) ?? primaryDarkColor;
    final nextLogo = brand['logoUrl']?.toString();
    if (nextLogo != null && nextLogo.isNotEmpty) logoUrl = nextLogo;
    final nextBg = brand['loginBackgroundUrl']?.toString();
    if (nextBg != null && nextBg.isNotEmpty) loginBackgroundUrl = nextBg;
    final nextName = brand['displayName']?.toString();
    if (nextName != null && nextName.isNotEmpty) displayName = nextName;
    fontFamily = brand['fontFamily']?.toString() ?? fontFamily;
    borderRadius = brand['borderRadius']?.toString() ?? borderRadius;
    sidebarStyle = brand['sidebarStyle']?.toString() ?? sidebarStyle;
    isCustom = primaryColor != null;
    resolveState = BrandResolveState.ready;
    notifyListeners();
  }

  /// Fetch authenticated policy and apply brand; keep current chrome on failure.
  Future<void> hydrateFromAuthenticatedPolicy(
    Future<Map<String, dynamic>> Function() fetchPolicy,
  ) async {
    try {
      final policy = await fetchPolicy().timeout(const Duration(seconds: 15));
      applyFromPolicy(policy);
    } catch (_) {
      if (isCustom && primaryColor != null) {
        resolveState = BrandResolveState.ready;
        notifyListeners();
      } else {
        resetToVit(asFallback: true);
      }
    }
  }

  /// Apply public brand-chrome (pre-login) for a remembered tenant.
  void applyFromChrome(Map<String, dynamic> chrome) {
    applyFromPolicy({'brand': chrome});
  }

  /// [asFallback] marks VIT as resolved fallback (safe to paint UI).
  /// Without it, only clears chrome — prefer [beginResolve] + fetch instead of flashing VIT.
  void resetToVit({bool asFallback = false}) {
    primaryColor = null;
    accentColor = null;
    primaryDarkColor = null;
    logoUrl = null;
    loginBackgroundUrl = null;
    displayName = null;
    fontFamily = null;
    borderRadius = null;
    sidebarStyle = null;
    isCustom = false;
    resolveState =
        asFallback ? BrandResolveState.fallback : BrandResolveState.idle;
    notifyListeners();
  }

  double get radiusValue {
    switch (borderRadius) {
      case 'sm':
        return 8;
      case 'lg':
        return 20;
      case 'md':
      default:
        return 12;
    }
  }

  TextTheme? textThemeFor(TextTheme base) {
    switch (fontFamily) {
      case 'nunito':
        return GoogleFonts.nunitoTextTheme(base);
      case 'roboto':
        return GoogleFonts.robotoTextTheme(base);
      case 'source_sans_3':
        return GoogleFonts.sourceSans3TextTheme(base);
      case 'system':
        return base;
      case 'inter':
      default:
        return GoogleFonts.interTextTheme(base);
    }
  }

  static Color? _parseHex(String? hex) {
    if (hex == null || hex.isEmpty) return null;
    var h = hex.trim();
    if (h.startsWith('#')) h = h.substring(1);
    if (h.length != 6) return null;
    final value = int.tryParse(h, radix: 16);
    if (value == null) return null;
    return Color(0xFF000000 | value);
  }
}
