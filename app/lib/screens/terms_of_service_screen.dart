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
              '1. Acceptance',
              'By using VIT (Vehicle Income Tracker), operated by Vehinc, you agree to these Terms. Full terms: https://vit-admin.vehinc.co.za/terms',
              isDarkMode,
            ),
            _buildSection(
              context,
              '2. User responsibilities',
              'Keep credentials secure, provide accurate information, and use the service only for lawful fleet operations authorised by your company.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '3. Acceptable use',
              'Do not break the law, attempt unauthorised access, disrupt the service, or misuse panic/alert features.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '4. Data',
              'You (or your organisation) own data you submit. See the Privacy Policy for POPIA details. Vehinc does not take public in-app card payments.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '5. Liability',
              'To the extent permitted by South African law, Vehinc is not liable for indirect or consequential loss from use of the service.',
              isDarkMode,
            ),
            _buildSection(
              context,
              '6. Contact',
              'support@vehinc.co.za',
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

