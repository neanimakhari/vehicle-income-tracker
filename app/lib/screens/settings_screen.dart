import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';
import '../services/theme_mode_controller.dart';
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
  String _versionLabel = '…';

  @override
  void initState() {
    super.initState();
    _loadVersion();
  }

  Future<void> _loadVersion() async {
    try {
      final info = await PackageInfo.fromPlatform();
      if (mounted) {
        setState(() => _versionLabel = '${info.version}+${info.buildNumber}');
      }
    } catch (_) {
      if (mounted) setState(() => _versionLabel = '1.0.5');
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return ListenableBuilder(
      listenable: ThemeModeController.instance,
      builder: (context, _) {
        final mode = ThemeModeController.instance.mode;
        return Scaffold(
          backgroundColor:
              isDarkMode ? AppTheme.darkBackground : Colors.grey.shade50,
          appBar: AppBar(
            title: const Text('Settings'),
            centerTitle: true,
            backgroundColor: isDarkMode
                ? AppTheme.darkBackground
                : Theme.of(context).colorScheme.primary,
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
              _sectionHeader('Account', isDarkMode),
              _settingTile(
                context,
                icon: Icons.lock_outline,
                title: 'Change Password',
                subtitle: 'Update your account password',
                onTap: () {
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const ChangePasswordScreen(),
                    ),
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
              _sectionHeader('Appearance', isDarkMode),
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: SegmentedButton<ThemeMode>(
                  segments: const [
                    ButtonSegment(
                      value: ThemeMode.system,
                      label: Text('System'),
                      icon: Icon(Icons.brightness_auto, size: 18),
                    ),
                    ButtonSegment(
                      value: ThemeMode.light,
                      label: Text('Light'),
                      icon: Icon(Icons.light_mode, size: 18),
                    ),
                    ButtonSegment(
                      value: ThemeMode.dark,
                      label: Text('Dark'),
                      icon: Icon(Icons.dark_mode, size: 18),
                    ),
                  ],
                  selected: {mode},
                  onSelectionChanged: (set) async {
                    final next = set.first;
                    await ThemeModeController.instance.setMode(next);
                    if (context.mounted) {
                      AppToast.info(
                        context,
                        'Appearance: ${ThemeModeController.instance.label}',
                      );
                    }
                  },
                ),
              ),
              const SizedBox(height: 24),
              _sectionHeader('About', isDarkMode),
              _settingTile(
                context,
                icon: Icons.info_outline,
                title: 'App Version',
                subtitle: _versionLabel,
                isDarkMode: isDarkMode,
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _sectionHeader(String title, bool isDarkMode) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8, top: 4),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: isDarkMode ? Colors.white70 : Colors.black54,
          letterSpacing: 0.4,
        ),
      ),
    );
  }

  Widget _settingTile(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
    required bool isDarkMode,
    VoidCallback? onTap,
    Widget? trailing,
  }) {
    return Card(
      margin: const EdgeInsets.only(bottom: 8),
      color: isDarkMode ? AppTheme.darkSurface : Colors.white,
      child: ListTile(
        leading: Icon(icon, color: Theme.of(context).colorScheme.primary),
        title: Text(title),
        subtitle: Text(subtitle),
        trailing: trailing ??
            (onTap != null ? const Icon(Icons.chevron_right) : null),
        onTap: onTap,
      ),
    );
  }
}
