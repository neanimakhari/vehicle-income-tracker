import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../services/offline_queue.dart';
import '../theme.dart';
import '../utils/app_toast.dart';
import '../widgets/sidebar.dart';
import '../widgets/confirmation_dialog.dart';

class IncomeLogScreen extends StatefulWidget {
  const IncomeLogScreen({super.key, this.onBack, this.openDrawer});

  final VoidCallback? onBack;
  final VoidCallback? openDrawer;

  @override
  State<IncomeLogScreen> createState() => _IncomeLogScreenState();
}

class _IncomeLogScreenState extends State<IncomeLogScreen> {
  final _formKey = GlobalKey<FormState>();
  String? _selectedVehicleId;
  List<Map<String, dynamic>> _vehicles = [];
  bool _vehiclesLoading = true;
  final _driverController = TextEditingController();
  final _incomeController = TextEditingController();
  final _startingKmController = TextEditingController();
  final _endKmController = TextEditingController();
  final _petrolCostController = TextEditingController();
  final _petrolLitresController = TextEditingController();
  final _expenseDetailController = TextEditingController();
  final _expenseAmountController = TextEditingController();
  String? _expenseImageBase64;
  String? _petrolSlipBase64;
  final _api = ApiService();
  bool _submitting = false;
  bool _showExpenseFields = false;
  bool _isLateIncome = false;
  DateTime _incomeDate = DateTime.now();
  int? _lastEndKm;
  String? _lastLoggedOn;

  @override
  void dispose() {
    _startingKmController.removeListener(_onKmChanged);
    _endKmController.removeListener(_onKmChanged);
    _driverController.dispose();
    _incomeController.dispose();
    _startingKmController.dispose();
    _endKmController.dispose();
    _petrolCostController.dispose();
    _petrolLitresController.dispose();
    _expenseDetailController.dispose();
    _expenseAmountController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    _loadVehicles();
    if (Session.userId != null) {
      _loadDriverName();
    }
    _startingKmController.addListener(_onKmChanged);
    _endKmController.addListener(_onKmChanged);
  }

  void _onKmChanged() {
    if (mounted) setState(() {});
  }

  String _formatLastLoggedOn(String iso) {
    final d = DateTime.tryParse(iso);
    if (d != null) return '${d.day}/${d.month}/${d.year}';
    return iso.length >= 10 ? iso.substring(0, 10) : iso;
  }

  Future<void> _loadDriverName() async {
    try {
      final profile = await _api.fetchDriverProfile();
      if (mounted) {
        final firstName = profile['firstName'] ?? '';
        final lastName = profile['lastName'] ?? '';
        _driverController.text = '$firstName $lastName'.trim();
      }
    } catch (_) {
      // If profile fetch fails, use email as fallback
      if (mounted && Session.email != null) {
        _driverController.text = Session.email!;
      }
    }
  }

  Future<void> _loadVehicles() async {
    setState(() => _vehiclesLoading = true);
    try {
      final data = await _api.fetchVehicles();
      if (!mounted) return;
      final activeVehicles = data.where((vehicle) => vehicle['isActive'] == true).toList();
      setState(() {
        _vehicles = activeVehicles;
        if (_selectedVehicleId == null && activeVehicles.isNotEmpty) {
          _selectedVehicleId = activeVehicles.first['id']?.toString();
        }
      });
      if (_selectedVehicleId != null) _loadLastOdometer();
    } catch (_) {
      if (!mounted) return;
      setState(() => _vehicles = []);
    } finally {
      if (mounted) setState(() => _vehiclesLoading = false);
    }
  }

  String get _selectedVehicleLabel {
    if (_selectedVehicleId == null || _vehicles.isEmpty) return '';
    try {
      final v = _vehicles.firstWhere(
        (e) => e['id']?.toString() == _selectedVehicleId,
        orElse: () => <String, dynamic>{},
      );
      return v['label']?.toString() ?? '';
    } catch (_) {
      return '';
    }
  }

  Future<void> _loadLastOdometer() async {
    final label = _selectedVehicleLabel;
    if (label.isEmpty) return;
    try {
      final data = await _api.fetchLastOdometer(label);
      if (!mounted) return;
      setState(() {
        _lastEndKm = data['lastEndKm'] is int ? data['lastEndKm'] as int : null;
        _lastLoggedOn = data['lastLoggedOn']?.toString();
        if (_lastEndKm != null && _startingKmController.text.trim().isEmpty) {
          _startingKmController.text = _lastEndKm.toString();
        }
      });
    } catch (_) {
      if (mounted) setState(() { _lastEndKm = null; _lastLoggedOn = null; });
    }
  }

