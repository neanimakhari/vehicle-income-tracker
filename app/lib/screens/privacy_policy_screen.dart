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
              '1. Who we are',
              'VIT (Vehicle Income Tracker) is operated by Vehinc. Contact privacy and support at support@vehinc.co.za. The full policy is also on https://vit-admin.vehinc.co.za/privacy.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '2. POPIA',
              'We process personal information under South Africa’s POPIA to provide fleet services under B2B contracts, secure accounts, run optional GPS and alerts, and meet legal duties. Your fleet operator (tenant) controls much of the data loaded into their workspace.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '3. What we collect',
              'Account details (name, email, phone), driver documents and expiry dates, income and expense records, optional banking fields for tenant payouts, device/login data, push identifiers, and GPS telemetry when tracking is enabled.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '4. Processors',
              'OneSignal (push), SMTP/Mailgun (email), OpenStreetMap tiles when maps load on related web tools, and on-device Google ML Kit OCR when you scan slips. We do not use third-party advertising analytics SDKs in this app.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '5. Your rights',
              'You may request access, correction, or deletion of personal information. Email support@vehinc.co.za or use the deletion form at https://vit-admin.vehinc.co.za/privacy/deletion-request. We aim to respond within 30 days.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '6. Children',
              'VIT is for adult drivers and fleet administrators, not children under 18.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '7. Contact',
              'Vehinc — support@vehinc.co.za',
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
              fontSize: 16,
              fontWeight: FontWeight.w600,
              color: isDarkMode ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            content,
            style: TextStyle(
              fontSize: 14,
              height: 1.45,
              color: isDarkMode ? Colors.white70 : Colors.black87,
            ),
          ),
        ],
      ),
    );
  }
}
