import 'package:flutter/material.dart';
import '../theme.dart';
import '../utils/app_toast.dart';
import 'change_password_screen.dart';
import 'profile_screen.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _isDarkMode = false;

  @override
  void initState() {
    super.initState();
    _loadTheme();
  }

  void _loadTheme() {
    // Check current theme
    final brightness = WidgetsBinding.instance.platformDispatcher.platformBrightness;
    setState(() => _isDarkMode = brightness == Brightness.dark);
  }

  void _toggleTheme() {
    setState(() => _isDarkMode = !_isDarkMode);
    AppToast.info(context, _isDarkMode ? 'Dark mode enabled' : 'Light mode enabled');
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDarkMode ? AppTheme.darkBackground : Colors.grey.shade50,
      appBar: AppBar(
        title: const Text('Settings'),
        centerTitle: true,
        backgroundColor: isDarkMode ? AppTheme.darkBackground : AppTheme.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.maybePop(context),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
        children: [
          // Account Section
          _sectionHeader('Account', isDarkMode),
          _settingTile(
            context,
            icon: Icons.lock_outline,
            title: 'Change Password',
            subtitle: 'Update your account password',
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ChangePasswordScreen()),
              );
            },
            isDarkMode: isDarkMode,
          ),
          _settingTile(
            context,
            icon: Icons.person_outline,
            title: 'Profile Settings',
            subtitle: 'Manage your profile information',
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (_) => const ProfileScreen()),
              );
            },
            isDarkMode: isDarkMode,
          ),
          const SizedBox(height: 24),
          // Appearance Section
          _sectionHeader('Appearance', isDarkMode),
          _settingTile(
            context,
            icon: _isDarkMode ? Icons.dark_mode : Icons.light_mode,
            title: 'Theme',
            subtitle: _isDarkMode ? 'Dark mode' : 'Light mode',
            trailing: Switch(
              value: _isDarkMode,
              onChanged: (_) => _toggleTheme(),
              activeColor: AppTheme.primary,
            ),
            isDarkMode: isDarkMode,
          ),
          const SizedBox(height: 24),
          // Notifications Section
          _sectionHeader('Notifications', isDarkMode),
          _settingTile(
            context,
            icon: Icons.notifications_outlined,
            title: 'Push Notifications',
            subtitle: 'Receive notifications about important updates',
            trailing: Switch(
              value: true, // TODO: Load from settings
              onChanged: (value) {
                // TODO: Save notification preference
              },
              activeColor: AppTheme.primary,
            ),
            isDarkMode: isDarkMode,
          ),
          _settingTile(
            context,
            icon: Icons.build_outlined,
            title: 'Maintenance Reminders',
            subtitle: 'Get notified about upcoming maintenance',
            trailing: Switch(
              value: true, // TODO: Load from settings
              onChanged: (value) {
                // TODO: Save maintenance notification preference
              },
              activeColor: AppTheme.primary,
            ),
            isDarkMode: isDarkMode,
          ),
          _settingTile(
            context,
            icon: Icons.description_outlined,
            title: 'Document Expiry Alerts',
            subtitle: 'Alerts when documents are about to expire',
            trailing: Switch(
              value: true, // TODO: Load from settings
              onChanged: (value) {
                // TODO: Save document alert preference
              },
              activeColor: AppTheme.primary,
            ),
            isDarkMode: isDarkMode,
          ),
          const SizedBox(height: 24),
          // About Section
          _sectionHeader('About', isDarkMode),
          _settingTile(
            context,
            icon: Icons.info_outline,
            title: 'App Version',
            subtitle: '1.0.0', // TODO: Get from package_info_plus
            isDarkMode: isDarkMode,
          ),
          _settingTile(
            context,
            icon: Icons.description_outlined,
            title: 'Terms of Service',
            subtitle: 'Read our terms and conditions',
            onTap: () {
              // Navigate to terms screen
            },
            isDarkMode: isDarkMode,
          ),
          _settingTile(
            context,
            icon: Icons.privacy_tip_outlined,
            title: 'Privacy Policy',
            subtitle: 'Learn how we protect your data',
            onTap: () {
              // Navigate to privacy screen
            },
            isDarkMode: isDarkMode,
          ),
          _settingTile(
            context,
            icon: Icons.help_outline,
            title: 'Help & Support',
            subtitle: 'Get help and contact support',
            onTap: () {
              // Navigate to help screen
            },
            isDarkMode: isDarkMode,
          ),
          const SizedBox(height: 32),
        ],
      ),
    );
  }

  Widget _sectionHeader(String title, bool isDarkMode) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _settingTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    String? subtitle,
    Widget? trailing,
    VoidCallback? onTap,
    required bool isDarkMode,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: isDarkMode ? AppTheme.darkSurface : Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        child: ListTile(
          leading: Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.primary.withOpacity(0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppTheme.primary, size: 22),
          ),
          title: Text(
            title,
            style: TextStyle(
              color: isDarkMode ? Colors.white : Colors.black87,
              fontWeight: FontWeight.w600,
              fontSize: 15,
            ),
          ),
          subtitle: subtitle != null
              ? Padding(
                  padding: const EdgeInsets.only(top: 2),
                  child: Text(
                    subtitle,
                    style: TextStyle(
                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                      fontSize: 13,
                    ),
                  ),
                )
              : null,
          trailing: trailing ?? (onTap != null ? Icon(Icons.chevron_right, color: isDarkMode ? Colors.grey[500] : Colors.grey[600]) : null),
          onTap: onTap,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppTheme.radius),
          ),
          contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        ),
      ),
    );
  }
}

