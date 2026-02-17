import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../config.dart';
import '../services/session.dart';
import '../services/api_service.dart';
import '../services/security_settings.dart';
import '../services/offline_queue.dart';
import '../theme.dart';
import '../widgets/confirmation_dialog.dart';
import '../screens/login_screen.dart';
import '../screens/vehicle_insights_screen.dart';
import '../screens/maintenance_screen.dart';
import '../screens/audit_screen.dart';
import '../screens/alerts_screen.dart';
import '../screens/change_password_screen.dart';

/// Performs logout: confirmation, clear session/security/offline queue, then navigate to login.
Future<void> _performLogout(BuildContext context) async {
  final navigator = Navigator.of(context, rootNavigator: true);
  final confirmed = await ConfirmationDialog.show(
    context: context,
    title: 'Logout',
    message: 'Are you sure you want to logout? You will need to login again to access the app.',
    confirmText: 'Logout',
    cancelText: 'Cancel',
    isDestructive: true,
  );
  if (confirmed != true) return;
  await Session.clearForLogout();
  await SecuritySettings.clear();
  await OfflineQueue.clearQueue();
  navigator.pushAndRemoveUntil(
    MaterialPageRoute(builder: (_) => const LoginScreen()),
    (_) => false,
  );
}

/// Format tenant slug for display when name is not available.
String _formatTenantDisplay(String? tenantId) {
  if (tenantId == null || tenantId.isEmpty) return 'Tenant';
  final parts = tenantId.split('-');
  return parts.map((s) => s.isEmpty ? '' : '${s[0].toUpperCase()}${s.length > 1 ? s.substring(1).toLowerCase() : ''}').join(' ');
}

/// Pitch black sidebar: true black background, near-black tiles.
class _MenuColors {
  static const Color background = Color(0xFF000000);
  static const Color tileBackground = Color(0xFF0A0A0A);
  static const Color text = Colors.white;
  static const Color textSecondary = Color(0xFFB0B0B0);
  static const Color alertDot = Color(0xFFFF9800);
}

class AppSidebar extends StatelessWidget {
  const AppSidebar({super.key, required this.onSelect, this.driverDisplayName, this.emailVerified, this.showExpiryBadge = false});

