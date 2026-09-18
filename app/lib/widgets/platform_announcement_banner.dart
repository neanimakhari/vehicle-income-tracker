import 'package:flutter/material.dart';
import '../theme.dart';

/// Matches tenant-admin PlatformAnnouncementBanner: teal info / amber maintenance.
class PlatformAnnouncementBanner extends StatelessWidget {
  const PlatformAnnouncementBanner({
    super.key,
    required this.announcement,
    this.onDismiss,
  });

  final Map<String, dynamic> announcement;
  final VoidCallback? onDismiss;

  @override
  Widget build(BuildContext context) {
    final maintenance = announcement['severity']?.toString() == 'maintenance';
    final message = announcement['message']?.toString().trim() ?? '';
    if (message.isEmpty) return const SizedBox.shrink();
    final blockWrites = announcement['blockWrites'] == true;
    final bg = maintenance ? const Color(0xFFD97706) : AppTheme.primaryDark;

    return Material(
      color: bg,
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 8, 4, 8),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(
                maintenance ? Icons.build_circle_outlined : Icons.info_outline,
                color: Colors.white,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      message,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        height: 1.35,
                      ),
                    ),
                    if (maintenance && blockWrites) ...[
                      const SizedBox(height: 4),
                      Text(
                        'Writes may be limited during maintenance',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.9),
                          fontSize: 11,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (onDismiss != null)
                IconButton(
                  onPressed: onDismiss,
                  icon: const Icon(Icons.close, color: Colors.white, size: 18),
                  padding: EdgeInsets.zero,
                  constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                  tooltip: 'Dismiss',
                ),
            ],
          ),
        ),
      ),
    );
  }
}
