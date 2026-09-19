import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../services/security_settings.dart';
import '../theme.dart';
import '../utils/app_toast.dart';
import 'home_screen.dart';
import 'mfa_setup_screen.dart';
import 'change_password_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _mfaController = TextEditingController();
  final _api = ApiService();
  bool _isLoading = false;
  bool _showPassword = false;
  bool _biometricAvailable = false;
  /// Set after needTenantChoice; used only for that rare multi-org email.
  String? _chosenTenantSlug;
  List<Map<String, dynamic>> _tenantChoices = [];
  final LocalAuthentication _auth = LocalAuthentication();

  @override
  void initState() {
    super.initState();
    _chosenTenantSlug = Session.tenantId;
    _checkBiometricLogin();
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _mfaController.dispose();
    super.dispose();
  }

  Future<void> _checkBiometricLogin() async {
    try {
      final hasRefresh = Session.refreshToken != null && Session.refreshToken!.isNotEmpty;
      if (!SecuritySettings.biometricsEnabled || !hasRefresh) {
        return;
      }
      final canCheck = await _auth.canCheckBiometrics;
      if (!mounted) return;
      if (canCheck) {
        setState(() => _biometricAvailable = true);
      }
    } catch (_) {
      // If anything fails, just hide the biometric option
    }
  }

  Future<void> _login({String? forceTenantSlug}) async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _isLoading = true);
    try {
      // Prefer explicit choice, then remembered tenant as a hint; cold start = email-first.
      final tenantHint = forceTenantSlug ??
          _chosenTenantSlug ??
          (Session.tenantId?.isNotEmpty == true ? Session.tenantId : null);

      final result = await _api.login(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        mfaToken: _mfaController.text.trim().isEmpty ? null : _mfaController.text.trim(),
        tenantId: tenantHint,
      );

      if (result['needTenantChoice'] == true) {
        final raw = result['tenants'];
        final list = (raw is List)
            ? raw.whereType<Map>().map((e) => Map<String, dynamic>.from(e)).toList()
            : <Map<String, dynamic>>[];
        if (!mounted) return;
        setState(() {
          _tenantChoices = list;
          _isLoading = false;
        });
        final picked = await _pickTenant(list);
        if (picked == null || !mounted) return;
        setState(() => _chosenTenantSlug = picked);
        await _login(forceTenantSlug: picked);
        return;
      }

      // Full clear so no stale data from previous user can reappear (memory or storage)
      await Session.clear();
      Session.accessToken = result['accessToken'] as String?;
      Session.refreshToken = result['refreshToken'] as String?;
      Session.email = result['user']?['email'] as String?;
      Session.role = result['user']?['role'] as String?;
      Session.userId = result['user']?['id'] as String?;
      Session.mfaEnabled = result['user']?['mfaEnabled'] as bool?;
      Session.tenantId = result['user']?['tenantId'] as String? ?? tenantHint;
      Session.tenantName = result['tenantName'] as String? ?? result['user']?['tenantName'] as String?;
      Session.rememberMe = true;
      Session.mustChangePassword = result['user']?['mustChangePassword'] as bool? ?? false;
      await Session.save();
      if (!mounted) return;
      if (Session.mustChangePassword == true) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => const ChangePasswordScreen(forcedFirstLogin: true),
          ),
        );
      } else {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(
            builder: (_) => HomeScreen(key: ValueKey('${Session.userId ?? Session.email ?? ""}')),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      // If remembered tenant fails, retry once as pure email-first.
      final triedHint = forceTenantSlug ?? _chosenTenantSlug ?? Session.tenantId;
      if (triedHint != null &&
          triedHint.isNotEmpty &&
          forceTenantSlug == null) {
        _chosenTenantSlug = null;
        Session.tenantId = null;
        if (mounted) setState(() => _isLoading = false);
        await _login(forceTenantSlug: '');
        return;
      }
      final message = e.toString();
      if (message.contains('MFA setup required')) {
        if (!mounted) return;
        await showDialog(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text('MFA Setup Required'),
            content: const Text('You must set up MFA before you can sign in.'),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('Cancel'),
              ),
              ElevatedButton(
                onPressed: () {
                  Navigator.pop(context);
                  Navigator.push(
                    context,
                    MaterialPageRoute(
                      builder: (_) => MfaSetupScreen(
                        prefillEmail: _emailController.text.trim(),
                        prefillPassword: _passwordController.text,
                        prefillTenant: Session.tenantId,
                        forceUnauth: true,
                      ),
                    ),
                  );
                },
                child: const Text('Set up MFA'),
              ),
            ],
          ),
        );
        return;
      }
      final errorText = message.contains('MFA required')
          ? 'MFA code required. Enter your authenticator code.'
          : null;
      if (errorText != null) {
        AppToast.error(context, errorText);
      } else {
        String? friendly;
        if (message.contains('Invalid credentials') || message.contains('incorrect password')) {
          friendly = 'Incorrect email or password.';
        } else if (message.contains('Invalid MFA token')) {
          friendly = 'Invalid MFA code. Please try again.';
        } else if (message.contains('Account locked')) {
          friendly = 'Account locked. Please try again later.';
        }
        if (friendly != null) {
          AppToast.error(context, friendly);
        } else {
          AppToast.error(context, 'Login failed', e);
        }
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<String?> _pickTenant(List<Map<String, dynamic>> tenants) async {
    if (tenants.isEmpty) return null;
    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Choose company'),
        content: SizedBox(
          width: double.maxFinite,
          child: ListView.builder(
            shrinkWrap: true,
            itemCount: tenants.length,
            itemBuilder: (_, i) {
              final t = tenants[i];
              final slug = t['slug']?.toString() ?? '';
              final name = (t['name']?.toString().trim().isNotEmpty == true)
                  ? t['name'].toString()
                  : slug;
              return ListTile(
                title: Text(name),
                onTap: () => Navigator.pop(ctx, slug),
              );
            },
          ),
        ),
      ),
    );
  }

  Future<void> _loginWithBiometrics() async {
    if (_isLoading || !_biometricAvailable) return;
    setState(() => _isLoading = true);
    try {
      final didAuthenticate = await _auth.authenticate(
        localizedReason: 'Sign in with biometrics',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
      if (!didAuthenticate) {
        if (mounted) {
          AppToast.info(context, 'Biometric authentication cancelled.');
        }
        return;
      }
      final api = ApiService();
      final data = await api.refreshSession();
      Session.accessToken = data['accessToken'] as String?;
      Session.refreshToken = data['refreshToken'] as String?;
      await Session.save();
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => HomeScreen(key: ValueKey('${Session.userId ?? Session.email ?? ""}')),
        ),
      );
    } catch (e) {
      if (mounted) {
        AppToast.error(context, 'Biometric sign-in failed', e);
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      body: Stack(
        fit: StackFit.expand,
        children: [
          // Background image with gradient overlay
          Image.asset(
            'assets/images/bg.jpg',
            fit: BoxFit.cover,
            errorBuilder: (_, __, ___) => Container(
              color: isDarkMode ? AppTheme.darkBackground : const Color(0xFF0d9488),
            ),
          ),
          Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  Colors.black.withOpacity(0.4),
                  const Color(0xFF0d9488).withOpacity(0.7),
                  Colors.black.withOpacity(0.85),
                ],
              ),
            ),
          ),
          SafeArea(
            top: true,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.max,
                children: [
                  Padding(
                    padding: const EdgeInsets.only(top: 24, left: 20, right: 20, bottom: 24),
                    child: Container(
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: (isDarkMode ? AppTheme.darkSurface : Colors.white).withOpacity(0.5),
                        borderRadius: BorderRadius.circular(20),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.2),
                            blurRadius: 20,
                            offset: const Offset(0, 10),
                          ),
                        ],
                      ),
                      child: Padding(
                        padding: const EdgeInsets.all(24),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Center(
                              child: Image.asset(
                              'assets/images/vit_logo1.png',
                              width: 220,
                              height: 200,
                              fit: BoxFit.contain,
                              errorBuilder: (_, __, ___) => Icon(
                                Icons.directions_car,
                                size: 80,
                                color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                              ),
                            ),
                          ),
                          const SizedBox(height: 24),
                          Text(
                            'Welcome Back',
                            style: TextStyle(
                              color: isDarkMode ? Colors.white : Colors.black87,
                              fontSize: 32,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const SizedBox(height: 12),
                          Text(
                            'Fill in your details to access your account',
                            style: TextStyle(
                              color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                              fontSize: 16,
                            ),
                          ),
                          const SizedBox(height: 32),
                          Form(
                            key: _formKey,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (_tenantChoices.isNotEmpty) ...[
                                  Text(
                                    'Select your company to continue',
                                    style: TextStyle(
                                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                      fontSize: 13,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  ..._tenantChoices.map((t) {
                                    final slug = t['slug']?.toString() ?? '';
                                    final name = (t['name']?.toString().trim().isNotEmpty == true)
                                        ? t['name'].toString()
                                        : slug;
                                    return ListTile(
                                      contentPadding: EdgeInsets.zero,
                                      title: Text(name, style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87)),
                                      trailing: _chosenTenantSlug == slug
                                          ? const Icon(Icons.check, color: Theme.of(context).colorScheme.primary)
                                          : null,
                                      onTap: () => setState(() => _chosenTenantSlug = slug),
                                    );
                                  }),
                                  const SizedBox(height: 12),
                                ],
                                AutofillGroup(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      TextFormField(
                                        controller: _emailController,
                                        cursorColor: Theme.of(context).colorScheme.primary,
                                        autofillHints: const [AutofillHints.username, AutofillHints.email],
                                        decoration: InputDecoration(
                                          filled: true,
                                          fillColor: (isDarkMode ? Colors.black : Colors.white).withOpacity(0.35),
                                          labelText: 'Email',
                                          labelStyle: TextStyle(
                                            color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                          ),
                                          floatingLabelStyle: const TextStyle(color: Theme.of(context).colorScheme.primary),
                                          hintText: 'Enter your email',
                                          hintStyle: TextStyle(
                                            color: isDarkMode ? Colors.grey[600] : Colors.grey[400],
                                          ),
                                          prefixIcon: Icon(
                                            Icons.email_outlined,
                                            color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                          ),
                                        ),
                                        style: TextStyle(
                                          color: isDarkMode ? Colors.white : Colors.black87,
                                        ),
                                        keyboardType: TextInputType.emailAddress,
                                        validator: (value) {
                                          if (value == null || value.isEmpty) {
                                            return 'Please enter your email';
                                          }
                                          return null;
                                        },
                                      ),
                                      const SizedBox(height: 20),
                                      TextFormField(
                                        controller: _passwordController,
                                        cursorColor: Theme.of(context).colorScheme.primary,
                                        obscureText: !_showPassword,
                                        autofillHints: const [AutofillHints.password],
                                        decoration: InputDecoration(
                                          filled: true,
                                          fillColor: (isDarkMode ? Colors.black : Colors.white).withOpacity(0.35),
                                          labelText: 'Password',
                                          labelStyle: TextStyle(
                                            color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                          ),
                                          floatingLabelStyle: const TextStyle(color: Theme.of(context).colorScheme.primary),
                                          hintText: 'Enter your password...',
                                          hintStyle: TextStyle(
                                            color: isDarkMode ? Colors.grey[600] : Colors.grey[400],
                                          ),
                                          prefixIcon: Icon(
                                            Icons.lock_outline,
                                            color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                          ),
                                          suffixIcon: IconButton(
                                            icon: Icon(
                                              _showPassword ? Icons.visibility_off : Icons.visibility,
                                              color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                            ),
                                            onPressed: () => setState(() => _showPassword = !_showPassword),
                                          ),
                                        ),
                                        style: TextStyle(
                                          color: isDarkMode ? Colors.white : Colors.black87,
                                        ),
                                        validator: (value) {
                                          if (value == null || value.isEmpty) {
                                            return 'Please enter your password';
                                          }
                                          return null;
                                        },
                                      ),
                                      const SizedBox(height: 16),
                                      TextFormField(
                                        controller: _mfaController,
                                        cursorColor: Theme.of(context).colorScheme.primary,
                                        decoration: InputDecoration(
                                          filled: true,
                                          fillColor: (isDarkMode ? Colors.black : Colors.white).withOpacity(0.35),
                                          labelText: 'MFA Code (if enabled)',
                                          labelStyle: TextStyle(
                                            color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                          ),
                                          floatingLabelStyle: const TextStyle(color: Theme.of(context).colorScheme.primary),
                                          hintText: '123456',
                                          hintStyle: TextStyle(
                                            color: isDarkMode ? Colors.grey[600] : Colors.grey[400],
                                          ),
                                          prefixIcon: Icon(
                                            Icons.shield_outlined,
                                            color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                          ),
                                        ),
                                        style: TextStyle(
                                          color: isDarkMode ? Colors.white : Colors.black87,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 28),
                                SizedBox(
                                  height: 56,
                                  child: ElevatedButton(
                                    onPressed: _isLoading ? null : _login,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: Theme.of(context).colorScheme.primary,
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      elevation: 2,
                                      padding: const EdgeInsets.symmetric(vertical: 12),
                                    ),
                                    child: _isLoading
                                        ? const SizedBox(
                                            height: 24,
                                            width: 24,
                                            child: CircularProgressIndicator(
                                              color: Colors.white,
                                              strokeWidth: 2,
                                            ),
                                          )
                                        : const Text(
                                            'Sign in',
                                            style: TextStyle(
                                              fontSize: 17,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                  ),
                                ),
                                if (_biometricAvailable) ...[
                                  const SizedBox(height: 12),
                                  TextButton.icon(
                                    onPressed: _isLoading ? null : _loginWithBiometrics,
                                    icon: const Icon(Icons.fingerprint),
                                    label: const Text('Sign in with biometrics'),
                                    style: TextButton.styleFrom(
                                      foregroundColor: Theme.of(context).colorScheme.primary,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    ),
    );
  }
}