  final void Function(int index) onSelect;
  /// Display name for the logged-in user (from driver profile or Session.email).
  final String? driverDisplayName;
  /// True when email is verified. When false, show the verify-email alert.
  final bool? emailVerified;
  /// True when driver has expiring docs and should see a notification badge until they submit and get approval.
  final bool showExpiryBadge;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return Drawer(
      backgroundColor: _MenuColors.background,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Main Menu title
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 16),
              child: Text(
                'Main Menu',
                style: textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.bold,
                  color: _MenuColors.text,
                ) ?? const TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.bold,
                  color: _MenuColors.text,
                ),
              ),
            ),
            // Alert / CTA card (verify email) – only when email is not verified
            if (emailVerified == false) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: _AlertCard(
                  icon: Icons.mail_outline,
                  showDot: true,
                  label: 'Verify email for safe transactions',
                  onTap: () {
                    Navigator.pop(context);
                    onSelect(3); // Profile
                  },
                ),
              ),
              const SizedBox(height: 20),
            ],
            // Primary nav: 2x2 grid
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: GridView.count(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisCount: 2,
                mainAxisSpacing: 12,
                crossAxisSpacing: 12,
                childAspectRatio: 1.1,
                children: [
                  _GridTile(
                    icon: Icons.home_outlined,
                    label: 'Home',
                    onTap: () => _closeAndSelect(context, onSelect, 0),
                  ),
                  _GridTile(
                    icon: Icons.analytics_outlined,
                    label: 'Statistics',
                    onTap: () {
                      Navigator.pop(context);
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const VehicleInsightsScreen()));
                    },
                  ),
                  _GridTile(
                    icon: Icons.attach_money,
                    label: 'Log Income',
                    onTap: () => _closeAndSelect(context, onSelect, 1),
                  ),
                  _GridTile(
                    icon: Icons.history,
                    label: 'History',
                    onTap: () => _closeAndSelect(context, onSelect, 2),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            // Alerts & Maintenance section
            _SectionHeader(label: 'Alerts & Maintenance'),
            const SizedBox(height: 8),
            _ListTile(
              icon: Icons.notifications_active_outlined,
              label: 'Alerts',
              showBadge: showExpiryBadge,
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const AlertsScreen()));
              },
            ),
            _ListTile(
              icon: Icons.build_circle_outlined,
              label: 'Maintenance',
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const MaintenanceScreen()));
              },
            ),
            const SizedBox(height: 16),
            // Account and Security section
            _SectionHeader(label: 'Account and Security'),
            const SizedBox(height: 8),
            _ListTile(
              icon: Icons.person_outline,
              label: 'Update Account Data',
              onTap: () => _closeAndSelect(context, onSelect, 3),
            ),
            _ListTile(
              icon: Icons.lock_outline,
              label: 'Password',
              onTap: () {
                Navigator.pop(context);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const ChangePasswordScreen()));
              },
            ),
            _LogoutTile(
              icon: Icons.logout_rounded,
              label: 'Sign Out',
              onTap: () async {
                await _performLogout(context);
                if (context.mounted) Navigator.pop(context);
              },
            ),
            if (Session.role == 'TENANT_ADMIN') ...[
              const SizedBox(height: 16),
              _SectionHeader(label: 'Admin'),
              const SizedBox(height: 8),
              _ListTile(
                icon: Icons.receipt_long_outlined,
                label: 'Audit Trail',
                onTap: () {
                  Navigator.pop(context);
                  Navigator.push(context, MaterialPageRoute(builder: (_) => const AuditScreen()));
                },
              ),
            ],
            const Spacer(),
            // User footer
            Container(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
              decoration: BoxDecoration(
                border: Border(top: BorderSide(color: _MenuColors.tileBackground)),
              ),
              child: Row(
                children: [
                  _ProfileAvatar(radius: 22),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          driverDisplayName ?? Session.email ?? 'Driver',
                          style: textTheme.bodyMedium?.copyWith(
                            fontWeight: FontWeight.w600,
                            color: _MenuColors.text,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        Text(
                          Session.tenantName ?? _formatTenantDisplay(Session.tenantId),
                          style: textTheme.bodySmall?.copyWith(color: _MenuColors.textSecondary),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            // App version
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Text(
                'v${AppConfig.appVersion}',
                style: textTheme.bodySmall?.copyWith(
                  color: _MenuColors.textSecondary,
                  fontSize: 12,
                  fontFamily: 'monospace',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  static void _closeAndSelect(BuildContext context, void Function(int) onSelect, int index) {
    Navigator.pop(context);
    onSelect(index);
  }
}

class _AlertCard extends StatelessWidget {
  const _AlertCard({
    required this.icon,
    required this.label,
    required this.onTap,
    this.showDot = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool showDot;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          decoration: BoxDecoration(
            color: _MenuColors.tileBackground,
            borderRadius: BorderRadius.circular(AppTheme.radius),
          ),
          child: Row(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                    child: Icon(icon, color: _MenuColors.text, size: 22),
                  ),
                  if (showDot)
                    Positioned(
                      top: -2,
                      right: -2,
                      child: Container(
                        width: 10,
                        height: 10,
                        decoration: const BoxDecoration(
                          color: _MenuColors.alertDot,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  label,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: _MenuColors.text,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
              Icon(Icons.chevron_right, color: _MenuColors.textSecondary, size: 22),
            ],
          ),
        ),
      ),
    );
  }
}

class _GridTile extends StatelessWidget {
  const _GridTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        child: Container(
          decoration: BoxDecoration(
            color: _MenuColors.tileBackground,
            borderRadius: BorderRadius.circular(AppTheme.radius),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: _MenuColors.text, size: 28),
              const SizedBox(height: 8),
              Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: _MenuColors.text,
                  fontWeight: FontWeight.w500,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(left: 20),
      child: Text(
        label,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
          fontWeight: FontWeight.bold,
          color: _MenuColors.text,
        ),
      ),
    );
  }
}

/// Sidebar avatar: loads driver profile picture when available.
class _ProfileAvatar extends StatefulWidget {
  const _ProfileAvatar({required this.radius});

  final double radius;

  @override
  State<_ProfileAvatar> createState() => _ProfileAvatarState();
}

class _ProfileAvatarState extends State<_ProfileAvatar> {
  List<int>? _bytes;

  @override
  void initState() {
    super.initState();
    ApiService().getProfilePictureBytes().then((b) {
      if (mounted && b != null && b.isNotEmpty) setState(() => _bytes = b);
    });
  }

  @override
  Widget build(BuildContext context) {
    return CircleAvatar(
      radius: widget.radius,
      backgroundColor: AppTheme.primary.withOpacity(0.2),
      backgroundImage: _bytes != null ? MemoryImage(Uint8List.fromList(_bytes!)) : null,
      child: _bytes == null ? Icon(Icons.person, color: AppTheme.primary, size: widget.radius * 1.2) : null,
    );
  }
}

class _ListTile extends StatelessWidget {
  const _ListTile({
    required this.icon,
    required this.label,
    required this.onTap,
    this.showBadge = false,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;
  final bool showBadge;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          child: Row(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(icon, size: 22, color: _MenuColors.textSecondary),
                  if (showBadge)
                    Positioned(
                      top: -2,
                      right: -2,
                      child: Container(
                        width: 8,
                        height: 8,
                        decoration: const BoxDecoration(
                          color: _MenuColors.alertDot,
                          shape: BoxShape.circle,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 14),
              Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: _MenuColors.text,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Prominent logout tile with danger styling so it's clearly identifiable.
class _LogoutTile extends StatelessWidget {
  const _LogoutTile({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          decoration: BoxDecoration(
            color: AppTheme.danger.withOpacity(0.15),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: AppTheme.danger.withOpacity(0.4), width: 1),
          ),
          child: Row(
            children: [
              Icon(icon, size: 24, color: AppTheme.danger),
              const SizedBox(width: 14),
              Text(
                label,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: AppTheme.danger,
                  fontWeight: FontWeight.w600,
                  fontSize: 15,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
