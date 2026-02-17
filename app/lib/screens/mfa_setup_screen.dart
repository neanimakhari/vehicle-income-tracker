import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../theme.dart';
import '../utils/app_toast.dart';
import 'home_screen.dart';

class MfaSetupScreen extends StatefulWidget {
  const MfaSetupScreen({
    super.key,
    this.prefillEmail,
    this.prefillPassword,
    this.prefillTenant,
    this.forceUnauth = false,
    this.returnToHome = false,
  });

  final String? prefillEmail;
  final String? prefillPassword;
  final String? prefillTenant;
  final bool forceUnauth;
  final bool returnToHome;

  @override
  State<MfaSetupScreen> createState() => _MfaSetupScreenState();
}

class _MfaSetupScreenState extends State<MfaSetupScreen> {
  final _api = ApiService();
  final _tokenController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _tenantController = TextEditingController();
  String? _qrDataUrl;
  String? _secret;
  bool _loading = false;
  bool _enabled = false;
  bool _showPassword = false;

  @override
  void dispose() {
    _tokenController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _tenantController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _emailController.text = widget.prefillEmail ?? Session.email ?? '';
    _passwordController.text = widget.prefillPassword ?? '';
    _tenantController.text = widget.prefillTenant ?? Session.tenantId ?? '';
  }

  bool get _useUnauthFlow {
    if (widget.forceUnauth) return true;
    return Session.accessToken == null;
  }

  Future<void> _generate() async {
    if (_useUnauthFlow) {
      if (_emailController.text.trim().isEmpty ||
          _passwordController.text.isEmpty ||
          _tenantController.text.trim().isEmpty) {
        AppToast.error(context, 'Email, password, and tenant are required');
        return;
      }
    }
    setState(() => _loading = true);
    try {
      final data = _useUnauthFlow
          ? await _api.setupMfaInit(
              email: _emailController.text.trim(),
              password: _passwordController.text,
              tenantId: _tenantController.text.trim(),
            )
          : await _api.setupMfa();
      setState(() {
        _qrDataUrl = data['qrCodeDataUrl'] as String?;
        _secret = data['secret'] as String?;
      });
    } catch (e) {
      if (!mounted) return;
      AppToast.error(context, 'Failed to generate MFA', e);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _verify() async {
    final token = _tokenController.text.trim();
    if (token.isEmpty) {
      AppToast.error(context, 'Enter a valid code');
      return;
    }
    if (_useUnauthFlow) {
      if (_emailController.text.trim().isEmpty ||
          _passwordController.text.isEmpty ||
          _tenantController.text.trim().isEmpty) {
        AppToast.error(context, 'Email, password, and tenant are required');
        return;
      }
    }
    setState(() => _loading = true);
    try {
      if (_useUnauthFlow) {
        await _api.verifyMfaInit(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          tenantId: _tenantController.text.trim(),
          token: token,
        );
      } else {
        await _api.verifyMfa(token);
      }
      if (!mounted) return;
      AppToast.success(context, 'MFA enabled successfully');
      Session.mfaEnabled = true;
      await Session.save();
      setState(() => _enabled = true);
    } catch (e) {
      if (!mounted) return;
      AppToast.error(context, 'Invalid code', e);
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'MFA Setup',
          style: TextStyle(fontSize: 18),
        ),
        centerTitle: true,
      ),
      backgroundColor: isDarkMode ? AppTheme.darkBackground : Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Multi-Factor Authentication',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: isDarkMode ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Generate a QR code, scan it in your authenticator, then verify the code.',
                style: TextStyle(
                  color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
              const SizedBox(height: 16),
              if (_useUnauthFlow) ...[
                TextField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(labelText: 'Email'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _passwordController,
                  obscureText: !_showPassword,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    suffixIcon: IconButton(
                      icon: Icon(_showPassword ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _showPassword = !_showPassword),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _tenantController,
                  decoration: const InputDecoration(labelText: 'Tenant Slug'),
                ),
                const SizedBox(height: 12),
              ],
              ElevatedButton(
                onPressed: _loading ? null : _generate,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                ),
                child: _loading
                    ? const SizedBox(
                        height: 16,
                        width: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Text('Generate QR Code'),
              ),
              const SizedBox(height: 16),
              if (_qrDataUrl != null) ...[
                Center(
                  child: _qrDataUrlImage(_qrDataUrl!),
                ),
                if (_secret != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text(
                      'Secret: $_secret',
                      style: TextStyle(
                        color: isDarkMode ? Colors.grey[300] : Colors.grey[700],
                        fontSize: 12,
                      ),
                    ),
                  ),
                const SizedBox(height: 24),
                TextField(
                  controller: _tokenController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Authenticator Code',
                    hintText: '123456',
                  ),
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: _loading ? null : _verify,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.white,
                  ),
                  child: const Text('Verify & Enable'),
                ),
                if (_enabled) ...[
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: () {
                      if (widget.returnToHome) {
                        Navigator.of(context).pushAndRemoveUntil(
                          MaterialPageRoute(builder: (_) => const HomeScreen()),
                          (route) => false,
                        );
                        return;
                      }
                      Navigator.of(context).pop();
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                    ),
                    child: const Text('Continue'),
                  ),
                ],
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _qrDataUrlImage(String dataUrl) {
    final bytes = _decodeDataUrl(dataUrl);
    if (bytes == null) {
      return const Icon(Icons.broken_image, size: 96);
    }
    return Image.memory(bytes, height: 200, width: 200);
  }

  Uint8List? _decodeDataUrl(String dataUrl) {
    try {
      final base64Part = dataUrl.contains(',') ? dataUrl.split(',').last : dataUrl;
      return base64Decode(base64Part);
    } catch (_) {
      return null;
    }
  }
}

