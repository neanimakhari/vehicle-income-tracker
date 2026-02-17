import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../services/api_service.dart';
import '../theme.dart';
import '../utils/app_toast.dart';
import '../widgets/sidebar.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key, this.onBack, this.openDrawer});

  final VoidCallback? onBack;
  final VoidCallback? openDrawer;

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

/// Max incomes to keep in memory (paginated load-more cap).
const int _kMaxIncomesInMemory = 300;

class _HistoryScreenState extends State<HistoryScreen> {
  final _api = ApiService();
  final _searchController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  bool _loading = true;
  bool _loadingMore = false;
  List<Map<String, dynamic>> _incomes = [];
  List<Map<String, dynamic>> _filteredIncomes = [];
  int _page = 1;
  int _totalCount = 0;
  String _selectedPeriod = 'This Month';
  String? _selectedVehicle;
  String? _selectedSortBy;
  final List<String> _sortOptions = ['Date (Newest)', 'Date (Oldest)', 'Amount (High)', 'Amount (Low)'];

  bool get _hasMore =>
      _incomes.length < _totalCount && _incomes.length < _kMaxIncomesInMemory && !_loadingMore;

  @override
  void initState() {
    super.initState();
    _searchController.addListener(_applyFilters);
    _scrollController.addListener(_onScroll);
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_hasMore || _loading || _loadingMore) return;
    final pos = _scrollController.position;
    if (pos.pixels >= pos.maxScrollExtent - 200) {
      _loadMore();
    }
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    _page = 1;
    try {
      final result = await _api.fetchIncomesPaginated(page: 1, limit: ApiService.incomesPageSize);
      final data = (result['data'] as List<dynamic>).cast<Map<String, dynamic>>();
      final total = (result['total'] as num?)?.toInt() ?? data.length;
      if (mounted) {
        setState(() {
          _incomes = data;
          _totalCount = total;
          _page = 2;
          _applyFilters();
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _incomes = [];
          _filteredIncomes = [];
          _totalCount = 0;
        });
        AppToast.error(context, 'Failed to load history', e);
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _loadMore() async {
    if (!_hasMore || _loadingMore) return;
    setState(() => _loadingMore = true);
    try {
      final result = await _api.fetchIncomesPaginated(
        page: _page,
        limit: ApiService.incomesPageSize,
      );
      final data = (result['data'] as List<dynamic>).cast<Map<String, dynamic>>();
      final total = (result['total'] as num?)?.toInt() ?? _totalCount;
      if (mounted && data.isNotEmpty) {
        setState(() {
          _incomes = [..._incomes, ...data];
          _totalCount = total;
          _page++;
          _applyFilters();
        });
      }
    } catch (_) {
      if (mounted) {}
    } finally {
      if (mounted) setState(() => _loadingMore = false);
    }
  }

  void _applyFilters() {
    List<Map<String, dynamic>> filtered = List.from(_incomes);

    // Period filter
    filtered = _filterByPeriod(filtered, _selectedPeriod);

    // Vehicle filter
    if (_selectedVehicle != null && _selectedVehicle!.isNotEmpty) {
      filtered = filtered.where((income) {
        final vehicle = income['vehicle']?.toString().toLowerCase() ?? '';
        return vehicle.contains(_selectedVehicle!.toLowerCase());
      }).toList();
    }

    // Search filter
    final searchQuery = _searchController.text.toLowerCase().trim();
    if (searchQuery.isNotEmpty) {
      filtered = filtered.where((income) {
        final vehicle = income['vehicle']?.toString().toLowerCase() ?? '';
        final driverName = income['driverName']?.toString().toLowerCase() ?? '';
        final incomeAmount = income['income']?.toString() ?? '';
        final expensePrice = income['expensePrice']?.toString() ?? '';
        final notes = income['notes']?.toString().toLowerCase() ?? '';
        return vehicle.contains(searchQuery) ||
            driverName.contains(searchQuery) ||
            incomeAmount.contains(searchQuery) ||
            expensePrice.contains(searchQuery) ||
            notes.contains(searchQuery);
      }).toList();
    }

    // Sort
    if (_selectedSortBy != null) {
      filtered.sort((a, b) {
        switch (_selectedSortBy) {
          case 'Date (Newest)':
            final aDate = DateTime.tryParse(a['loggedOn']?.toString() ?? a['created_at']?.toString() ?? '');
            final bDate = DateTime.tryParse(b['loggedOn']?.toString() ?? b['created_at']?.toString() ?? '');
            if (aDate == null && bDate == null) return 0;
            if (aDate == null) return 1;
            if (bDate == null) return -1;
            return bDate.compareTo(aDate);
          case 'Date (Oldest)':
            final aDate = DateTime.tryParse(a['loggedOn']?.toString() ?? a['created_at']?.toString() ?? '');
            final bDate = DateTime.tryParse(b['loggedOn']?.toString() ?? b['created_at']?.toString() ?? '');
            if (aDate == null && bDate == null) return 0;
            if (aDate == null) return 1;
            if (bDate == null) return -1;
            return aDate.compareTo(bDate);
          case 'Amount (High)':
            final aAmount = (a['income'] as num?)?.toDouble() ?? 0.0;
            final bAmount = (b['income'] as num?)?.toDouble() ?? 0.0;
            return bAmount.compareTo(aAmount);
          case 'Amount (Low)':
            final aAmount = (a['income'] as num?)?.toDouble() ?? 0.0;
            final bAmount = (b['income'] as num?)?.toDouble() ?? 0.0;
            return aAmount.compareTo(bAmount);
          default:
            return 0;
        }
      });
    } else {
      // Default: newest first
      filtered.sort((a, b) {
        final aDate = DateTime.tryParse(a['loggedOn']?.toString() ?? a['created_at']?.toString() ?? '');
        final bDate = DateTime.tryParse(b['loggedOn']?.toString() ?? b['created_at']?.toString() ?? '');
        if (aDate == null && bDate == null) return 0;
        if (aDate == null) return 1;
        if (bDate == null) return -1;
        return bDate.compareTo(aDate);
      });
    }

    setState(() => _filteredIncomes = filtered);
  }

  List<String> _getUniqueVehicles() {
    final vehicles = <String>{};
    for (final income in _incomes) {
      final vehicle = income['vehicle']?.toString();
      if (vehicle != null && vehicle.isNotEmpty) {
        vehicles.add(vehicle);
      }
    }
    return vehicles.toList()..sort();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final totalIncome = _calculateTotalIncome(_filteredIncomes);
    final totalExpenses = _calculateTotalExpenses(_filteredIncomes);
    final netIncome = _calculateNetIncome(_filteredIncomes);
    final uniqueVehicles = _getUniqueVehicles();
    return Scaffold(
      drawer: AppSidebar(
        onSelect: (index) {
          Navigator.pop(context);
        },
      ),
      appBar: AppBar(
        title: const Text('History'),
        centerTitle: true,
        backgroundColor: isDarkMode ? AppTheme.darkBackground : null,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (widget.onBack != null) {
              widget.onBack!();
              return;
            }
            if (Navigator.of(context).canPop()) {
              Navigator.pop(context);
            } else if (widget.openDrawer != null) {
              widget.openDrawer!();
            }
          },
        ),
        actions: [
          IconButton(
            onPressed: () {
              showModalBottomSheet(
                context: context,
                backgroundColor: isDarkMode ? AppTheme.darkSurface : Colors.white,
                shape: const RoundedRectangleBorder(
                  borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
                ),
                builder: (context) => _buildFilterSheet(context, isDarkMode, uniqueVehicles),
              );
            },
            icon: const Icon(Icons.filter_list),
          ),
          IconButton(
            onPressed: _load,
            icon: const Icon(Icons.refresh),
          ),
        ],
      ),
      backgroundColor: isDarkMode ? AppTheme.darkBackground : Colors.white,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Search Bar
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: TextField(
                controller: _searchController,
                style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87),
                decoration: InputDecoration(
                  hintText: 'Search by vehicle, driver, amount...',
                  hintStyle: TextStyle(color: isDarkMode ? Colors.grey[500] : Colors.grey[600]),
                  prefixIcon: Icon(Icons.search, color: isDarkMode ? Colors.grey[400] : Colors.grey[600]),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radius),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppTheme.radius),
                    borderSide: BorderSide(color: isDarkMode ? AppTheme.darkBorder : Colors.grey.shade300),
                  ),
                  filled: true,
                  fillColor: isDarkMode ? AppTheme.darkSurface : Colors.grey.shade50,
                ),
              ),
            ),
            // Quick Filters
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildQuickFilterChip('Today', _selectedPeriod == 'Today', () {
                      setState(() => _selectedPeriod = 'Today');
                      _applyFilters();
                    }, isDarkMode),
                    const SizedBox(width: 8),
                    _buildQuickFilterChip('This Week', _selectedPeriod == 'This Week', () {
                      setState(() => _selectedPeriod = 'This Week');
                      _applyFilters();
                    }, isDarkMode),
                    const SizedBox(width: 8),
                    _buildQuickFilterChip('This Month', _selectedPeriod == 'This Month', () {
                      setState(() => _selectedPeriod = 'This Month');
                      _applyFilters();
                    }, isDarkMode),
                    const SizedBox(width: 8),
                    _buildQuickFilterChip('All Time', _selectedPeriod == 'All Time', () {
                      setState(() => _selectedPeriod = 'All Time');
                      _applyFilters();
                    }, isDarkMode),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Row(
                children: [
                  Expanded(
                    child: _summaryCard(
                      'Total Income',
                    _formatCurrency(totalIncome),
                      Icons.arrow_upward,
                      AppTheme.success,
                      isDarkMode,
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: _summaryCard(
                      'Total Expenses',
                    _formatCurrency(totalExpenses),
                      Icons.arrow_downward,
                      AppTheme.danger,
                      isDarkMode,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: _summaryCard(
                'Net Income',
                _formatCurrency(netIncome),
                Icons.account_balance_wallet,
                AppTheme.primary,
                isDarkMode,
              ),
            ),
            const SizedBox(height: 16),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: Text(
                'Transaction History',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: isDarkMode ? Colors.white : Colors.black87,
                ),
              ),
            ),
            const SizedBox(height: 8),
            Expanded(
              child: _loading
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          CircularProgressIndicator(color: AppTheme.primary),
                          const SizedBox(height: 16),
                          Text(
                            'Loading history...',
                            style: TextStyle(
                              color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                              fontSize: 14,
                            ),
                          ),
                        ],
                      ),
                    )
                  : _filteredIncomes.isEmpty
                      ? Center(
                          child: Padding(
                            padding: const EdgeInsets.all(32),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(
                                  Icons.history,
                                  size: 64,
                                  color: isDarkMode ? Colors.grey[600] : Colors.grey[400],
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  'No records for this period',
                                  style: TextStyle(
                                    fontSize: 18,
                                    fontWeight: FontWeight.w600,
                                    color: isDarkMode ? Colors.white : Colors.black87,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 8),
                                Text(
                                  'Try another filter or log income from the dashboard.',
                                  style: TextStyle(
                                    color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                    fontSize: 14,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ],
                            ),
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: _load,
                          color: AppTheme.primary,
                          child: ListView.builder(
                            controller: _scrollController,
                            padding: const EdgeInsets.all(16),
                            itemCount: _filteredIncomes.length + (_hasMore ? 1 : 0),
                            itemBuilder: (context, index) {
                              if (index >= _filteredIncomes.length) {
                                return Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 16),
                                  child: Center(
                                    child: _loadingMore
                                        ? CircularProgressIndicator(color: AppTheme.primary)
                                        : TextButton(
                                            onPressed: _loadMore,
                                            child: const Text('Load more'),
                                          ),
                                  ),
                                );
                              }
                              final income = _filteredIncomes[index];
                              final loggedOn = income['loggedOn'] ?? income['logged_on'];
                              final loggedOnDate = _formatDate(loggedOn);
                              final amount = income['income'] ?? 0;
                              final vehicle = income['vehicle'] ?? 'Unknown Vehicle';
                              return Card(
                                margin: const EdgeInsets.only(bottom: 16),
                                elevation: 2,
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(AppTheme.radius),
                                ),
                                color: isDarkMode ? AppTheme.darkSurface : Colors.white,
                                child: InkWell(
                                  borderRadius: BorderRadius.circular(AppTheme.radius),
                                  onTap: () => _showDetails(context, income),
                                  child: Padding(
                                    padding: const EdgeInsets.all(16),
                                    child: Row(
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.all(12),
                                          decoration: BoxDecoration(
                                            color: AppTheme.primary.withOpacity(0.15),
                                            shape: BoxShape.circle,
                                          ),
                                          child: const Icon(
                                            Icons.directions_car,
                                            color: AppTheme.primary,
                                            size: 24,
                                          ),
                                        ),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                vehicle.toString(),
                                                style: TextStyle(
                                                  fontSize: 16,
                                                  fontWeight: FontWeight.bold,
                                                  color: isDarkMode ? Colors.white : Colors.black87,
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                loggedOnDate,
                                                style: TextStyle(
                                                  fontSize: 14,
                                                  color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                        Text(
                                          _formatCurrency(amount),
                                          style: const TextStyle(
                                            fontSize: 16,
                                            fontWeight: FontWeight.bold,
                                            color: AppTheme.success,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              );
                            },
                          ),
                        ),
            ),
          ],
        ),
      ),
    );
  }

  String _formatDate(dynamic date) {
    if (date == null) return 'Unknown Date';
    try {
      final parsed = DateTime.parse(date.toString());
      return DateFormat('dd MMM yyyy').format(parsed);
    } catch (_) {
      return 'Unknown Date';
    }
  }

  String _formatCurrency(dynamic amount) {
    final formatter = NumberFormat.currency(symbol: 'R ', decimalDigits: 2);
    final value = double.tryParse(amount.toString()) ?? 0.0;
    return formatter.format(value);
  }

  double _calculateTotalIncome(List<Map<String, dynamic>> incomes) {
    return incomes.fold<double>(0.0, (total, income) {
      final value = double.tryParse(income['income']?.toString() ?? '0') ?? 0.0;
      return total + value;
    });
  }

  double _calculateTotalExpenses(List<Map<String, dynamic>> incomes) {
    return incomes.fold<double>(0.0, (total, income) {
      final value = double.tryParse(income['expensePrice']?.toString() ?? '0') ?? 0.0;
      return total + value;
    });
  }

  double _calculateNetIncome(List<Map<String, dynamic>> incomes) {
    return _calculateTotalIncome(incomes) - _calculateTotalExpenses(incomes);
  }

  List<Map<String, dynamic>> _filterByPeriod(
    List<Map<String, dynamic>> incomes,
    String period,
  ) {
    if (period == 'All Time') {
      return incomes;
    }
    final now = DateTime.now();
    DateTime startDate;
    switch (period) {
      case 'Today':
        startDate = DateTime(now.year, now.month, now.day);
        break;
      case 'This Week':
        startDate = now.subtract(Duration(days: now.weekday - 1));
        startDate = DateTime(startDate.year, startDate.month, startDate.day);
        break;
      case 'This Year':
        startDate = DateTime(now.year, 1, 1);
        break;
      case 'This Month':
      default:
        startDate = DateTime(now.year, now.month, 1);
        break;
    }

    return incomes.where((income) {
      final loggedOn = income['loggedOn'] ?? income['logged_on'];
      if (loggedOn == null) {
        return false;
      }
      try {
        final parsed = DateTime.parse(loggedOn.toString());
        return parsed.isAfter(startDate) || parsed.isAtSameMomentAs(startDate);
      } catch (_) {
        return false;
      }
    }).toList();
  }

  Widget _summaryCard(
    String title,
    String amount,
    IconData icon,
    Color iconColor,
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
            offset: const Offset(0, 4),
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
                  color: iconColor.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: iconColor, size: 20),
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

  void _showDetails(BuildContext context, Map<String, dynamic> income) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    showModalBottomSheet(
      context: context,
      backgroundColor: isDarkMode ? AppTheme.darkSurface : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      isScrollControlled: true,
      builder: (context) {
        final loggedOn = income['loggedOn'] ?? income['logged_on'];
        final startingKm = income['startingKm'] ?? income['starting_km'];
        final endKm = income['endKm'] ?? income['end_km'];
        final petrolPoured = income['petrolPoured'] ?? income['petrol_poured'];
        final petrolLitres = income['petrolLitres'] ?? income['petrol_litres'];
        final expenseDetail = income['expenseDetail'] ?? income['expense_detail'];
        final expenseImage = income['expenseImage'] ?? income['expense_image'];
        final petrolSlip = income['petrolSlip'] ?? income['petrol_slip'];
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: 16 + MediaQuery.of(context).viewInsets.bottom,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: isDarkMode ? Colors.grey[700] : Colors.grey[300],
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  'Income Details',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: isDarkMode ? Colors.white : Colors.black87,
                  ),
                ),
                const SizedBox(height: 12),
                _detailRow('Vehicle', income['vehicle']?.toString() ?? '—', isDarkMode),
                _detailRow('Driver', income['driverName']?.toString() ?? income['driver_name']?.toString() ?? '—', isDarkMode),
                _detailRow('Date', _formatDate(loggedOn), isDarkMode),
                _detailRow('Income', _formatCurrency(income['income'] ?? 0), isDarkMode),
                _detailRow('Starting Km', startingKm?.toString() ?? '—', isDarkMode),
                _detailRow('End Km', endKm?.toString() ?? '—', isDarkMode),
                _detailRow('Petrol Cost', petrolPoured == null ? '—' : _formatCurrency(petrolPoured), isDarkMode),
                _detailRow('Petrol Litres', petrolLitres?.toString() ?? '—', isDarkMode),
                _detailRow('Expense Detail', expenseDetail?.toString() ?? '—', isDarkMode),
                const SizedBox(height: 12),
                if (expenseImage != null) _imageBlock('Expense Receipt', expenseImage, isDarkMode),
                if (petrolSlip != null) _imageBlock('Petrol Slip', petrolSlip, isDarkMode),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _detailRow(String label, String value, bool isDarkMode) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: TextStyle(
                color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                fontSize: 13,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: isDarkMode ? Colors.white : Colors.black87,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _imageBlock(String title, String base64, bool isDarkMode) {
    final bytes = _decodeImage(base64);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              color: isDarkMode ? Colors.white : Colors.black87,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(AppTheme.radius),
            child: bytes == null
                ? Container(
                    height: 160,
                    color: isDarkMode ? Colors.black26 : Colors.grey[200],
                    child: const Center(child: Icon(Icons.broken_image)),
                  )
                : Image.memory(bytes, height: 160, width: double.infinity, fit: BoxFit.cover),
          ),
        ],
      ),
    );
  }

  Uint8List? _decodeImage(String base64) {
    try {
      final cleaned = base64.contains(',') ? base64.split(',').last : base64;
      return base64Decode(cleaned);
    } catch (_) {
      return null;
    }
  }

  Widget _buildQuickFilterChip(String label, bool selected, VoidCallback onTap, bool isDarkMode) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onTap(),
      selectedColor: AppTheme.primary.withOpacity(0.2),
      checkmarkColor: AppTheme.primary,
      labelStyle: TextStyle(
        color: selected ? AppTheme.primary : (isDarkMode ? Colors.white : Colors.black87),
        fontWeight: selected ? FontWeight.bold : FontWeight.normal,
      ),
    );
  }

  Widget _buildFilterSheet(BuildContext context, bool isDarkMode, List<String> vehicles) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Filters',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: isDarkMode ? Colors.white : Colors.black87,
            ),
          ),
          const SizedBox(height: 24),
          // Vehicle Filter
          Text(
            'Vehicle',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              border: Border.all(
                color: isDarkMode ? Colors.grey[700]! : Colors.grey[300]!,
                width: 1,
              ),
              borderRadius: BorderRadius.circular(AppTheme.radius),
              color: isDarkMode ? AppTheme.darkSurface : Colors.white,
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String?>(
                value: _selectedVehicle,
                isExpanded: true,
                hint: const Text('All Vehicles'),
                dropdownColor: isDarkMode ? AppTheme.darkSurface : Colors.white,
                style: TextStyle(
                  color: isDarkMode ? Colors.white : Colors.black87,
                  fontSize: 16,
                ),
                icon: const Icon(Icons.arrow_drop_down, color: AppTheme.primary),
                items: [
                  const DropdownMenuItem<String?>(value: null, child: Text('All Vehicles')),
                  ...vehicles.map((vehicle) {
                    return DropdownMenuItem<String?>(value: vehicle, child: Text(vehicle));
                  }),
                ],
                onChanged: (value) {
                  setState(() => _selectedVehicle = value);
                  _applyFilters();
                },
              ),
            ),
          ),
          const SizedBox(height: 24),
          // Sort By
          Text(
            'Sort By',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w500,
              color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              border: Border.all(
                color: isDarkMode ? Colors.grey[700]! : Colors.grey[300]!,
                width: 1,
              ),
              borderRadius: BorderRadius.circular(AppTheme.radius),
              color: isDarkMode ? AppTheme.darkSurface : Colors.white,
            ),
            child: DropdownButtonHideUnderline(
              child: DropdownButton<String?>(
                value: _selectedSortBy,
                isExpanded: true,
                hint: const Text('Default (Newest First)'),
                dropdownColor: isDarkMode ? AppTheme.darkSurface : Colors.white,
                style: TextStyle(
                  color: isDarkMode ? Colors.white : Colors.black87,
                  fontSize: 16,
                ),
                icon: const Icon(Icons.arrow_drop_down, color: AppTheme.primary),
                items: _sortOptions.map((option) {
                  return DropdownMenuItem<String?>(value: option, child: Text(option));
                }).toList(),
                onChanged: (value) {
                  setState(() => _selectedSortBy = value);
                  _applyFilters();
                },
              ),
            ),
          ),
          const SizedBox(height: 24),
          // Clear Filters Button
          SizedBox(
            width: double.infinity,
            child: OutlinedButton(
              onPressed: () {
                setState(() {
                  _selectedVehicle = null;
                  _selectedSortBy = null;
                  _selectedPeriod = 'This Month';
                  _searchController.clear();
                });
                _applyFilters();
                Navigator.pop(context);
              },
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppTheme.radius),
                ),
              ),
              child: const Text('Clear All Filters'),
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }
}

