import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import '../services/session.dart';
import '../services/api_service.dart';
import '../services/offline_queue.dart';
import '../services/security_settings.dart';
import '../theme.dart';
import '../utils/app_toast.dart';
import '../widgets/sidebar.dart';
import '../widgets/app_section.dart';
import '../widgets/confirmation_dialog.dart';
import 'login_screen.dart';
import 'mfa_setup_screen.dart';
import 'driver_profile_screen.dart';
import 'help_screen.dart';
import 'privacy_policy_screen.dart';
import 'terms_of_service_screen.dart';
import 'verify_email_otp_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key, this.onBack, this.openDrawer});

  final VoidCallback? onBack;
  final VoidCallback? openDrawer;

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

/// User-friendly label for role (avoids showing raw TENANT_USER / TENANT_ADMIN).
String _roleDisplayLabel(String? role) {
  if (role == null || role.isEmpty) return 'Driver';
  switch (role.toUpperCase()) {
    case 'TENANT_ADMIN':
      return 'Admin';
    case 'TENANT_USER':
      return 'Driver';
    default:
      return role.length > 2 ? role : 'Driver';
  }
}

class _ProfileScreenState extends State<ProfileScreen> {
  Map<String, dynamic>? _tenantPolicy;
  Map<String, dynamic>? _driverProfile;
  List<int>? _profilePictureBytes;
  bool _policyLoading = false;
  bool _biometricsSupported = false;
  bool _checkingBiometrics = false;
  bool _resendVerificationLoading = false;
  int _lockTimeoutMinutes = SecuritySettings.lockTimeoutMinutes;

