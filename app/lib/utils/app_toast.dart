import 'package:flutter/material.dart';
import '../theme.dart';

/// Central success and error feedback for the mobile app.
/// Use [success] / [error] for SnackBars; use [AppDialogs] for modal dialogs when needed.
class AppToast {
  AppToast._();

  /// Strip "Exception: " prefix from error messages for cleaner display.
  static String _cleanMessage(Object message) {
    final s = message.toString().trim();
    const prefix = 'Exception: ';
    if (s.startsWith(prefix)) return s.substring(prefix.length).trim();
    return s;
  }

  /// Show a success message (green SnackBar, floating).
  static void success(BuildContext context, String message) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        backgroundColor: AppTheme.success,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  /// Show an error message (red SnackBar, floating). Pass [error] to auto-clean "Exception: ".
  static void error(BuildContext context, String message, [Object? error]) {
    if (!context.mounted) return;
    final text = error != null ? _cleanMessage(error) : message;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(text),
        backgroundColor: AppTheme.danger,
        behavior: SnackBarBehavior.floating,
      ),
    );
  }

  /// Show an info message (neutral SnackBar, e.g. "Saved offline").
  static void info(BuildContext context, String message) {
    if (!context.mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(message),
        behavior: SnackBarBehavior.floating,
      ),
    );
  }
}

/// Modal success/error dialogs when you need explicit acknowledgment.
class AppDialogs {
  AppDialogs._();

  static String _cleanMessage(Object message) {
    final s = message.toString().trim();
    const prefix = 'Exception: ';
    if (s.startsWith(prefix)) return s.substring(prefix.length).trim();
    return s;
  }

  /// Show a success dialog with an OK button.
  static Future<void> success(
    BuildContext context, {
    required String title,
    required String message,
  }) async {
    if (!context.mounted) return;
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDarkMode ? AppTheme.darkSurface : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radius),
        ),
        title: Row(
          children: [
            Icon(Icons.check_circle, color: AppTheme.success, size: 28),
            const SizedBox(width: 10),
            Expanded(child: Text(title)),
          ],
        ),
        content: Text(
          message,
          style: TextStyle(color: isDarkMode ? Colors.white70 : Colors.black87),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }

  /// Show an error dialog with an OK button.
  static Future<void> error(
    BuildContext context, {
    required String title,
    required String message,
    Object? error,
  }) async {
    if (!context.mounted) return;
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final text = error != null ? _cleanMessage(error) : message;
    await showDialog<void>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDarkMode ? AppTheme.darkSurface : Colors.white,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppTheme.radius),
        ),
        title: Row(
          children: [
            Icon(Icons.error_outline, color: AppTheme.danger, size: 28),
            const SizedBox(width: 10),
            Expanded(child: Text(title)),
          ],
        ),
        content: Text(
          text,
          style: TextStyle(color: isDarkMode ? Colors.white70 : Colors.black87),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('OK'),
          ),
        ],
      ),
    );
  }
}