  Future<void> _pickImage({required bool isExpenseImage}) async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 60,
      maxWidth: 800,
      maxHeight: 800,
    );
    if (image == null) return;
    final bytes = await image.readAsBytes();
    final base64Image = base64Encode(bytes);
    setState(() {
      if (isExpenseImage) {
        _expenseImageBase64 = base64Image;
      } else {
        _petrolSlipBase64 = base64Image;
      }
    });
    await _applyOcrHints(image.path, isExpenseImage: isExpenseImage);
  }

  void _removeImage({required bool isExpenseImage}) {
    setState(() {
      if (isExpenseImage) {
        _expenseImageBase64 = null;
      } else {
        _petrolSlipBase64 = null;
      }
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    final startingKm = _startingKmController.text.trim().isEmpty
        ? null
        : int.tryParse(_startingKmController.text.trim());
    final endKm = _endKmController.text.trim().isEmpty
        ? null
        : int.tryParse(_endKmController.text.trim());
    if (_lastEndKm != null && endKm != null && endKm < _lastEndKm!) {
      AppToast.error(context, 'End KM cannot be less than the last recorded end KM for this vehicle ($_lastEndKm).');
      return;
    }
    if (startingKm != null && endKm != null && endKm < startingKm) {
      AppToast.error(context, 'End KM cannot be less than starting KM.');
      return;
    }

    // Show confirmation dialog before submitting
    final confirmed = await ConfirmationDialog.show(
      context: context,
      title: 'Submit Income Log',
      message: 'Are you sure you want to submit this income log? Please verify all information is correct.',
      confirmText: 'Submit',
      cancelText: 'Cancel',
    );

    if (confirmed != true) {
      return;
    }

    final loggedOn = _isLateIncome
        ? DateTime.utc(_incomeDate.year, _incomeDate.month, _incomeDate.day).toIso8601String()
        : DateTime.now().toIso8601String();

    setState(() => _submitting = true);
    try {
      final expensePrice = _expenseAmountController.text.trim().isEmpty
          ? null
          : double.parse(_expenseAmountController.text.trim());
      final petrolPoured = _petrolCostController.text.trim().isEmpty
          ? null
          : double.tryParse(_petrolCostController.text.trim());
      final petrolLitres = _petrolLitresController.text.trim().isEmpty
          ? null
          : double.tryParse(_petrolLitresController.text.trim());
      final result = await _api.createIncome({
        'vehicle': _vehicles
                .firstWhere(
                  (vehicle) => vehicle['id']?.toString() == _selectedVehicleId,
                  orElse: () => <String, dynamic>{},
                )['label']
                ?.toString() ??
            '',
        'driverName': _driverController.text.trim(),
        'income': double.parse(_incomeController.text.trim()),
        'startingKm': startingKm,
        'endKm': endKm,
        'petrolPoured': petrolPoured,
        'petrolLitres': petrolLitres,
        'expenseDetail': _expenseDetailController.text.trim().isEmpty
            ? null
            : _expenseDetailController.text.trim(),
        'expensePrice': expensePrice,
        'expenseImage': _expenseImageBase64,
        'petrolSlip': _petrolSlipBase64,
        'loggedOn': loggedOn,
      });
      if (!mounted) return;
      final status = result['approvalStatus'] ?? result['approval_status'];
      if (status == 'pending') {
        AppToast.success(context, 'Income saved. It is pending admin approval.');
      } else {
        AppToast.success(context, 'Income logged successfully');
      }
      _formKey.currentState!.reset();
      if (_vehicles.isNotEmpty) {
        _selectedVehicleId = _vehicles.first['id']?.toString();
      } else {
        _selectedVehicleId = null;
      }
      _driverController.clear();
      _incomeController.clear();
      _startingKmController.clear();
      _endKmController.clear();
      _petrolCostController.clear();
      _petrolLitresController.clear();
      _expenseDetailController.clear();
      _expenseAmountController.clear();
      _expenseImageBase64 = null;
      _petrolSlipBase64 = null;
    } catch (e) {
      final isNetworkError = _isNetworkError(e);
      if (isNetworkError) {
        await OfflineQueue.enqueueIncome({
          'vehicle': _vehicles
                  .firstWhere(
                    (vehicle) => vehicle['id']?.toString() == _selectedVehicleId,
                    orElse: () => <String, dynamic>{},
                  )['label']
                  ?.toString() ??
              '',
          'driverName': _driverController.text.trim(),
          'income': double.parse(_incomeController.text.trim()),
          'startingKm': _startingKmController.text.trim().isEmpty
              ? null
              : int.tryParse(_startingKmController.text.trim()),
          'endKm': _endKmController.text.trim().isEmpty
              ? null
              : int.tryParse(_endKmController.text.trim()),
          'petrolPoured': _petrolCostController.text.trim().isEmpty
              ? null
              : double.tryParse(_petrolCostController.text.trim()),
          'petrolLitres': _petrolLitresController.text.trim().isEmpty
              ? null
              : double.tryParse(_petrolLitresController.text.trim()),
          'expenseDetail': _expenseDetailController.text.trim().isEmpty
              ? null
              : _expenseDetailController.text.trim(),
          'expensePrice': _expenseAmountController.text.trim().isEmpty
              ? null
              : double.tryParse(_expenseAmountController.text.trim()),
          'expenseImage': _expenseImageBase64,
          'petrolSlip': _petrolSlipBase64,
          'loggedOn': loggedOn,
        });
        if (!mounted) return;
        AppToast.info(context, 'Saved offline. Will sync when online.');
        return;
      }
      if (!mounted) return;
      AppToast.error(context, 'Failed to log income', e);
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  bool _isNetworkError(Object error) {
    final message = error.toString();
    return message.contains('SocketException') ||
        message.contains('ClientException') ||
        message.contains('Connection') ||
        message.contains('Network');
  }

  Future<void> _applyOcrHints(String path, {required bool isExpenseImage}) async {
    final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
    try {
      final input = InputImage.fromFilePath(path);
      final result = await recognizer.processImage(input);
      final text = result.text;
      if (text.isEmpty) {
        return;
      }
      if (isExpenseImage) {
        final amount = _extractAmount(text);
        if (amount != null && _expenseAmountController.text.trim().isEmpty) {
          _expenseAmountController.text = amount.toStringAsFixed(2);
        }
        if (_expenseDetailController.text.trim().isEmpty) {
          _expenseDetailController.text = _extractVendor(text) ?? 'Receipt';
        }
      } else {
        final amount = _extractAmount(text);
        final litres = _extractLitres(text);
        if (amount != null && _petrolCostController.text.trim().isEmpty) {
          _petrolCostController.text = amount.toStringAsFixed(2);
        }
        if (litres != null && _petrolLitresController.text.trim().isEmpty) {
          _petrolLitresController.text = litres.toStringAsFixed(2);
        }
      }
      if (mounted) {
        setState(() {});
      }
    } catch (_) {
      // OCR is best-effort; ignore failures.
    } finally {
      await recognizer.close();
    }
  }

  double? _extractAmount(String text) {
    final regex = RegExp(r'(R|ZAR)?\s?(\d+[.,]\d{2})');
    final matches = regex.allMatches(text).toList();
    if (matches.isEmpty) return null;
    double? maxValue;
    for (final match in matches) {
      final raw = match.group(2)?.replaceAll(',', '.');
      final value = double.tryParse(raw ?? '');
      if (value != null && (maxValue == null || value > maxValue)) {
        maxValue = value;
      }
    }
    return maxValue;
  }

  double? _extractLitres(String text) {
    final regex = RegExp(r'(\d+[.,]\d{1,2})\s?(L|l)');
    final match = regex.firstMatch(text);
    if (match == null) return null;
    final raw = match.group(1)?.replaceAll(',', '.');
    return double.tryParse(raw ?? '');
  }

  String? _extractVendor(String text) {
    final lines = text.split('\n').where((line) => line.trim().isNotEmpty).toList();
    if (lines.isEmpty) return null;
    return lines.first.trim();
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      drawer: AppSidebar(
        onSelect: (index) {
          Navigator.pop(context);
        },
      ),
      appBar: AppBar(
        title: const Text('Log Income'),
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
      ),
      backgroundColor: isDarkMode ? AppTheme.darkBackground : Colors.white,
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            final prevLen = _vehicles.length;
            await _loadVehicles();
            if (!mounted) return;
            if (_vehicles.length != prevLen) {
              AppToast.success(context, 'Data updated');
            }
          },
          child: Form(
            key: _formKey,
            child: SingleChildScrollView(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppTheme.primary,
                      borderRadius: BorderRadius.circular(AppTheme.radius),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.1),
                          blurRadius: 10,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Column(
                      children: [
                        const Icon(Icons.directions_car, color: Colors.white, size: 48),
                        const SizedBox(height: 16),
                        const Text(
                          'Vehicle Income Log',
                          style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          'Record your daily vehicle income and expenses',
                          style: TextStyle(
                            fontSize: 16,
                            color: Colors.white.withOpacity(0.9),
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 24),
                  _sectionCard(
                    title: 'Driver Information',
                    isDarkMode: isDarkMode,
                    children: [
                      _readOnlyField(
                        controller: _driverController,
                        label: 'Driver Name',
                        icon: Icons.person,
                      ),
                      const SizedBox(height: 16),
                      _vehicleDropdown(isDarkMode),
                    ],
                  ),
                  const SizedBox(height: 24),
                  _sectionCard(
                    title: 'Trip Details',
                    isDarkMode: isDarkMode,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              'Log for a past date (late income)',
                              style: TextStyle(
                                fontSize: 14,
                                color: isDarkMode ? Colors.grey[300] : Colors.black87,
                              ),
                            ),
                          ),
                          Switch(
                            value: _isLateIncome,
                            onChanged: (v) => setState(() {
                              _isLateIncome = v;
                              if (v && _incomeDate.isAfter(DateTime.now())) {
                                _incomeDate = DateTime(DateTime.now().year, DateTime.now().month, DateTime.now().day - 1);
                              }
                            }),
                            activeColor: AppTheme.primary,
                          ),
                        ],
                      ),
                      if (_isLateIncome) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: Colors.amber.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: Colors.amber.shade700, width: 1),
                          ),
                          child: Row(
                            children: [
                              Icon(Icons.info_outline, size: 20, color: Colors.amber.shade800),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'This income is for a past date and will require admin approval before it is fully recorded.',
                                  style: TextStyle(fontSize: 12, color: Colors.amber.shade900),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        InkWell(
                          onTap: () async {
                            final picked = await showDatePicker(
                              context: context,
                              initialDate: _incomeDate.isBefore(DateTime.now()) ? _incomeDate : DateTime.now().subtract(const Duration(days: 1)),
                              firstDate: DateTime(2020),
                              lastDate: DateTime.now(),
                            );
                            if (picked != null && mounted) setState(() => _incomeDate = picked);
                          },
                          borderRadius: BorderRadius.circular(AppTheme.radius),
                          child: InputDecorator(
                            decoration: InputDecoration(
                              labelText: 'Income date',
                              prefixIcon: const Icon(Icons.calendar_today),
                              filled: true,
                              fillColor: isDarkMode ? AppTheme.darkSurface : Colors.white,
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(AppTheme.radius)),
                            ),
                            child: Text(
                              '${_incomeDate.day}/${_incomeDate.month}/${_incomeDate.year}',
                              style: TextStyle(fontSize: 16, color: isDarkMode ? Colors.white : Colors.black87),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                      _textField(
                        controller: _startingKmController,
                        label: "Starting Km's",
                        icon: Icons.play_circle_outline,
                        keyboardType: TextInputType.number,
                      ),
                      if (_lastEndKm != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 4),
                          child: Text(
                            _lastLoggedOn != null
                                ? 'Last recorded end KM: $_lastEndKm on ${_formatLastLoggedOn(_lastLoggedOn!)}'
                                : 'Last recorded end KM for this vehicle: $_lastEndKm',
                            style: TextStyle(fontSize: 11, color: Colors.grey[600]),
                          ),
                        ),
                      const SizedBox(height: 16),
                      _textField(
                        controller: _endKmController,
                        label: "End Km's",
                        icon: Icons.stop_circle_outlined,
                        keyboardType: TextInputType.number,
                      ),
                      if (_startingKmController.text.trim().isNotEmpty && _endKmController.text.trim().isNotEmpty) ...[
                        Builder(
                          builder: (context) {
                            final s = int.tryParse(_startingKmController.text.trim());
                            final e = int.tryParse(_endKmController.text.trim());
                            if (s == null || e == null) return const SizedBox.shrink();
                            final dist = e - s;
                            return Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                'Distance: $dist km',
                                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: isDarkMode ? Colors.grey[400] : Colors.black54),
                              ),
                            );
                          },
                        ),
                      ],
                      const SizedBox(height: 16),
                      _textField(
                        controller: _incomeController,
                        label: 'Income Amount (R)',
                        icon: Icons.attach_money,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        validator: (value) => value == null || value.isEmpty ? 'Income required' : null,
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  _sectionCard(
                    title: 'Petrol Details',
                    isDarkMode: isDarkMode,
                    children: [
                      _textField(
                        controller: _petrolCostController,
                        label: 'Petrol Cost (R)',
                        icon: Icons.local_gas_station,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        validator: (_) => null,
                      ),
                      const SizedBox(height: 16),
                      _textField(
                        controller: _petrolLitresController,
                        label: 'Petrol Quantity (Liters)',
                        icon: Icons.opacity,
                        keyboardType: const TextInputType.numberWithOptions(decimal: true),
                        validator: (_) => null,
                      ),
                      const SizedBox(height: 16),
                      _imagePickerWithPreview(
                        base64: _petrolSlipBase64,
                        label: 'Petrol Slip',
                        icon: Icons.receipt,
                        onPick: () => _pickImage(isExpenseImage: false),
                        onRemove: () => _removeImage(isExpenseImage: false),
                        isDarkMode: isDarkMode,
                      ),
                    ],
                  ),
                  const SizedBox(height: 24),
                  _sectionCard(
                    title: 'Additional Expenses',
                    isDarkMode: isDarkMode,
                    trailing: IconButton(
                      icon: Icon(
                        _showExpenseFields ? Icons.expand_less : Icons.expand_more,
                        color: AppTheme.primary,
                      ),
                      onPressed: () {
                        setState(() => _showExpenseFields = !_showExpenseFields);
                      },
                    ),
                    children: _showExpenseFields
                        ? [
                            _textField(
                              controller: _expenseDetailController,
                              label: 'Expense Description',
                              icon: Icons.description,
                              validator: (_) => null,
                            ),
                            const SizedBox(height: 16),
                            _textField(
                              controller: _expenseAmountController,
                              label: 'Expense Amount (R)',
                              icon: Icons.money_off,
                              keyboardType: const TextInputType.numberWithOptions(decimal: true),
                              validator: (_) => null,
                            ),
                            const SizedBox(height: 16),
                            _imagePickerWithPreview(
                              base64: _expenseImageBase64,
                              label: 'Expense Receipt',
                              icon: Icons.receipt_long,
                              onPick: () => _pickImage(isExpenseImage: true),
                              onRemove: () => _removeImage(isExpenseImage: true),
                              isDarkMode: isDarkMode,
                            ),
                          ]
                        : [],
                  ),
                  const SizedBox(height: 32),
                  SizedBox(
                    height: 56,
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _submitting ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppTheme.radius),
                        ),
                        elevation: 2,
                      ),
                      child: _submitting
                          ? const CircularProgressIndicator(color: Colors.white)
                          : const Text(
                              'SUBMIT',
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ),
        ),
      ),
    );
  }

  String _vehicleDisplayLabel(Map<String, dynamic> vehicle) {
    final label = vehicle['label']?.toString() ?? 'Vehicle';
    final reg = vehicle['registrationNumber']?.toString();
    return (reg == null || reg.isEmpty) ? label : '$label • $reg';
  }

  Future<void> _showVehicleSearchPicker(bool isDarkMode, {void Function(String id)? onSelected}) async {
    final searchController = TextEditingController();
    List<Map<String, dynamic>> filtered = List.from(_vehicles);
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            final query = searchController.text.toLowerCase().trim();
            if (query.isNotEmpty) {
              filtered = _vehicles.where((v) {
                final label = (v['label']?.toString() ?? '').toLowerCase();
                final reg = (v['registrationNumber']?.toString() ?? '').toLowerCase();
                return label.contains(query) || reg.contains(query);
              }).toList();
            } else {
              filtered = List.from(_vehicles);
            }
            return DraggableScrollableSheet(
              initialChildSize: 0.6,
              minChildSize: 0.3,
              maxChildSize: 0.9,
              builder: (_, scrollController) => Container(
                decoration: BoxDecoration(
                  color: isDarkMode ? AppTheme.darkSurface : Colors.white,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
                ),
                child: Column(
                  children: [
                    const SizedBox(height: 12),
                    Text(
                      'Choose vehicle',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.w600,
                        color: isDarkMode ? Colors.white : Colors.black87,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.all(16),
                      child: TextField(
                        controller: searchController,
                        onChanged: (_) => setModalState(() {}),
                        style: TextStyle(color: isDarkMode ? Colors.white : Colors.black87),
                        decoration: InputDecoration(
                          hintText: 'Search by name or registration...',
                          hintStyle: TextStyle(color: isDarkMode ? Colors.grey[500] : Colors.grey[600]),
                          prefixIcon: Icon(Icons.search, color: isDarkMode ? Colors.grey[400] : Colors.grey[600]),
                          filled: true,
                          fillColor: isDarkMode ? AppTheme.darkBackground : Colors.grey.shade100,
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(AppTheme.radius),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: filtered.isEmpty
                          ? Center(
                              child: Text(
                                query.isEmpty ? 'No vehicles' : 'No matches',
                                style: TextStyle(color: isDarkMode ? Colors.grey[400] : Colors.grey[600]),
                              ),
                            )
                          : ListView.builder(
                              controller: scrollController,
                              itemCount: filtered.length,
                              itemBuilder: (_, i) {
                                final v = filtered[i];
                                final id = v['id']?.toString() ?? '';
                                final isSelected = _selectedVehicleId == id;
                                return ListTile(
                                  leading: Icon(
                                    Icons.directions_car,
                                    color: isSelected ? AppTheme.primary : (isDarkMode ? Colors.grey[400] : Colors.grey[600]),
                                  ),
                                  title: Text(
                                    _vehicleDisplayLabel(v),
                                    style: TextStyle(
                                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                                      color: isDarkMode ? Colors.white : Colors.black87,
                                    ),
                                  ),
                                  onTap: () {
                                    setState(() => _selectedVehicleId = id);
                                    onSelected?.call(id);
                                    Navigator.pop(ctx);
                                  },
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
            );
          },
        );
      },
    );
    searchController.dispose();
  }

  Widget _vehicleDropdown(bool isDarkMode) {
    if (_vehiclesLoading) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(
            color: isDarkMode ? Colors.grey[700]! : Colors.grey[300]!,
            width: 1,
          ),
          borderRadius: BorderRadius.circular(AppTheme.radius),
          color: isDarkMode ? AppTheme.darkSurface : Colors.white,
        ),
        child: Row(
          children: [
            const SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            const SizedBox(width: 12),
            Text(
              'Loading vehicles...',
              style: TextStyle(
                color: isDarkMode ? Colors.white70 : Colors.black54,
                fontSize: 14,
              ),
            ),
          ],
        ),
      );
    }

    if (_vehicles.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 14),
        decoration: BoxDecoration(
          border: Border.all(
            color: isDarkMode ? Colors.grey[700]! : Colors.grey[300]!,
            width: 1,
          ),
          borderRadius: BorderRadius.circular(AppTheme.radius),
          color: isDarkMode ? AppTheme.darkSurface : Colors.white,
        ),
        child: Text(
          'No vehicles available. Ask your admin to add vehicles.',
          style: TextStyle(
            color: isDarkMode ? Colors.white70 : Colors.black54,
            fontSize: 14,
          ),
        ),
      );
    }

    final selectedVehicle = _vehicles.cast<Map<String, dynamic>?>().firstWhere(
          (v) => v!['id']?.toString() == _selectedVehicleId,
          orElse: () => null,
        );
    final displayText = selectedVehicle != null
        ? _vehicleDisplayLabel(selectedVehicle)
        : 'Tap to choose vehicle';

    return FormField<String>(
      initialValue: _selectedVehicleId,
      validator: (value) => value == null || value.isEmpty ? 'Vehicle required' : null,
      builder: (fieldState) {
        return InkWell(
          onTap: () =>           _showVehicleSearchPicker(isDarkMode, onSelected: (id) {
            fieldState.didChange(id);
            setState(() => _selectedVehicleId = id);
            _loadLastOdometer();
          }),
          borderRadius: BorderRadius.circular(AppTheme.radius),
          child: InputDecorator(
            decoration: InputDecoration(
              labelText: 'Vehicle',
              prefixIcon: const Icon(Icons.directions_car),
              suffixIcon: const Icon(Icons.search),
              filled: true,
              fillColor: isDarkMode ? AppTheme.darkSurface : Colors.white,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppTheme.radius),
                borderSide: BorderSide(color: isDarkMode ? AppTheme.darkBorder : Colors.grey[300]!),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppTheme.radius),
                borderSide: BorderSide(color: isDarkMode ? AppTheme.darkBorder : Colors.grey[300]!),
              ),
              errorText: fieldState.errorText,
            ),
            child: Text(
              displayText,
              style: TextStyle(
                color: isDarkMode ? Colors.white : Colors.black87,
                fontSize: 16,
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _sectionCard({
    required String title,
    required bool isDarkMode,
    required List<Widget> children,
    Widget? trailing,
  }) {
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
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppTheme.primary,
                ),
              ),
              if (trailing != null) trailing,
            ],
          ),
          if (children.isNotEmpty) const SizedBox(height: 16),
          ...children,
        ],
      ),
    );
  }

  Widget _textField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
    TextInputType keyboardType = TextInputType.text,
    String? Function(String?)? validator,
  }) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      validator: validator ??
          (value) {
            if (value == null || value.isEmpty) {
              return 'Please enter $label';
            }
            return null;
          },
      style: TextStyle(
        color: isDarkMode ? Colors.white : Colors.black87,
      ),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(
          color: isDarkMode ? Colors.grey[400] : AppTheme.primary.withOpacity(0.7),
        ),
        prefixIcon: Icon(icon, color: AppTheme.primary),
      ),
    );
  }

  Widget _readOnlyField({
    required TextEditingController controller,
    required String label,
    required IconData icon,
  }) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return TextFormField(
      controller: controller,
      readOnly: true,
      enabled: false,
      style: TextStyle(
        color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
      ),
      decoration: InputDecoration(
        labelText: label,
        labelStyle: TextStyle(
          color: isDarkMode ? Colors.grey[500] : Colors.grey[500],
        ),
        prefixIcon: Icon(icon, color: AppTheme.primary.withOpacity(0.6)),
        filled: true,
        fillColor: isDarkMode ? AppTheme.darkSurface : Colors.grey[100],
      ),
    );
  }

  Widget _imagePickerWithPreview({
    required String? base64,
    required String label,
    required IconData icon,
    required VoidCallback onPick,
    required VoidCallback onRemove,
    required bool isDarkMode,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppTheme.radius),
        border: Border.all(
          color: isDarkMode ? Colors.grey[700]! : Colors.grey[300]!,
        ),
        color: isDarkMode ? AppTheme.darkSurface : Colors.white,
      ),
      child: base64 == null || base64.isEmpty
          ? InkWell(
              onTap: onPick,
              borderRadius: BorderRadius.circular(AppTheme.radius),
              child: Row(
                children: [
                  Icon(icon, color: AppTheme.primary),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      'Upload $label',
                      style: TextStyle(
                        color: isDarkMode ? Colors.white : Colors.black87,
                      ),
                    ),
                  ),
                  const Icon(Icons.arrow_forward_ios, size: 14, color: AppTheme.primary),
                ],
              ),
            )
          : Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.memory(
                    _base64ToBytes(base64),
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(
                      width: 72,
                      height: 72,
                      color: Colors.grey[300],
                      child: Icon(icon, color: Colors.grey[600]),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '$label selected',
                        style: TextStyle(
                          fontWeight: FontWeight.w600,
                          color: isDarkMode ? Colors.white : Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          TextButton.icon(
                            onPressed: onPick,
                            icon: const Icon(Icons.refresh, size: 16),
                            label: const Text('Change'),
                            style: TextButton.styleFrom(
                              foregroundColor: AppTheme.primary,
                              padding: EdgeInsets.zero,
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          ),
                          const SizedBox(width: 8),
                          TextButton.icon(
                            onPressed: onRemove,
                            icon: const Icon(Icons.delete_outline, size: 16),
                            label: const Text('Remove'),
                            style: TextButton.styleFrom(
                              foregroundColor: Colors.red,
                              padding: EdgeInsets.zero,
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
    );
  }

  Uint8List _base64ToBytes(String base64) {
    try {
      final cleaned = base64.contains(',') ? base64.split(',').last : base64;
      return base64Decode(cleaned);
    } catch (_) {
      return Uint8List(0);
    }
  }
}

