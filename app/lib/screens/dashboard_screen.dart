import 'dart:async';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../services/offline_queue.dart';
import '../theme.dart';
import '../utils/app_toast.dart';
import '../widgets/app_section.dart';
import 'history_screen.dart';
import 'income_log_screen.dart';
import 'profile_screen.dart';
import 'alerts_screen.dart';
import 'vehicle_insights_screen.dart';
import 'maintenance_screen.dart';
import 'driver_profile_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, this.openDrawer});

  final VoidCallback? openDrawer;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

/// Local background images for the dashboard header (alternate between these).
const _headerBgAssets = [
  'assets/images/bg.jpg',
  'assets/images/bg1.jpg',
  'assets/images/bg2.jpg',
];

class _DashboardScreenState extends State<DashboardScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _summary;
  Map<String, dynamic>? _tenantPolicy;
  Map<String, dynamic>? _driverProfile;
  List<Map<String, dynamic>> _recentIncomes = [];
  bool _loading = true;
  bool _loadingActivities = false;
  final _currentDateTime = DateTime.now();
  int _pendingQueue = 0;
  int _headerBgIndex = 0;
  Timer? _headerBgTimer;
  num _thisWeekIncome = 0;
  int _pendingMaintenanceCount = 0;
  int _documentsExpiringCount = 0;

  @override
  void initState() {
    super.initState();
    _loadSummary();
    _loadPolicy();
    _loadPendingQueue();
    _loadRecentActivities();
    _loadDriverProfile();
    _loadMaintenanceCount();
    _headerBgTimer = Timer.periodic(const Duration(seconds: 25), (_) {
      if (mounted) setState(() => _headerBgIndex = (_headerBgIndex + 1) % _headerBgAssets.length);
    });
  }

  @override
  void dispose() {
    _headerBgTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadSummary() async {
    setState(() => _loading = true);
    final currentUserId = Session.userId;
    try {
      final data = await _api.fetchSummary();
      if (!mounted) return;
      if (Session.userId != currentUserId) return;
      setState(() => _summary = data);
    } catch (_) {
      if (mounted && Session.userId == currentUserId) {
        setState(() => _summary = null);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadPendingQueue() async {
    final count = await OfflineQueue.pendingCount();
    if (mounted) {
      setState(() => _pendingQueue = count);
    }
  }

  Future<void> _syncPending() async {
    final synced = await OfflineQueue.syncPending(_api);
    if (!mounted) return;
    await _loadPendingQueue();
    if (synced > 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Synced $synced offline item(s).')),
      );
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No offline items to sync.')),
      );
    }
  }

  Future<void> _loadPolicy() async {
    if (Session.accessToken == null) return;
    final currentUserId = Session.userId;
    try {
      final policy = await _api.fetchTenantPolicy();
      if (!mounted || Session.userId != currentUserId) return;
      setState(() => _tenantPolicy = policy);
      final name = policy['tenantName'] as String?;
      if (name != null && name.isNotEmpty) {
        Session.tenantName = name;
        await Session.save();
      }
    } catch (_) {
      if (mounted && Session.userId == currentUserId) {
        setState(() => _tenantPolicy = null);
      }
    }
  }

  Future<void> _loadRecentActivities() async {
    setState(() => _loadingActivities = true);
    final currentUserId = Session.userId;
    try {
      // Paginated: only load first page for dashboard (avoids loading full list into memory).
      final result = await _api.fetchIncomesPaginated(page: 1, limit: 50);
      if (!mounted || Session.userId != currentUserId) return;
      final incomes = (result['data'] as List<dynamic>).cast<Map<String, dynamic>>();
      if (mounted) {
        final now = DateTime.now();
        final weekStart = DateTime(now.year, now.month, now.day).subtract(Duration(days: now.weekday - 1));
        final weekEnd = weekStart.add(const Duration(days: 7));
        num weekTotal = 0;
        for (final i in incomes) {
          final dateStr = i['loggedOn']?.toString() ?? i['logged_on']?.toString() ?? i['created_at']?.toString();
          final dt = DateTime.tryParse(dateStr ?? '');
          if (dt != null && !dt.isBefore(weekStart) && dt.isBefore(weekEnd)) {
            final amt = i['income'];
            if (amt != null) weekTotal += (amt is num ? amt : num.tryParse(amt.toString()) ?? 0);
          }
        }
        final sorted = List<Map<String, dynamic>>.from(incomes)
          ..sort((a, b) {
            final aDate = DateTime.tryParse(a['loggedOn']?.toString() ?? a['created_at']?.toString() ?? '');
            final bDate = DateTime.tryParse(b['loggedOn']?.toString() ?? b['created_at']?.toString() ?? '');
            if (aDate == null && bDate == null) return 0;
            if (aDate == null) return 1;
            if (bDate == null) return -1;
            return bDate.compareTo(aDate);
          });
        setState(() {
          _thisWeekIncome = weekTotal;
          _recentIncomes = sorted.take(5).toList();
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _recentIncomes = [];
          _thisWeekIncome = 0;
        });
      }
    } finally {
      if (mounted) {
        setState(() => _loadingActivities = false);
      }
    }
  }

  Future<void> _loadMaintenanceCount() async {
    try {
      final tasks = await _api.fetchMaintenanceTasks();
      if (mounted) {
        final count = tasks.where((t) {
          final completed = t['completed'] == true || t['status']?.toString() == 'completed';
          return !completed;
        }).length;
        setState(() => _pendingMaintenanceCount = count);
      }
    } catch (_) {
      if (mounted) setState(() => _pendingMaintenanceCount = 0);
    }
  }

  static int _countExpiringDocs(Map<String, dynamic>? profile) {
    if (profile == null) return 0;
    final in60Days = DateTime.now().add(const Duration(days: 60));
    int n = 0;
    for (final key in ['licenseExpiry', 'prdpExpiry', 'medicalCertificateExpiry']) {
      final v = profile[key]?.toString();
      if (v == null || v.isEmpty) continue;
      final d = DateTime.tryParse(v);
      if (d != null && d.isBefore(in60Days) && !d.isBefore(DateTime.now())) n++;
    }
    return n;
  }

  Future<void> _loadDriverProfile() async {
    final currentUserId = Session.userId;
    try {
      final profile = await _api.fetchDriverProfile();
      if (!mounted || Session.userId != currentUserId) return;
      setState(() {
        _driverProfile = profile;
        _documentsExpiringCount = _countExpiringDocs(profile);
      });
    } catch (_) {
      if (mounted && Session.userId == currentUserId) {
        setState(() {
          _driverProfile = null;
          _documentsExpiringCount = 0;
        });
      }
    }
  }

  /// Display name for the dashboard header: driver's first and last name from profile.
  String _dashboardDisplayName() {
    if (_driverProfile != null) {
      final first = _driverProfile!['firstName']?.toString() ?? '';
      final last = _driverProfile!['lastName']?.toString() ?? '';
      final full = '$first $last'.trim();
      if (full.isNotEmpty) return full;
    }
    return Session.email ?? 'Driver';
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final formattedDate = DateFormat('MMMM d, yyyy').format(_currentDateTime);
    return Scaffold(
      backgroundColor: isDarkMode ? AppTheme.darkBackground : Colors.white,
      body: _loading
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: AppTheme.primary),
                  const SizedBox(height: 16),
                  Text(
                    'Loading dashboard...',
                    style: TextStyle(
                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: () async {
                final prevTotal = _summary?['totalIncome']?.toString();
                final prevCount = _recentIncomes.length;
                await _loadSummary();
                await _loadPendingQueue();
                await _loadRecentActivities();
                await _loadDriverProfile();
                await _loadMaintenanceCount();
                if (!mounted) return;
                final changed = prevTotal != (_summary?['totalIncome']?.toString()) || prevCount != _recentIncomes.length;
                if (changed) {
                  AppToast.success(context, 'Data updated');
                }
              },
              child: CustomScrollView(
                slivers: [
                  SliverAppBar(
                    expandedHeight: 240.0,
                    floating: false,
                    pinned: true,
                    backgroundColor: AppTheme.darkBackground,
                    centerTitle: true,
                    leading: widget.openDrawer != null
                        ? IconButton(
                            icon: const Icon(Icons.menu, color: Colors.white),
                            onPressed: widget.openDrawer,
                          )
                        : null,
                    automaticallyImplyLeading: widget.openDrawer == null,
                    flexibleSpace: FlexibleSpaceBar(
                      background: Stack(
                        children: [
                          Positioned.fill(
                            child: Image.asset(
                              _headerBgAssets[_headerBgIndex],
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => Container(
                                color: AppTheme.darkBackground,
                              ),
                            ),
                          ),
                          Positioned.fill(
                            child: Container(
                              decoration: BoxDecoration(
                                gradient: LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    AppTheme.primary.withOpacity(0.12),
                                    AppTheme.primary.withOpacity(0.45),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          Positioned(
                            bottom: 20,
                            left: 20,
                            right: 20,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  'Welcome back,',
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(0.9),
                                    fontSize: 14,
                                  ),
                                ),
                                Text(
                                  _dashboardDisplayName(),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 24,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Row(
                                  children: [
                                    const Icon(Icons.calendar_today, color: Colors.white, size: 16),
                                    const SizedBox(width: 8),
                                    Text(
                                      formattedDate,
                                      style: const TextStyle(color: Colors.white, fontSize: 14),
                                    ),
                                    const SizedBox(width: 16),
                                    const Icon(Icons.access_time, color: Colors.white, size: 16),
                                    const SizedBox(width: 8),
                                    Text(
                                      DateFormat('h:mm a').format(DateTime.now()),
                                      style: const TextStyle(color: Colors.white, fontSize: 14),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    actions: [
                      IconButton(
                        icon: CircleAvatar(
                          radius: 16,
                          backgroundColor: Colors.white.withOpacity(0.2),
                          child: const Icon(Icons.notifications_outlined, color: Colors.white, size: 20),
                        ),
                        onPressed: () {
                          Navigator.push(
                            context,
                            MaterialPageRoute(builder: (_) => const AlertsScreen()),
                          );
                        },
                      ),
                      const SizedBox(width: 8),
                    ],
                  ),
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (_pendingQueue > 0)
                            Container(
                              width: double.infinity,
                              margin: const EdgeInsets.only(bottom: 16),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: isDarkMode ? AppTheme.darkSurface : Colors.blue.shade50,
                                borderRadius: BorderRadius.circular(AppTheme.radius),
                                border: Border.all(color: Colors.blue.shade200),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: Colors.blue.shade700.withOpacity(0.2),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(Icons.cloud_upload, color: Colors.blue.shade700, size: 22),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      '$_pendingQueue offline item(s) waiting to sync.',
                                      style: TextStyle(
                                        color: isDarkMode ? Colors.blue.shade200 : Colors.blue.shade900,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                  TextButton(
                                    onPressed: _syncPending,
                                    child: const Text('Sync now'),
                                  ),
                                ],
                              ),
                            ),
                          if (_tenantPolicy?['requireMfaUsers'] == true &&
                              Session.mfaEnabled != true)
                            Container(
                              width: double.infinity,
                              margin: const EdgeInsets.only(bottom: 16),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: isDarkMode ? AppTheme.darkSurface : Colors.amber.shade50,
                                borderRadius: BorderRadius.circular(AppTheme.radius),
                                border: Border.all(color: Colors.amber.shade300),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(10),
                                    decoration: BoxDecoration(
                                      color: Colors.amber.shade700.withOpacity(0.2),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(Icons.warning_amber, color: Colors.amber.shade700, size: 22),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Text(
                                      'MFA is required for this tenant. Enable MFA to keep access.',
                                      style: TextStyle(
                                        color: isDarkMode
                                            ? Colors.amber.shade200
                                            : Colors.amber.shade900,
                                        fontSize: 13,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          _buildQuickActions(context, isDarkMode),
                          const SizedBox(height: 24),
                          _buildSummaryWidgets(isDarkMode),
                          const SizedBox(height: 24),
                          _buildDashboard(isDarkMode),
                          const SizedBox(height: 24),
                          _buildRecentActivity(isDarkMode),
                          const SizedBox(height: 80),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildQuickActions(BuildContext context, bool isDarkMode) {
    final actions = <Widget>[
      _buildActionCard(
        context,
        icon: Icons.attach_money,
        title: 'Log Income',
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const IncomeLogScreen()),
          );
        },
        isDarkMode: isDarkMode,
        expand: true,
      ),
      _buildActionCard(
        context,
        icon: Icons.history,
        title: 'History',
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const HistoryScreen()),
          );
        },
        isDarkMode: isDarkMode,
        expand: true,
      ),
      _buildActionCard(
        context,
        icon: Icons.analytics,
        title: 'Insights',
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const VehicleInsightsScreen()),
          );
        },
        isDarkMode: isDarkMode,
        expand: true,
      ),
      _buildActionCard(
        context,
        icon: Icons.person,
        title: 'Profile',
        onTap: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const ProfileScreen()),
          );
        },
        isDarkMode: isDarkMode,
        expand: true,
      ),
      if (Session.role == 'TENANT_ADMIN')
        _buildActionCard(
          context,
          icon: Icons.build_circle_outlined,
          title: 'Maintenance',
          onTap: () {
            Navigator.push(
              context,
              MaterialPageRoute(builder: (_) => const MaintenanceScreen()),
            );
          },
          isDarkMode: isDarkMode,
          expand: true,
        ),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        AppSectionHeader('Quick Actions'),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            const gap = 12.0;
            const overflowFix = 14.0;
            final itemWidth = (constraints.maxWidth - gap - overflowFix) / 2;
            final rows = <Widget>[];
            for (var i = 0; i < actions.length; i += 2) {
              final rowChildren = actions.sublist(i, i + 2 > actions.length ? actions.length : i + 2);
              if (rowChildren.length == 2) {
                rows.add(
                  Row(
                    children: [
                      SizedBox(width: itemWidth, height: 114, child: rowChildren[0]),
                      const SizedBox(width: gap),
                      SizedBox(width: itemWidth, height: 114, child: rowChildren[1]),
                    ],
                  ),
                );
              } else {
                rows.add(
                  Row(
                    children: [
                      const Expanded(child: SizedBox.shrink()),
                      SizedBox(width: itemWidth, height: 114, child: rowChildren[0]),
                      const Expanded(child: SizedBox.shrink()),
                    ],
                  ),
                );
              }
            }
            return Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (var i = 0; i < rows.length; i++) ...[
                  if (i > 0) const SizedBox(height: gap),
                  rows[i],
                ],
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _buildActionCard(
    BuildContext context, {
    required IconData icon,
    required String title,
    required VoidCallback onTap,
    required bool isDarkMode,
    bool expand = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: expand ? null : MediaQuery.of(context).size.width * 0.28,
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDarkMode ? AppTheme.darkSurface : Colors.white,
          borderRadius: BorderRadius.circular(AppTheme.radius),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.05),
              blurRadius: 10,
              offset: const Offset(0, 2),
            ),
          ],
          border: Border.all(color: AppTheme.primary.withOpacity(0.1)),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppTheme.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: AppTheme.primary, size: 24),
            ),
            const SizedBox(height: 12),
            Text(
              title,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w500,
                color: isDarkMode ? Colors.white : Colors.black87,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryWidgets(bool isDarkMode) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'At a glance',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.bold,
            color: isDarkMode ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 12),
        LayoutBuilder(
          builder: (context, constraints) {
            const gap = 12.0;
            return Row(
              children: [
                Expanded(
                  child: _buildSummaryChip(
                    'This week',
                    'R $_thisWeekIncome',
                    Icons.trending_up,
                    AppTheme.success,
                    isDarkMode,
                    onTap: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const HistoryScreen()));
                    },
                  ),
                ),
                const SizedBox(width: gap),
                Expanded(
                  child: _buildSummaryChip(
                    'Pending maintenance',
                    '$_pendingMaintenanceCount',
                    Icons.build_circle_outlined,
                    Colors.orange,
                    isDarkMode,
                    onTap: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const MaintenanceScreen()));
                    },
                  ),
                ),
                const SizedBox(width: gap),
                Expanded(
                  child: _buildSummaryChip(
                    'Docs expiring soon',
                    '$_documentsExpiringCount',
                    Icons.description_outlined,
                    Colors.amber,
                    isDarkMode,
                    onTap: () {
                      Navigator.push(context, MaterialPageRoute(builder: (_) => const DriverProfileScreen()));
                    },
                  ),
                ),
              ],
            );
          },
        ),
      ],
    );
  }

  Widget _buildSummaryChip(
    String title,
    String value,
    IconData icon,
    Color color,
    bool isDarkMode, {
    VoidCallback? onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 10),
          decoration: BoxDecoration(
            color: isDarkMode ? AppTheme.darkSurface : Colors.white,
            borderRadius: BorderRadius.circular(AppTheme.radius),
            border: Border.all(color: color.withOpacity(0.3)),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, color: color, size: 22),
              const SizedBox(height: 6),
              Text(
                value,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isDarkMode ? Colors.white : Colors.black87,
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 2),
              Text(
                title,
                style: TextStyle(
                  fontSize: 11,
                  color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                ),
                textAlign: TextAlign.center,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDashboard(bool isDarkMode) {
    final totalIncome = _summary?['totalIncome'] ?? 0;
    final totalExpenses = _summary?['totalExpenses'] ?? 0;
    final netIncome = _summary?['netIncome'] ?? 0;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Dashboard',
          style: TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: isDarkMode ? Colors.white : Colors.black87,
          ),
        ),
        const SizedBox(height: 16),
        Row(
          children: [
            Expanded(
              child: _buildDashboardCard(
                'Total Income',
                'R $totalIncome',
                Icons.arrow_upward,
                AppTheme.success,
                isDarkMode,
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: _buildDashboardCard(
                'Total Expenses',
                'R $totalExpenses',
                Icons.arrow_downward,
                AppTheme.danger,
                isDarkMode,
              ),
            ),
          ],
        ),
        const SizedBox(height: 16),
        _buildDashboardCard(
          'Net Income',
          'R $netIncome',
          Icons.account_balance_wallet,
          AppTheme.primary,
          isDarkMode,
        ),
      ],
    );
  }

  Widget _buildDashboardCard(
    String title,
    String amount,
    IconData icon,
    Color color,
    bool isDarkMode,
  ) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDarkMode ? AppTheme.darkSurface : Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(AppTheme.radius),
                ),
                child: Icon(icon, color: color, size: 20),
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: TextStyle(
                  fontSize: 14,
                  color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            amount,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: isDarkMode ? Colors.white : Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentActivity(bool isDarkMode) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            AppSectionHeader('Recent Activity', padding: EdgeInsets.zero),
            TextButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const HistoryScreen()),
                );
              },
              child: const Text('View All'),
            ),
          ],
        ),
        const SizedBox(height: 16),
        if (_loadingActivities)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(24.0),
              child: CircularProgressIndicator(),
            ),
          )
        else if (_recentIncomes.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: isDarkMode ? AppTheme.darkSurface : Colors.grey.shade50,
              borderRadius: BorderRadius.circular(AppTheme.radius),
              border: Border.all(color: Colors.grey.withOpacity(0.2)),
            ),
            child: Center(
              child: Column(
                children: [
                  Icon(
                    Icons.history,
                    size: 48,
                    color: isDarkMode ? Colors.grey[600] : Colors.grey[400],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    'No recent activity',
                    style: TextStyle(
                      fontSize: 16,
                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Start logging income to see activity here',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDarkMode ? Colors.grey[500] : Colors.grey[500],
                    ),
                  ),
                ],
              ),
            ),
          )
        else
          ..._recentIncomes.map((income) => _buildIncomeActivityItem(income, isDarkMode)),
      ],
    );
  }

  static double _toDouble(dynamic v) {
    if (v == null) return 0;
    if (v is num) return v.toDouble();
    return double.tryParse(v.toString()) ?? 0;
  }

  Widget _buildIncomeActivityItem(Map<String, dynamic> income, bool isDarkMode) {
    final loggedOn = DateTime.tryParse(income['loggedOn']?.toString() ?? income['created_at']?.toString() ?? '');
    final timeAgo = loggedOn != null ? _formatTimeAgo(loggedOn) : 'Unknown';
    final incomeAmount = _toDouble(income['income']);
    final vehicle = income['vehicle']?.toString() ?? 'Unknown Vehicle';
    final expenseVal = _toDouble(income['expensePrice']);
    final hasExpense = expenseVal > 0;
    final expenseAmount = expenseVal;
    final petrolAmount = _toDouble(income['petrolPoured']);

    String description = 'Logged R ${incomeAmount.toStringAsFixed(2)} income for $vehicle';
    if (hasExpense || petrolAmount > 0) {
      final parts = <String>[];
      if (petrolAmount > 0) {
        parts.add('R ${petrolAmount.toStringAsFixed(2)} fuel');
      }
      if (hasExpense) {
        parts.add('R ${expenseAmount.toStringAsFixed(2)} expense');
      }
      if (parts.isNotEmpty) {
        description += ' (${parts.join(', ')})';
      }
    }

    IconData icon = Icons.attach_money;
    Color color = AppTheme.success;

    if (hasExpense && petrolAmount > 0) {
      icon = Icons.local_gas_station;
      color = AppTheme.danger;
    } else if (hasExpense) {
      icon = Icons.receipt;
      color = Colors.orange;
    }

    return _buildActivityItem(
      {
        'title': 'Income Logged',
        'description': description,
        'time': timeAgo,
        'icon': icon,
        'color': color,
      },
      isDarkMode,
    );
  }

  String _formatTimeAgo(DateTime dateTime) {
    final now = DateTime.now();
    final difference = now.difference(dateTime);

    if (difference.inDays > 7) {
      return DateFormat('MMM d').format(dateTime);
    } else if (difference.inDays > 0) {
      return '${difference.inDays} ${difference.inDays == 1 ? 'day' : 'days'} ago';
    } else if (difference.inHours > 0) {
      return '${difference.inHours} ${difference.inHours == 1 ? 'hour' : 'hours'} ago';
    } else if (difference.inMinutes > 0) {
      return '${difference.inMinutes} ${difference.inMinutes == 1 ? 'minute' : 'minutes'} ago';
    } else {
      return 'Just now';
    }
  }

  Widget _buildActivityItem(Map<String, dynamic> activity, bool isDarkMode) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDarkMode ? AppTheme.darkSurface : Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
        border: Border.all(color: Colors.grey.withOpacity(0.2)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: (activity['color'] as Color).withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              activity['icon'] as IconData,
              color: activity['color'] as Color,
              size: 24,
            ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  activity['title'] as String,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: isDarkMode ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  activity['description'] as String,
                  style: TextStyle(
                    fontSize: 14,
                    color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          Text(
            activity['time'] as String,
            style: TextStyle(
              fontSize: 12,
              color: isDarkMode ? Colors.grey[500] : Colors.grey[600],
            ),
          ),
        ],
      ),
    );
  }
}

