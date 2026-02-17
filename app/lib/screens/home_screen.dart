import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../theme.dart';
import '../widgets/sidebar.dart';
import 'dashboard_screen.dart';
import 'income_log_screen.dart';
import 'history_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  int _index = 0;
  bool _navbarVisible = true;
  late final List<Widget> _pages;
  String? _driverDisplayName;
  bool? _emailVerified;
  bool _showExpiryBadge = false;

  @override
  void initState() {
    super.initState();
    _driverDisplayName = Session.email;
    _loadDriverDisplayName();
    _loadExpiryStatus();
    _pages = [
      DashboardScreen(openDrawer: () => _scaffoldKey.currentState?.openDrawer()),
      IncomeLogScreen(onBack: _handleBackToHome, openDrawer: () => _scaffoldKey.currentState?.openDrawer()),
      HistoryScreen(onBack: _handleBackToHome, openDrawer: () => _scaffoldKey.currentState?.openDrawer()),
      ProfileScreen(onBack: _handleBackToHome, openDrawer: () => _scaffoldKey.currentState?.openDrawer()),
    ];
  }

  Future<void> _loadDriverDisplayName() async {
    if (Session.accessToken == null) return;
    final currentUserId = Session.userId;
    try {
      final profile = await ApiService().fetchDriverProfile();
      if (!mounted || Session.userId != currentUserId) return;
      final first = profile['firstName']?.toString().trim() ?? '';
      final last = profile['lastName']?.toString().trim() ?? '';
      final full = '$first $last'.trim();
      final verified = profile['emailVerified'] == true;
      if (mounted) {
        setState(() {
          if (full.isNotEmpty) _driverDisplayName = full;
          _emailVerified = verified;
        });
      }
    } catch (_) {
      if (mounted && _driverDisplayName == null && Session.userId == currentUserId) {
        setState(() => _driverDisplayName = Session.email);
      }
    }
  }

  Future<void> _loadExpiryStatus() async {
    if (Session.accessToken == null) return;
    try {
      final status = await ApiService().fetchExpiryStatus();
      if (!mounted) return;
      setState(() => _showExpiryBadge = status['showExpiryBadge'] == true);
    } catch (_) {
      if (mounted) setState(() => _showExpiryBadge = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final barColor = isDarkMode ? AppTheme.darkSurface : AppTheme.primary;
    final borderColor = isDarkMode ? AppTheme.darkBorder : Colors.transparent;
    return Scaffold(
      key: _scaffoldKey,
      drawer: AppSidebar(
        onSelect: (index) {
          setState(() => _index = index);
          if (index == 0) _loadExpiryStatus();
        },
        driverDisplayName: _driverDisplayName ?? Session.email ?? 'Driver',
        emailVerified: _emailVerified,
        showExpiryBadge: _showExpiryBadge,
      ),
      body: Stack(
        children: [
          // Add bottom padding to prevent content from being hidden
          Padding(
            padding: EdgeInsets.only(bottom: _navbarVisible ? 88 : 16),
            child: _pages[_index],
          ),
          // Collapsible Navigation Bar
          AnimatedPositioned(
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            left: 16,
            right: 16,
            bottom: _navbarVisible ? 16 : -80,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Toggle Button
                GestureDetector(
                  onTap: () => setState(() => _navbarVisible = !_navbarVisible),
                  child: Container(
                    width: 48,
                    height: 32,
                    decoration: BoxDecoration(
                      color: barColor,
                      border: Border(
                        left: BorderSide(color: borderColor),
                        right: BorderSide(color: borderColor),
                        top: BorderSide(color: borderColor),
                      ),
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(AppTheme.radius),
                        topRight: Radius.circular(AppTheme.radius),
                      ),
                    ),
                    child: Icon(
                      _navbarVisible ? Icons.keyboard_arrow_down : Icons.keyboard_arrow_up,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                ),
                // Navigation Bar
                Container(
                  height: 64,
                  decoration: BoxDecoration(
                    color: barColor,
                    border: Border(
                      left: BorderSide(color: borderColor),
                      right: BorderSide(color: borderColor),
                      bottom: BorderSide(color: borderColor),
                    ),
                    borderRadius: BorderRadius.only(
                      bottomLeft: Radius.circular(AppTheme.radius),
                      bottomRight: Radius.circular(AppTheme.radius),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(isDarkMode ? 0.4 : 0.2),
                        blurRadius: 10,
                        offset: const Offset(0, 5),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _navItem(Icons.dashboard, 'Home', 0, isDarkMode),
                      _navItem(Icons.attach_money, 'Income', 1, isDarkMode),
                      _navItem(Icons.history, 'History', 2, isDarkMode),
                      _navItem(Icons.person, 'Profile', 3, isDarkMode),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _handleBackToHome() {
    if (_index != 0) {
      setState(() => _index = 0);
    }
  }

  Widget _navItem(IconData icon, String label, int index, bool isDarkMode) {
    final isSelected = _index == index;
    final iconColor = isDarkMode
        ? (isSelected ? AppTheme.primary : Colors.white70)
        : (isSelected ? Colors.white : Colors.white.withOpacity(0.6));
    final textColor = isDarkMode
        ? (isSelected ? AppTheme.primary : Colors.white70)
        : (isSelected ? Colors.white : Colors.white.withOpacity(0.6));
    return InkWell(
      onTap: () => setState(() => _index = index),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: iconColor, size: 24),
          const SizedBox(height: 4),
          Text(
            label,
            style: TextStyle(
              color: textColor,
              fontSize: 12,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}

