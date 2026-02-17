import 'package:flutter/material.dart';
import '../theme.dart';

class TermsOfServiceScreen extends StatelessWidget {
  const TermsOfServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Terms of Service',
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
              'Terms of Service',
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
              '1. Acceptance of Terms',
              'By accessing and using VIT (Vehicle Income Tracker), you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, you must not use our services.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '2. User Responsibilities',
              'You are responsible for maintaining the confidentiality of your account credentials, providing accurate information, and using the service only for lawful purposes. You must notify us immediately of any unauthorized access.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '3. Acceptable Use',
              'You agree not to use the service for illegal purposes, attempt unauthorized access, interfere with the service, upload malicious code, or violate any applicable laws or regulations.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '4. Data and Content',
              'You retain ownership of all data you upload. You grant us a license to use, store, and process your data to provide the service. You are responsible for the accuracy of your data.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '5. Service Availability',
              'We strive to provide reliable service but do not guarantee uninterrupted operation. We may perform maintenance that temporarily affects availability. We are not liable for losses from service interruptions.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '6. Limitation of Liability',
              'To the maximum extent permitted by law, we shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, revenues, or data.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '7. Termination',
              'We may terminate or suspend your account immediately for conduct that violates these Terms or is harmful to other users. Upon termination, your right to use the service will cease immediately.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '8. Changes to Terms',
              'We reserve the right to modify these Terms at any time. We will notify users of significant changes. Your continued use after changes constitutes acceptance of the new terms.',
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

