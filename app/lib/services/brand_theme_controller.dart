import 'package:flutter/material.dart';

/// Post-login tenant brand colors / logo. Reset to VIT on logout.
class BrandThemeController extends ChangeNotifier {
  BrandThemeController._();
  static final BrandThemeController instance = BrandThemeController._();

  Color? primaryColor;
  Color? accentColor;
  String? logoUrl;
  String? displayName;
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
    primaryColor = _parseHex(primaryHex) ?? primaryColor;
    accentColor = _parseHex(accentHex);
    logoUrl = brand['logoUrl']?.toString();
    displayName = brand['displayName']?.toString();
    isCustom = primaryColor != null;
    if (displayName != null && displayName!.isNotEmpty) {
      // Prefer branded display name in session chrome when available.
    }
    notifyListeners();
  }

  void resetToVit() {
    primaryColor = null;
    accentColor = null;
    logoUrl = null;
    displayName = null;
    isCustom = false;
    notifyListeners();
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
