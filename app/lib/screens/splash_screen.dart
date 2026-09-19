import 'package:flutter/material.dart';
import '../services/brand_theme_controller.dart';
import '../widgets/brand_logo.dart';

/// Full-screen splash shown while the app resolves session and route.
class SplashScreen extends StatelessWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final brand = BrandThemeController.instance;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final bg = isDark
        ? Colors.black
        : (brand.primaryColor?.withOpacity(0.12) ?? Colors.black);
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        color: isDark ? Colors.black : bg,
        child: SafeArea(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(flex: 2),
              BrandLogo(size: 120),
              const SizedBox(height: 24),
              Text(
                brand.displayName?.isNotEmpty == true
                    ? brand.displayName!
                    : 'Vehicle Income Tracker',
                style: TextStyle(
                  color: isDark
                      ? Colors.white.withOpacity(0.95)
                      : (brand.primaryColor ?? Colors.black87),
                  fontSize: 20,
                  fontWeight: FontWeight.w600,
                ),
                textAlign: TextAlign.center,
              ),
              const Spacer(flex: 2),
              SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: brand.primaryColor ?? Colors.teal,
                ),
              ),
              const Spacer(),
            ],
          ),
        ),
      ),
    );
  }
}
