import 'package:flutter/material.dart';

import '../services/brand_theme_controller.dart';

/// Shows tenant brand logo when available; otherwise the default VIT mark.
class BrandLogo extends StatelessWidget {
  const BrandLogo({
    super.key,
    this.size = 40,
    this.borderRadius = 10,
    this.fallbackAsset = 'assets/images/vit_logo1.png',
  });

  final double size;
  final double borderRadius;
  final String fallbackAsset;

  @override
  Widget build(BuildContext context) {
    final url = BrandThemeController.instance.logoUrl;
    final child = url != null && url.isNotEmpty
        ? Image.network(
            url,
            width: size,
            height: size,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => Image.asset(
              fallbackAsset,
              width: size,
              height: size,
              fit: BoxFit.contain,
            ),
          )
        : Image.asset(
            fallbackAsset,
            width: size,
            height: size,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => Icon(
              Icons.directions_car,
              size: size * 0.7,
              color: Theme.of(context).colorScheme.primary,
            ),
          );

    return ClipRRect(
      borderRadius: BorderRadius.circular(borderRadius),
      child: SizedBox(width: size, height: size, child: child),
    );
  }
}
