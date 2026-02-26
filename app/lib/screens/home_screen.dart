import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../theme.dart';
import '../widgets/sidebar.dart';
import 'dashboard_screen.dart';
import 'income_log_screen.dart';
import 'history_screen.dart';
import 'profile_screen.dart';
import 'login_screen.dart';

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
    Session.onCleared = _handleSessionCleared;
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

  @override
  void dispose() {
    // Only clear the callback if we are the current owner
    if (Session.onCleared == _handleSessionCleared) {
      Session.onCleared = null;
    }
    super.dispose();
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

  void _handleSessionCleared() {
    if (!mounted) return;
    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(builder: (_) => const LoginScreen()),
      (_) => false,
    );
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
      body: LayoutBuilder(
        builder: (context, constraints) {
          final bottomInset = MediaQuery.of(context).viewPadding.bottom;
          return Stack(
            children: [
              // Add bottom padding to prevent content from being hidden
              Padding(
                padding: EdgeInsets.only(bottom: _navbarVisible ? 88 : 16),
                child: _pages[_index],
              ),
              // Collapsible Navigation Bar with always-visible toggle handle
              Positioned(
                left: 16,
                right: 16,
                bottom: bottomInset + 8,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Toggle Button (always visible)
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
                    // Navigation Bar (expands/collapses, but handle stays)
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 250),
                      curve: Curves.easeInOut,
                      height: _navbarVisible ? 64 : 0,
                      child: ClipRRect(
                        borderRadius: BorderRadius.only(
                          bottomLeft: Radius.circular(AppTheme.radius),
                          bottomRight: Radius.circular(AppTheme.radius),
                        ),
                        child: Container(
                          decoration: BoxDecoration(
                            color: barColor,
                            border: Border(
                              left: BorderSide(color: borderColor),
                              right: BorderSide(color: borderColor),
                              bottom: BorderSide(color: borderColor),
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
                      ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
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

