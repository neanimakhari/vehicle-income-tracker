import 'package:flutter/material.dart';
import '../theme.dart';

/// Section header matching the reference menu style: bold, clear hierarchy.
class AppSectionHeader extends StatelessWidget {
  const AppSectionHeader(this.title, {super.key, this.padding});

  final String title;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Padding(
      padding: padding ?? const EdgeInsets.only(left: 4, bottom: 12, top: 4),
      child: Text(
        title,
        style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ) ??
            TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: isDark ? Colors.white : Colors.black87,
            ),
      ),
    );
  }
}

/// Rounded tile container matching the reference (card-style, same radius as theme).
class AppTile extends StatelessWidget {
  const AppTile({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.color,
  });

  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    final surface = color ?? (isDark ? AppTheme.darkSurface : Colors.white);
    return Container(
      margin: margin,
      padding: padding ?? const EdgeInsets.symmetric(horizontal: 16, vertical: AppTheme.tilePadding),
      decoration: BoxDecoration(
        color: surface,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.3 : 0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: child,
    );
  }
}
