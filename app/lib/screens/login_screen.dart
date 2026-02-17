import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../theme.dart';
import '../utils/app_toast.dart';
import 'home_screen.dart';
import 'mfa_setup_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _tenantController = TextEditingController();
  final _mfaController = TextEditingController();
  final _api = ApiService();
  bool _isLoading = false;
  bool _policyLoading = false;
  bool _showPassword = false;
  Map<String, dynamic>? _tenantPolicy;

  @override
  void initState() {
    super.initState();
    if (Session.tenantId != null) {
      _tenantController.text = Session.tenantId!;
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _tenantController.dispose();
    _mfaController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() => _isLoading = true);
    try {
      final result = await _api.login(
        email: _emailController.text.trim(),
        password: _passwordController.text,
        mfaToken: _mfaController.text.trim().isEmpty ? null : _mfaController.text.trim(),
        tenantId: _tenantController.text.trim(),
      );
      // Full clear so no stale data from previous user can reappear (memory or storage)
      await Session.clear();
      Session.accessToken = result['accessToken'] as String?;
      Session.refreshToken = result['refreshToken'] as String?;
      Session.email = result['user']?['email'] as String?;
      Session.role = result['user']?['role'] as String?;
      Session.userId = result['user']?['id'] as String?;
      Session.mfaEnabled = result['user']?['mfaEnabled'] as bool?;
      Session.tenantId =
          _tenantController.text.trim().isNotEmpty
              ? _tenantController.text.trim()
              : result['user']?['tenantId'] as String?;
      Session.tenantName = result['tenantName'] as String? ?? result['user']?['tenantName'] as String?;
      Session.rememberMe = true;
      await Session.save();
      if (!mounted) return;
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => HomeScreen(key: ValueKey('${Session.userId ?? Session.email ?? ""}')),
        ),
      );
    } catch (e) {
      if (!mounted) return;
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
                        prefillTenant: _tenantController.text.trim(),
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
        AppToast.error(context, 'Login failed', e);
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _checkPolicy() async {
    final tenantId = _tenantController.text.trim();
    if (tenantId.isEmpty) {
      AppToast.error(context, 'Enter a tenant slug first');
      return;
    }
    setState(() => _policyLoading = true);
    try {
      final policy = await _api.fetchTenantPolicyPublic(tenantId);
      if (!mounted) return;
      setState(() => _tenantPolicy = policy);
    } catch (e) {
      if (!mounted) return;
      setState(() => _tenantPolicy = null);
      AppToast.error(context, 'Unable to load policy', e);
    } finally {
      if (mounted) {
        setState(() => _policyLoading = false);
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
                                TextFormField(
                                  controller: _tenantController,
                                  cursorColor: AppTheme.primary,
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: (isDarkMode ? Colors.black : Colors.white).withOpacity(0.35),
                                    labelText: 'Tenant',
                                    labelStyle: TextStyle(
                                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                    ),
                                    floatingLabelStyle: const TextStyle(color: AppTheme.primary),
                                    hintText: 'e.g. demo',
                                    hintStyle: TextStyle(
                                      color: isDarkMode ? Colors.grey[600] : Colors.grey[400],
                                    ),
                                    prefixIcon: Icon(
                                      Icons.business_outlined,
                                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                    ),
                                  ),
                                  style: TextStyle(
                                    color: isDarkMode ? Colors.white : Colors.black87,
                                  ),
                                  textCapitalization: TextCapitalization.none,
                                  validator: (value) {
                                    if (value == null || value.isEmpty) {
                                      return 'Tenant is required';
                                    }
                                    return null;
                                  },
                                ),
                                const SizedBox(height: 12),
                                Row(
                                  children: [
                                    Expanded(
                                      child: Text(
                                        _policyLoading
                                            ? 'Checking tenant policy...'
                                            : (_tenantPolicy == null
                                                ? 'Need MFA? Check tenant policy.'
                                                : (_tenantPolicy?['requireMfaUsers'] == true
                                                    ? 'Tenant requires driver MFA.'
                                                    : 'Tenant MFA optional.')),
                                        style: TextStyle(
                                          color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                    TextButton(
                                      onPressed: _policyLoading ? null : _checkPolicy,
                                      child: const Text('Check'),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 20),
                                TextFormField(
                                  controller: _emailController,
                                  cursorColor: AppTheme.primary,
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: (isDarkMode ? Colors.black : Colors.white).withOpacity(0.35),
                                    labelText: 'Email',
                                    labelStyle: TextStyle(
                                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                    ),
                                    floatingLabelStyle: const TextStyle(color: AppTheme.primary),
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
                                  cursorColor: AppTheme.primary,
                                  obscureText: !_showPassword,
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: (isDarkMode ? Colors.black : Colors.white).withOpacity(0.35),
                                    labelText: 'Password',
                                    labelStyle: TextStyle(
                                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                    ),
                                    floatingLabelStyle: const TextStyle(color: AppTheme.primary),
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
                                  cursorColor: AppTheme.primary,
                                  decoration: InputDecoration(
                                    filled: true,
                                    fillColor: (isDarkMode ? Colors.black : Colors.white).withOpacity(0.35),
                                    labelText: 'MFA Code (if enabled)',
                                    labelStyle: TextStyle(
                                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                    ),
                                    floatingLabelStyle: const TextStyle(color: AppTheme.primary),
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
                                const SizedBox(height: 28),
                                SizedBox(
                                  height: 56,
                                  child: ElevatedButton(
                                    onPressed: _isLoading ? null : _login,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppTheme.primary,
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

