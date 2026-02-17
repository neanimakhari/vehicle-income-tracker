import 'package:flutter/material.dart';
import '../theme.dart';

class PrivacyPolicyScreen extends StatelessWidget {
  const PrivacyPolicyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Privacy Policy',
          style: TextStyle(fontSize: 18),
        ),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      backgroundColor: isDarkMode ? AppTheme.darkBackground : Colors.white,
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Privacy Policy',
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: isDarkMode ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Last updated: ${DateTime.now().toLocal().toString().split(' ')[0]}',
              style: TextStyle(
                fontSize: 12,
                color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
              ),
            ),
            const SizedBox(height: 24),
            _buildSection(
              context,
              '1. Introduction',
              'Welcome to VIT (Vehicle Income Tracker). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '2. Information We Collect',
              'We collect personal information including your name, email, phone number, driver license details, banking information, and usage data such as income records, vehicle information, and device details.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '3. How We Use Your Information',
              'We use your information to provide and maintain our services, process transactions, send notifications, improve our services, comply with legal obligations, and detect and prevent fraud.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '4. Data Security',
              'We implement industry-standard security measures including encryption, multi-factor authentication, biometric authentication, regular security audits, and access controls to protect your data.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '5. Your Rights (GDPR)',
              'You have the right to access, rectify, erase, port, object to, and restrict processing of your personal data. Contact support to exercise these rights.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '6. Data Retention',
              'We retain your personal information for as long as necessary to provide our services and comply with legal obligations. Financial records are retained according to applicable regulations.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '7. Contact Us',
              'If you have questions about this Privacy Policy or wish to exercise your rights, please contact us through the Help & Support page or your tenant administrator.',
              isDarkMode,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSection(BuildContext context, String title, String content, bool isDarkMode) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: isDarkMode ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            content,
            style: TextStyle(
              fontSize: 14,
              color: isDarkMode ? Colors.grey[300] : Colors.grey[700],
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }
}

