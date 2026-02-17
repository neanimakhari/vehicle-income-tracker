import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../theme.dart';
import '../utils/app_toast.dart';

/// Screen to verify email with a 6-digit code sent by email (request code, then enter code).
class VerifyEmailOtpScreen extends StatefulWidget {
  const VerifyEmailOtpScreen({super.key, this.onVerified});

  final VoidCallback? onVerified;

  @override
  State<VerifyEmailOtpScreen> createState() => _VerifyEmailOtpScreenState();
}

class _VerifyEmailOtpScreenState extends State<VerifyEmailOtpScreen> {
  final _api = ApiService();
  final _codeController = TextEditingController();
  bool _sendLoading = false;
  bool _verifyLoading = false;
  bool _codeSent = false;
  bool _verified = false;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _sendCode() async {
    final email = Session.email;
    if (email == null || email.isEmpty) {
      AppToast.error(context, 'No email in session');
      return;
    }
    setState(() => _sendLoading = true);
    try {
      await _api.sendEmailOtp(email, tenantId: Session.tenantId);
      if (!mounted) return;
      setState(() {
        _sendLoading = false;
        _codeSent = true;
      });
      AppToast.success(context, 'Verification code sent to your email. Check your inbox.');
    } catch (e) {
      if (!mounted) return;
      setState(() => _sendLoading = false);
      AppToast.error(context, 'Failed to send code', e);
    }
  }

  Future<void> _verifyCode() async {
    final email = Session.email;
    final code = _codeController.text.trim();
    if (email == null || email.isEmpty) {
      AppToast.error(context, 'No email in session');
      return;
    }
    if (code.length != 6) {
      AppToast.error(context, 'Enter the 6-digit code');
      return;
    }
    setState(() => _verifyLoading = true);
    try {
      await _api.verifyEmailOtp(email, code, tenantId: Session.tenantId);
      if (!mounted) return;
      setState(() {
        _verifyLoading = false;
        _verified = true;
      });
      AppToast.success(context, 'Email verified successfully');
      widget.onVerified?.call();
    } catch (e) {
      if (!mounted) return;
      setState(() => _verifyLoading = false);
      AppToast.error(context, 'Verification failed', e);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDarkMode ? AppTheme.darkBackground : Colors.white,
      appBar: AppBar(
        title: const Text('Verify with code', style: TextStyle(fontSize: 18)),
        centerTitle: true,
        backgroundColor: AppTheme.primary,
        foregroundColor: Colors.white,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: _verified
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 40),
                    Icon(Icons.check_circle, size: 80, color: AppTheme.primary),
                    const SizedBox(height: 24),
                    Text(
                      'Email verified',
                      style: TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                        color: isDarkMode ? Colors.white : Colors.black87,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton(
                        onPressed: () => Navigator.pop(context),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                        ),
                        child: const Text('Back to Profile'),
                      ),
                    ),
                  ],
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const SizedBox(height: 16),
                    Text(
                      'Request a 6-digit code to verify your email, then enter it below.',
                      style: TextStyle(
                        fontSize: 16,
                        color: isDarkMode ? Colors.grey[400] : Colors.grey[700],
                      ),
                    ),
                    const SizedBox(height: 24),
                    SizedBox(
                      height: 48,
                      child: ElevatedButton.icon(
                        onPressed: _sendLoading ? null : _sendCode,
                        icon: _sendLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.email_outlined),
                        label: Text(_sendLoading ? 'Sending…' : 'Send verification code'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          foregroundColor: Colors.white,
                        ),
                      ),
                    ),
                    if (_codeSent) ...[
                      const SizedBox(height: 32),
                      Text(
                        'Enter the 6-digit code from your email',
                        style: TextStyle(
                          fontSize: 14,
                          color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                        ),
                      ),
                      const SizedBox(height: 12),
                      TextField(
                        controller: _codeController,
                        keyboardType: TextInputType.number,
                        maxLength: 6,
                        inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                        decoration: InputDecoration(
                          hintText: '000000',
                          counterText: '',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppTheme.radius),
                          ),
                        ),
                        style: const TextStyle(fontSize: 24, letterSpacing: 8),
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 24),
                      SizedBox(
                        height: 48,
                        child: ElevatedButton(
                          onPressed: _verifyLoading ? null : _verifyCode,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primary,
                            foregroundColor: Colors.white,
                          ),
                          child: _verifyLoading
                              ? const SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                                  ),
                                )
                              : const Text('Verify'),
                        ),
                      ),
                    ],
                  ],
                ),
        ),
      ),
    );
  }
}
