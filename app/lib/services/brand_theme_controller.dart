import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// Post-login tenant brand colors / logo / typography. Reset to VIT on logout.
class BrandThemeController extends ChangeNotifier {
  BrandThemeController._();
  static final BrandThemeController instance = BrandThemeController._();

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

  void applyFromPolicy(Map<String, dynamic> policy) {
    final brand = policy['brand'];
    if (brand is! Map) {
      resetToVit();
      return;
    }
    final mode = brand['mode']?.toString();
    if (mode != 'custom') {
      resetToVit();
      return;
    }
    final primaryHex = brand['primaryColor']?.toString();
    final accentHex = brand['accentColor']?.toString();
    final darkHex = brand['primaryDarkColor']?.toString();
    primaryColor = _parseHex(primaryHex) ?? primaryColor;
    accentColor = _parseHex(accentHex);
    primaryDarkColor = _parseHex(darkHex);
    logoUrl = brand['logoUrl']?.toString();
    loginBackgroundUrl = brand['loginBackgroundUrl']?.toString();
    displayName = brand['displayName']?.toString();
    fontFamily = brand['fontFamily']?.toString();
    borderRadius = brand['borderRadius']?.toString();
    sidebarStyle = brand['sidebarStyle']?.toString();
    isCustom = primaryColor != null;
    notifyListeners();
  }

  /// Apply public brand-chrome (pre-login) for a remembered tenant.
  void applyFromChrome(Map<String, dynamic> chrome) {
    applyFromPolicy({'brand': chrome});
  }

  void resetToVit() {
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
