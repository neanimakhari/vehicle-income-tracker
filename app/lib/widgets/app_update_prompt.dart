import 'package:flutter/material.dart';
import '../services/app_update_service.dart';

/// Checks for a newer APK after the shell is mounted; prompts to download/install.
Future<void> maybePromptAppUpdate(BuildContext context) async {
  final latest = await AppUpdateService.checkForUpdate();
  if (latest == null || !context.mounted) return;

  final go = await showDialog<bool>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => AlertDialog(
      title: Text('Update available (${latest.versionName})'),
      content: Text(
        latest.releaseNotes.isEmpty
            ? 'A newer version of VIT is available. Download and install to continue with the latest features.'
            : latest.releaseNotes,
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: const Text('Later'),
        ),
        FilledButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: const Text('Update'),
        ),
      ],
    ),
  );
  if (go != true || !context.mounted) return;

  showDialog<void>(
    context: context,
    barrierDismissible: false,
    builder: (ctx) => const AlertDialog(
      content: Row(
        children: [
          CircularProgressIndicator(),
          SizedBox(width: 16),
          Expanded(child: Text('Downloading update…')),
        ],
      ),
    ),
  );

  try {
    final path = await AppUpdateService.downloadAuthenticatedApk(latest);
    if (context.mounted) Navigator.of(context, rootNavigator: true).pop();
    if (path == null) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Download failed. Try again later.')),
        );
      }
      return;
    }
    await AppUpdateService.installApk(path);
  } catch (_) {
    if (context.mounted) {
      Navigator.of(context, rootNavigator: true).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Update failed. Try again later.')),
      );
    }
  }
}