  Future<void> _logout(BuildContext context) async {
    final confirmed = await ConfirmationDialog.show(
      context: context,
      title: 'Logout',
      message: 'Are you sure you want to logout? You will need to login again to access the app.',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      isDestructive: true,
    );

    if (confirmed == true) {
      await Session.clearForLogout();
      await SecuritySettings.clear();
      await OfflineQueue.clearQueue();
      if (!context.mounted) return;
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (_) => const LoginScreen()),
        (_) => false,
      );
    }
  }

  @override
  void initState() {
    super.initState();
    _loadPolicy();
    _loadDriverProfile();
    _checkBiometrics();
    ApiService().getProfilePictureBytes().then((b) {
      if (mounted && b != null && b.isNotEmpty) setState(() => _profilePictureBytes = b);
    });
  }

  Future<void> _loadDriverProfile() async {
    if (Session.accessToken == null) return;
    final currentUserId = Session.userId;
    try {
      final api = ApiService();
      final profile = await api.fetchDriverProfile();
      if (!mounted || Session.userId != currentUserId) return;
      setState(() => _driverProfile = profile);
    } catch (_) {
      if (mounted && Session.userId == currentUserId) setState(() => _driverProfile = null);
    }
  }

  String _profileDisplayName() {
    if (_driverProfile != null) {
      final first = _driverProfile!['firstName']?.toString().trim() ?? '';
      final last = _driverProfile!['lastName']?.toString().trim() ?? '';
      final full = '$first $last'.trim();
      if (full.isNotEmpty) return full;
    }
    return Session.email ?? 'Driver';
  }

  Future<void> _resendVerification() async {
    final email = Session.email;
    if (email == null || email.isEmpty) return;
    setState(() => _resendVerificationLoading = true);
    try {
      final api = ApiService();
      await api.resendVerificationEmail(email, tenantId: Session.tenantId);
      if (!mounted) return;
      AppToast.success(context, 'Verification email sent. Check your inbox.');
    } catch (e) {
      if (!mounted) return;
      AppToast.error(context, 'Failed to send verification email', e);
    } finally {
      if (mounted) setState(() => _resendVerificationLoading = false);
    }
  }

  Future<void> _loadPolicy() async {
    if (Session.accessToken == null) return;
    setState(() => _policyLoading = true);
    try {
      final api = ApiService();
      final policy = await api.fetchTenantPolicy();
      if (!mounted) return;
      setState(() => _tenantPolicy = policy);
      final name = policy['tenantName'] as String?;
      if (name != null && name.isNotEmpty) {
        Session.tenantName = name;
        await Session.save();
      }
    } catch (_) {
      if (!mounted) return;
      setState(() => _tenantPolicy = null);
    } finally {
      if (mounted) setState(() => _policyLoading = false);
    }
  }

  Future<void> _checkBiometrics() async {
    setState(() => _checkingBiometrics = true);
    try {
      final auth = LocalAuthentication();
      final canCheck = await auth.canCheckBiometrics;
      if (!mounted) return;
      setState(() => _biometricsSupported = canCheck);
    } catch (_) {
      if (!mounted) return;
      setState(() => _biometricsSupported = false);
    } finally {
      if (mounted) setState(() => _checkingBiometrics = false);
    }
  }

  Future<void> _toggleBiometrics(bool enabled) async {
    if (enabled) {
      // When enabling, prompt user to authenticate with biometrics first
      try {
        final auth = LocalAuthentication();
        
        // Check if biometrics are available
        final canCheck = await auth.canCheckBiometrics;
        if (!canCheck) {
          if (mounted) AppToast.info(context, 'Biometric authentication is not available on this device.');
          return;
        }

        // Check available biometric types
        final availableBiometrics = await auth.getAvailableBiometrics();
        if (availableBiometrics.isEmpty) {
          if (mounted) AppToast.info(context, 'No biometric methods are enrolled. Please set up biometrics in your device settings.');
          return;
        }

        // Prompt user to authenticate
        final didAuthenticate = await auth.authenticate(
          localizedReason: 'Authenticate to enable biometric login',
          options: const AuthenticationOptions(
            stickyAuth: true,
            biometricOnly: true,
          ),
        );

        if (!mounted) return;

        if (!didAuthenticate) {
          if (mounted) AppToast.info(context, 'Biometric authentication cancelled. Biometrics not enabled.');
          return;
        }

        // Authentication successful, enable biometrics
        SecuritySettings.biometricsEnabled = true;
        await SecuritySettings.save();
        if (mounted) {
          setState(() {});
          AppToast.success(context, 'Biometric authentication enabled successfully!');
        }
      } catch (e) {
        if (mounted) AppToast.error(context, 'Failed to enable biometrics', e);
      }
    } else {
      // When disabling, just turn it off (no need to authenticate)
      SecuritySettings.biometricsEnabled = false;
      await SecuritySettings.save();
      if (mounted) {
        setState(() {});
        AppToast.info(context, 'Biometric authentication disabled.');
      }
    }
  }

  Future<void> _updateLockTimeout(int minutes) async {
    _lockTimeoutMinutes = minutes;
    SecuritySettings.lockTimeoutMinutes = minutes;
    await SecuritySettings.save();
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      drawer: AppSidebar(
        onSelect: (index) {
          Navigator.pop(context);
        },
      ),
      appBar: AppBar(
        title: const Text('Profile'),
        centerTitle: true,
        backgroundColor: isDarkMode ? AppTheme.darkBackground : null,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (widget.onBack != null) {
              widget.onBack!();
              return;
            }
            if (Navigator.of(context).canPop()) {
              Navigator.pop(context);
            } else if (widget.openDrawer != null) {
              widget.openDrawer!();
            }
          },
        ),
      ),
      backgroundColor: isDarkMode ? AppTheme.darkBackground : Colors.white,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            final prevPolicy = _tenantPolicy?['requireMfaUsers']?.toString();
            final prevPicLen = _profilePictureBytes?.length ?? 0;
            await _loadPolicy();
            await _loadDriverProfile();
            final newBytes = await ApiService().getProfilePictureBytes();
            if (mounted && newBytes != null && newBytes.isNotEmpty) setState(() => _profilePictureBytes = newBytes);
            if (!mounted) return;
            final newPicLen = _profilePictureBytes?.length ?? 0;
            final policyChanged = prevPolicy != (_tenantPolicy?['requireMfaUsers']?.toString());
            if (policyChanged || prevPicLen != newPicLen) {
              AppToast.success(context, 'Data updated');
            }
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            child: Padding(
              padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Column(
                    children: [
                      CircleAvatar(
                        radius: 60,
                        backgroundColor: AppTheme.primary.withOpacity(0.2),
                        backgroundImage: _profilePictureBytes != null
                            ? MemoryImage(Uint8List.fromList(_profilePictureBytes!))
                            : null,
                        child: _profilePictureBytes == null
                            ? const Icon(Icons.person, size: 60, color: AppTheme.primary)
                            : null,
                      ),
                      const SizedBox(height: 16),
                      Text(
                        _profileDisplayName(),
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: isDarkMode ? Colors.white : Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        _roleDisplayLabel(Session.role),
                        style: TextStyle(
                          fontSize: 16,
                          color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 32),
                _sectionHeader('Personal Information'),
                const SizedBox(height: 16),
                _infoCard(
                  isDarkMode,
                  [
                    _infoItem('Email', Session.email ?? 'Not provided', Icons.email, isDarkMode),
                    _infoItem('Tenant', Session.tenantId ?? 'Not provided', Icons.domain, isDarkMode),
                    if (_driverProfile?['emailVerified'] == true)
                      _infoItem('Email verified', 'Yes', Icons.verified, isDarkMode),
                  ],
                ),
                if (_driverProfile != null && _driverProfile!['emailVerified'] != true) ...[
                  const SizedBox(height: 12),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDarkMode ? AppTheme.darkSurface : Colors.blue.shade50,
                      borderRadius: BorderRadius.circular(AppTheme.radius),
                      border: Border.all(color: Colors.blue.shade200),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(Icons.mark_email_unread_outlined, color: Colors.blue.shade700),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Text(
                                'Your email is not verified. Check your inbox for a verification link or request a new one.',
                                style: TextStyle(
                                  color: isDarkMode ? Colors.blue.shade200 : Colors.blue.shade900,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: _resendVerificationLoading ? null : _resendVerification,
                                icon: _resendVerificationLoading
                                    ? const SizedBox(
                                        width: 18,
                                        height: 18,
                                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                                      )
                                    : const Icon(Icons.email_outlined, size: 20),
                                label: Text(_resendVerificationLoading ? 'Sending…' : 'Resend email'),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: AppTheme.primary,
                                  foregroundColor: Colors.white,
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: OutlinedButton.icon(
                                onPressed: () async {
                                  await Navigator.push(
                                    context,
                                    MaterialPageRoute(
                                      builder: (_) => VerifyEmailOtpScreen(
                                        onVerified: () async {
                                          await _loadDriverProfile();
                                        },
                                      ),
                                    ),
                                  );
                                  if (mounted) await _loadDriverProfile();
                                },
                                icon: const Icon(Icons.pin_outlined, size: 20),
                                label: const Text('Verify with code'),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppTheme.primary,
                                  side: BorderSide(color: AppTheme.primary),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                _sectionHeader('App Information'),
                const SizedBox(height: 16),
                _infoCard(
                  isDarkMode,
                  [
                    _infoItem('Access Token', Session.accessToken != null ? 'Available' : 'Not set', Icons.lock, isDarkMode),
                    _infoItem('Refresh Token', Session.refreshToken != null ? 'Available' : 'Not set', Icons.refresh, isDarkMode),
                    _infoItem('MFA Status', Session.mfaEnabled == true ? 'Enabled' : 'Not enabled', Icons.shield, isDarkMode),
                  ],
                ),
                const SizedBox(height: 24),
                _sectionHeader('Tenant Policy'),
                const SizedBox(height: 16),
                _infoCard(
                  isDarkMode,
                  [
                    _infoItem(
                      'Driver MFA Required',
                      _policyLoading
                          ? 'Loading...'
                          : (_tenantPolicy?['requireMfaUsers'] == true ? 'Required' : 'Optional'),
                      Icons.security,
                      isDarkMode,
                    ),
                    _infoItem(
                      'Admin MFA Required',
                      _policyLoading
                          ? 'Loading...'
                          : (_tenantPolicy?['requireMfa'] == true ? 'Required' : 'Optional'),
                      Icons.admin_panel_settings,
                      isDarkMode,
                    ),
                  ],
                ),
                if (!_policyLoading &&
                    _tenantPolicy?['requireMfaUsers'] == true &&
                    Session.mfaEnabled != true) ...[
                  const SizedBox(height: 16),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: isDarkMode ? AppTheme.darkSurface : Colors.amber.shade50,
                      borderRadius: BorderRadius.circular(AppTheme.radius),
                      border: Border.all(color: Colors.amber.shade300),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.warning_amber, color: Colors.amber.shade700),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            'MFA is required for this tenant. Please enable MFA.',
                            style: TextStyle(
                              color: isDarkMode ? Colors.amber.shade200 : Colors.amber.shade900,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton.icon(
                      onPressed: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const MfaSetupScreen()),
                        );
                      },
                      icon: const Icon(Icons.shield_outlined),
                      label: const Text('Enable MFA Now'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ),
                ],
                const SizedBox(height: 24),
                _sectionHeader('Driver Profile'),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const DriverProfileScreen()),
                      );
                    },
                    icon: const Icon(Icons.person),
                    label: const Text('View Driver Profile & Documents'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
                _sectionHeader('Security'),
                const SizedBox(height: 16),
                _securityCard(isDarkMode),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  height: 48,
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(builder: (_) => const MfaSetupScreen()),
                      );
                    },
                    icon: const Icon(Icons.shield_outlined),
                    label: const Text('Set up MFA'),
                  ),
                ),
                const SizedBox(height: 24),
                _sectionHeader('Help & Information'),
                const SizedBox(height: 16),
                _infoCard(
                  isDarkMode,
                  [
                    ListTile(
                      leading: Icon(Icons.help_outline, color: AppTheme.primary),
                      title: const Text('Help & Support'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const HelpScreen()),
                        );
                      },
                    ),
                    Divider(color: isDarkMode ? Colors.grey[700] : Colors.grey[300]),
                    ListTile(
                      leading: Icon(Icons.shield_outlined, color: AppTheme.primary),
                      title: const Text('Privacy Policy'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const PrivacyPolicyScreen()),
                        );
                      },
                    ),
                    Divider(color: isDarkMode ? Colors.grey[700] : Colors.grey[300]),
                    ListTile(
                      leading: Icon(Icons.description_outlined, color: AppTheme.primary),
                      title: const Text('Terms of Service'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const TermsOfServiceScreen()),
                        );
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: () => _logout(context),
                    icon: const Icon(Icons.logout_rounded, size: 22),
                    label: const Text(
                      'Sign Out',
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 0.5,
                      ),
                    ),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.danger,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppTheme.radius),
                      ),
                      elevation: 2,
                    ),
                  ),
                ),
                const SizedBox(height: 24),
              ],
            ),
          ),
        ),
      ),
      ),
    );
  }

  Widget _sectionHeader(String title) {
    return AppSectionHeader(title, padding: const EdgeInsets.only(left: 4, bottom: 8, top: 0));
  }

  Widget _infoCard(bool isDarkMode, List<Widget> children) {
    return AppTile(
      color: isDarkMode ? AppTheme.darkSurface : Colors.white,
      padding: const EdgeInsets.all(16),
      child: Column(children: children),
    );
  }

  Widget _infoItem(String label, String value, IconData icon, bool isDarkMode) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppTheme.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(AppTheme.radius),
            ),
            child: Icon(icon, color: AppTheme.primary, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 14,
                    color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value.isEmpty ? 'Not provided' : value,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: isDarkMode ? Colors.white : Colors.black87,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _securityCard(bool isDarkMode) {
    final policyRequiresBiometrics = _tenantPolicy?['requireBiometrics'] == true;
    final policyTimeout = _tenantPolicy?['sessionTimeoutMinutes'];
    final sessionTimeoutMinutes = policyTimeout is int
        ? policyTimeout
        : int.tryParse(policyTimeout?.toString() ?? '');
    final deviceAllowlist = _tenantPolicy?['enforceDeviceAllowlist'] == true;
    final ipAllowlist = _tenantPolicy?['enforceIpAllowlist'] == true;
    final biometricsEnabled = policyRequiresBiometrics || SecuritySettings.biometricsEnabled;

    return _infoCard(
      isDarkMode,
      [
        Row(
          children: [
            Expanded(
              child: Text(
                'Biometrics',
                style: TextStyle(
                  fontSize: 14,
                  color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
            ),
            if (_checkingBiometrics)
              const SizedBox(
                width: 16,
                height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            else
              Switch(
                value: biometricsEnabled,
                onChanged: (!_biometricsSupported || policyRequiresBiometrics)
                    ? null
                    : (value) => _toggleBiometrics(value),
              ),
          ],
        ),
        const SizedBox(height: 12),
        _infoItem(
          'Biometrics Required',
          policyRequiresBiometrics ? 'Required' : 'Optional',
          Icons.fingerprint,
          isDarkMode,
        ),
        _infoItem(
          'Device Allowlist',
          deviceAllowlist ? 'Enforced' : 'Optional',
          Icons.devices,
          isDarkMode,
        ),
        _infoItem(
          'IP Allowlist',
          ipAllowlist ? 'Enforced' : 'Optional',
          Icons.lock_outline,
          isDarkMode,
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: Text(
                'Auto-lock timeout',
                style: TextStyle(
                  fontSize: 14,
                  color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
            ),
            DropdownButton<int>(
              value: sessionTimeoutMinutes ?? _lockTimeoutMinutes,
              items: const [
                DropdownMenuItem(value: 1, child: Text('1 min')),
                DropdownMenuItem(value: 5, child: Text('5 min')),
                DropdownMenuItem(value: 15, child: Text('15 min')),
                DropdownMenuItem(value: 30, child: Text('30 min')),
              ],
              onChanged: sessionTimeoutMinutes != null
                  ? null
                  : (value) {
                      if (value == null) return;
                      _updateLockTimeout(value);
                    },
            ),
          ],
        ),
      ],
    );
  }
}
