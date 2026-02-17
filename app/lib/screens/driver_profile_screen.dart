import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../theme.dart';
import '../config.dart';
import '../utils/app_toast.dart';
import '../widgets/confirmation_dialog.dart';

/// Format profile date for API (yyyy-MM-dd). Returns null if empty or invalid.
String? _toApiDate(String? value) {
  if (value == null || value.trim().isEmpty) return null;
  final trimmed = value.trim();
  // Already yyyy-MM-dd
  if (RegExp(r'^\d{4}-\d{2}-\d{2}$').hasMatch(trimmed)) return trimmed;
  // Try parsing dd/MM/yyyy
  final parts = trimmed.split(RegExp(r'[/\-.]'));
  if (parts.length >= 3) {
    int? d, m, y;
    if (parts[0].length == 4) {
      y = int.tryParse(parts[0]);
      m = int.tryParse(parts[1]);
      d = int.tryParse(parts[2]);
    } else {
      d = int.tryParse(parts[0]);
      m = int.tryParse(parts[1]);
      y = int.tryParse(parts[2]);
    }
    if (d != null && m != null && y != null && y > 1900 && y < 2100) {
      return '${y.toString().padLeft(4, '0')}-${m.toString().padLeft(2, '0')}-${d.toString().padLeft(2, '0')}';
    }
  }
  return null;
}

enum DocumentType {
  idDocument('id_document', 'ID Document'),
  passport('passport', 'Passport'),
  driversLicense('drivers_license', 'Driver\'s License'),
  prdpCertificate('prdp_certificate', 'PRDP Certificate'),
  medicalCertificate('medical_certificate', 'Medical Certificate'),
  bankStatement('bank_statement', 'Bank Statement'),
  proofOfAddress('proof_of_address', 'Proof of Address'),
  other('other', 'Other');

  final String value;
  final String label;
  const DocumentType(this.value, this.label);
}

class DriverProfileScreen extends StatefulWidget {
  const DriverProfileScreen({super.key});

  @override
  State<DriverProfileScreen> createState() => _DriverProfileScreenState();
}

class _DriverProfileScreenState extends State<DriverProfileScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _profile;
  List<Map<String, dynamic>> _documents = [];
  bool _loading = true;
  bool _uploading = false;
  bool _isEditing = false;
  bool _saving = false;
  bool _submittingExpiry = false;

  // Editable fields (everything except Personal Information: name, email, phone, DOB, ID, passport, address)
  final _licenseNumber = TextEditingController();
  final _licenseExpiry = TextEditingController();
  final _prdpNumber = TextEditingController();
  final _prdpExpiry = TextEditingController();
  final _medicalCertificateExpiry = TextEditingController();
  final _bankName = TextEditingController();
  final _bankAccountNumber = TextEditingController();
  final _bankBranchCode = TextEditingController();
  final _accountHolderName = TextEditingController();
  final _emergencyContactName = TextEditingController();
  final _emergencyContactPhone = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadProfile();
    _loadDocuments();
  }

  @override
  void dispose() {
    _licenseNumber.dispose();
    _licenseExpiry.dispose();
    _prdpNumber.dispose();
    _prdpExpiry.dispose();
    _medicalCertificateExpiry.dispose();
    _bankName.dispose();
    _bankAccountNumber.dispose();
    _bankBranchCode.dispose();
    _accountHolderName.dispose();
    _emergencyContactName.dispose();
    _emergencyContactPhone.dispose();
    super.dispose();
  }

  void _populateEditableControllers() {
    final p = _profile;
    if (p == null) return;
    _licenseNumber.text = p['licenseNumber']?.toString() ?? '';
    _licenseExpiry.text = _profileDateToDisplay(p['licenseExpiry']);
    _prdpNumber.text = p['prdpNumber']?.toString() ?? '';
    _prdpExpiry.text = _profileDateToDisplay(p['prdpExpiry']);
    _medicalCertificateExpiry.text = _profileDateToDisplay(p['medicalCertificateExpiry']);
    _bankName.text = p['bankName']?.toString() ?? '';
    _bankAccountNumber.text = p['bankAccountNumber']?.toString() ?? '';
    _bankBranchCode.text = p['bankBranchCode']?.toString() ?? '';
    _accountHolderName.text = p['accountHolderName']?.toString() ?? '';
    _emergencyContactName.text = p['emergencyContactName']?.toString() ?? '';
    _emergencyContactPhone.text = p['emergencyContactPhone']?.toString() ?? '';
  }

  String _profileDateToDisplay(dynamic value) {
    if (value == null) return '';
    if (value is String && value.isEmpty) return '';
    try {
      final d = DateTime.parse(value.toString());
      return '${d.day.toString().padLeft(2, '0')}/${d.month.toString().padLeft(2, '0')}/${d.year}';
    } catch (_) {
      return value.toString();
    }
  }

  Future<void> _pickDate(BuildContext context, TextEditingController controller) async {
    DateTime initial = DateTime.now();
    try {
      final existing = controller.text.trim();
      if (existing.isNotEmpty) {
        final api = _toApiDate(existing);
        if (api != null) initial = DateTime.parse(api);
      }
    } catch (_) {}
    final picked = await showDatePicker(
      context: context,
      initialDate: initial,
      firstDate: DateTime(1900),
      lastDate: DateTime(2100),
    );
    if (picked != null && mounted) {
      controller.text = _profileDateToDisplay(picked.toIso8601String());
    }
  }

  Future<void> _saveProfile() async {
    setState(() => _saving = true);
    try {
      final payload = <String, dynamic>{
        'licenseNumber': _licenseNumber.text.trim().isEmpty ? null : _licenseNumber.text.trim(),
        'licenseExpiry': _toApiDate(_licenseExpiry.text),
        'prdpNumber': _prdpNumber.text.trim().isEmpty ? null : _prdpNumber.text.trim(),
        'prdpExpiry': _toApiDate(_prdpExpiry.text),
        'medicalCertificateExpiry': _toApiDate(_medicalCertificateExpiry.text),
        'bankName': _bankName.text.trim().isEmpty ? null : _bankName.text.trim(),
        'bankAccountNumber': _bankAccountNumber.text.trim().isEmpty ? null : _bankAccountNumber.text.trim(),
        'bankBranchCode': _bankBranchCode.text.trim().isEmpty ? null : _bankBranchCode.text.trim(),
        'accountHolderName': _accountHolderName.text.trim().isEmpty ? null : _accountHolderName.text.trim(),
        'emergencyContactName': _emergencyContactName.text.trim().isEmpty ? null : _emergencyContactName.text.trim(),
        'emergencyContactPhone': _emergencyContactPhone.text.trim().isEmpty ? null : _emergencyContactPhone.text.trim(),
      };
      await _api.updateDriverProfile(payload);
      if (!mounted) return;
      AppToast.success(context, 'Profile updated');
      setState(() => _isEditing = false);
      await _loadProfile();
    } catch (e) {
      if (mounted) AppToast.error(context, 'Failed to update profile', e);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _loadProfile() async {
    setState(() => _loading = true);
    try {
      final profile = await _api.fetchDriverProfile();
      if (mounted) {
        setState(() => _profile = profile);
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(context, 'Failed to load profile', e);
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _loadDocuments() async {
    try {
      final documents = await _api.fetchDriverDocuments();
      if (mounted) {
        setState(() => _documents = documents);
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(context, 'Failed to load documents', e);
      }
    }
  }

  bool get _hasAnyExpiryEntered =>
      (_licenseExpiry.text.trim().isNotEmpty) ||
      (_prdpExpiry.text.trim().isNotEmpty) ||
      (_medicalCertificateExpiry.text.trim().isNotEmpty);

  Future<void> _showSubmitExpiryDialog(bool isDarkMode) async {
    if (_documents.isEmpty) {
      AppToast.error(context, 'Upload at least one document first to use as supporting evidence.');
      return;
    }
    final selectedIds = <String>[];
    final result = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setDialogState) {
            return AlertDialog(
              title: const Text('Supporting documents'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Select at least one document for the admin to review. These will be attached to your expiry update request.',
                      style: TextStyle(fontSize: 14),
                    ),
                    const SizedBox(height: 16),
                    ..._documents.map((doc) {
                      final id = doc['id']?.toString() ?? '';
                      final type = doc['documentType']?.toString() ?? 'Document';
                      final selected = selectedIds.contains(id);
                      return CheckboxListTile(
                        value: selected,
                        onChanged: (v) {
                          setDialogState(() {
                            if (v == true) {
                              selectedIds.add(id);
                            } else {
                              selectedIds.remove(id);
                            }
                          });
                        },
                        title: Text(type, style: const TextStyle(fontSize: 14)),
                      );
                    }),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: const Text('Cancel'),
                ),
                FilledButton(
                  onPressed: selectedIds.isEmpty
                      ? null
                      : () => Navigator.pop(ctx, true),
                  child: const Text('Submit for approval'),
                ),
              ],
            );
          },
        );
      },
    );
    if (result != true || !mounted) return;
    setState(() => _submittingExpiry = true);
    try {
      final licenseApi = _toApiDate(_licenseExpiry.text);
      final prdpApi = _toApiDate(_prdpExpiry.text);
      final medicalApi = _toApiDate(_medicalCertificateExpiry.text);
      await _api.createExpiryUpdateRequest(
        requestedLicenseExpiry: licenseApi,
        requestedPrdpExpiry: prdpApi,
        requestedMedicalCertificateExpiry: medicalApi,
        supportingDocumentIds: selectedIds.isEmpty ? null : selectedIds,
      );
      if (!mounted) return;
      AppToast.success(
        context,
        'Your expiry dates have been submitted. An admin will review the supporting documents and approve or reject.',
      );
      setState(() => _isEditing = false);
    } catch (e) {
      if (mounted) AppToast.error(context, 'Failed to submit expiry update', e);
    } finally {
      if (mounted) setState(() => _submittingExpiry = false);
    }
  }

  Future<void> _uploadProfilePicture() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 60,
      maxWidth: 600,
      maxHeight: 600,
    );
    if (image == null) return;

    setState(() => _uploading = true);
    try {
      final fileBytes = await image.readAsBytes();
      await _api.uploadProfilePicture(fileBytes, image.name);
      if (mounted) {
        AppToast.success(context, 'Profile picture uploaded successfully');
        _loadProfile();
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(context, 'Upload failed', e);
      }
    } finally {
      if (mounted) {
        setState(() => _uploading = false);
      }
    }
  }

  Future<void> _deleteProfilePicture() async {
    final confirmed = await ConfirmationDialog.show(
      context: context,
      title: 'Delete Profile Picture',
      message: 'Are you sure you want to delete your profile picture?',
      isDestructive: true,
    );
    if (confirmed != true) return;

    setState(() => _uploading = true);
    try {
      await _api.deleteProfilePicture();
      if (mounted) {
        AppToast.success(context, 'Profile picture deleted');
        _loadProfile();
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(context, 'Failed to delete', e);
      }
    } finally {
      if (mounted) {
        setState(() => _uploading = false);
      }
    }
  }

  Future<void> _uploadDocument() async {
    final image = await ImagePicker().pickImage(
      source: ImageSource.gallery,
      imageQuality: 60,
      maxWidth: 800,
      maxHeight: 800,
    );
    if (image == null) return;

    final documentType = await showDialog<DocumentType>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Select Document Type'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: DocumentType.values.map((type) {
            return ListTile(
              title: Text(type.label),
              onTap: () => Navigator.pop(context, type),
            );
          }).toList(),
        ),
      ),
    );
    if (documentType == null) return;

    setState(() => _uploading = true);
    try {
      final fileBytes = await image.readAsBytes();
      await _api.uploadDriverDocument(
        fileBytes,
        image.name,
        documentType.value,
        null,
      );
      if (mounted) {
        AppToast.success(context, 'Document uploaded successfully');
        _loadDocuments();
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(context, 'Upload failed', e);
      }
    } finally {
      if (mounted) {
        setState(() => _uploading = false);
      }
    }
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return 'Not set';
    try {
      final date = DateTime.parse(dateStr);
      return '${date.day}/${date.month}/${date.year}';
    } catch (_) {
      return dateStr;
    }
  }

  /// Items that expire within 60 days or are already expired (for the expiring-soon card).
  List<({String label, DateTime date, bool expired})> _expiringItems() {
    final p = _profile;
    if (p == null) return [];
    final now = DateTime.now();
    final in60Days = now.add(const Duration(days: 60));
    final list = <({String label, DateTime date, bool expired})>[];
    const keys = {
      'licenseExpiry': 'Driver\'s licence',
      'prdpExpiry': 'PRDP certificate',
      'medicalCertificateExpiry': 'Medical certificate',
    };
    for (final entry in keys.entries) {
      final v = p[entry.key]?.toString();
      if (v == null || v.isEmpty) continue;
      final d = DateTime.tryParse(v);
      if (d == null) continue;
      if (d.isBefore(now)) {
        list.add((label: entry.value, date: d, expired: true));
      } else if (d.isBefore(in60Days)) {
        list.add((label: entry.value, date: d, expired: false));
      }
    }
    return list;
  }

  Widget _expiringSoonCard(bool isDarkMode) {
    final items = _expiringItems();
    if (items.isEmpty) return const SizedBox.shrink();
    final now = DateTime.now();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.amber.withOpacity(isDarkMode ? 0.2 : 0.12),
        borderRadius: BorderRadius.circular(AppTheme.radius),
        border: Border.all(color: Colors.amber.shade700.withOpacity(0.5)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.amber.shade800, size: 22),
              const SizedBox(width: 8),
              Text(
                'Documents expiring soon',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: isDarkMode ? Colors.amber.shade200 : Colors.amber.shade900,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...items.map((e) {
            final days = e.date.difference(now).inDays;
            final subtitle = e.expired
                ? 'Expired ${-days} days ago'
                : 'Expires in $days days';
            return Padding(
              padding: const EdgeInsets.only(bottom: 8),
              child: Row(
                children: [
                  Icon(
                    e.expired ? Icons.error_outline : Icons.schedule,
                    size: 18,
                    color: e.expired ? Colors.red : Colors.amber.shade800,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          e.label,
                          style: TextStyle(
                            fontWeight: FontWeight.w600,
                            color: isDarkMode ? Colors.grey[200] : Colors.black87,
                          ),
                        ),
                        Text(
                          '${_formatDate(e.date.toIso8601String())} · $subtitle',
                          style: TextStyle(
                            fontSize: 12,
                            color: isDarkMode ? Colors.grey[400] : Colors.black54,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 4),
          Text(
            'Tap Edit above to update expiry dates.',
            style: TextStyle(fontSize: 12, color: isDarkMode ? Colors.grey[500] : Colors.black45),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Driver Profile'),
        centerTitle: true,
        backgroundColor: isDarkMode ? AppTheme.darkBackground : null,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.pop(context),
        ),
        actions: [
          if (_isEditing) ...[
            TextButton(
              onPressed: _saving ? null : () => setState(() => _isEditing = false),
              child: const Text('Cancel'),
            ),
            TextButton(
              onPressed: _saving ? null : _saveProfile,
              child: _saving
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Text('Save'),
            ),
          ] else
            IconButton(
              icon: const Icon(Icons.edit_outlined),
              tooltip: 'Edit profile',
              onPressed: () {
                _populateEditableControllers();
                setState(() => _isEditing = true);
              },
            ),
        ],
      ),
      backgroundColor: isDarkMode ? AppTheme.darkBackground : Colors.white,
      body: _loading
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: AppTheme.primary),
                  const SizedBox(height: 16),
                  Text(
                    'Loading profile...',
                    style: TextStyle(
                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            )
          : SingleChildScrollView(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Profile Picture Section
                    Center(
                      child: Column(
                        children: [
                          Stack(
                            children: [
                              Container(
                                width: 120,
                                height: 120,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: AppTheme.primary,
                                    width: 4,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withOpacity(0.1),
                                      blurRadius: 10,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: ClipOval(
                                  child: _profile?['profilePicture'] != null
                                      ? Image.network(
                                          '${AppConfig.apiBaseUrl}/tenant/drivers/profile/picture',
                                          headers: {
                                            'Authorization': 'Bearer ${Session.accessToken ?? ''}',
                                            if (Session.tenantId != null) 'X-Tenant-Id': Session.tenantId!,
                                          },
                                          fit: BoxFit.cover,
                                          errorBuilder: (context, error, stackTrace) {
                                            return _buildInitialsAvatar();
                                          },
                                        )
                                      : _buildInitialsAvatar(),
                                ),
                              ),
                              Positioned(
                                bottom: 0,
                                right: 0,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: AppTheme.primary,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white, width: 3),
                                  ),
                                  child: IconButton(
                                    icon: const Icon(Icons.camera_alt, color: Colors.white, size: 20),
                                    onPressed: _uploading ? null : _uploadProfilePicture,
                                    padding: EdgeInsets.zero,
                                    constraints: const BoxConstraints(),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 12),
                          if (_profile?['profilePicture'] != null)
                            TextButton.icon(
                              onPressed: _uploading ? null : _deleteProfilePicture,
                              icon: const Icon(Icons.delete_outline, size: 16),
                              label: const Text('Remove Picture'),
                              style: TextButton.styleFrom(
                                foregroundColor: Colors.red,
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                    if (_expiringItems().isNotEmpty) ...[
                      _expiringSoonCard(isDarkMode),
                      const SizedBox(height: 24),
                    ],
                    _sectionHeader('Personal Information', isDarkMode),
                    _infoCard(isDarkMode, [
                      _infoRow('Full Name', '${_profile?['firstName'] ?? ''} ${_profile?['lastName'] ?? ''}'.trim(), Icons.person),
                      _infoRow('Email', _profile?['email'] ?? 'Not set', Icons.email),
                      _infoRow('Phone', _profile?['phoneNumber'] ?? 'Not set', Icons.phone),
                      _infoRow('Date of Birth', _formatDate(_profile?['dateOfBirth']), Icons.calendar_today),
                      _infoRow('ID Number', _profile?['idNumber'] ?? 'Not set', Icons.badge),
                      _infoRow('Passport Number', _profile?['passportNumber'] ?? 'Not set', Icons.credit_card),
                      _infoRow('Address', _profile?['address'] ?? 'Not set', Icons.home),
                    ]),
                    const SizedBox(height: 24),
                    _sectionHeader('License & PRDP Information', isDarkMode),
                    _isEditing
                        ? _editableCard(
                            isDarkMode,
                            [
                              _editField(isDarkMode, 'License Number', _licenseNumber, TextInputType.text, Icons.drive_eta),
                              _editDateField(isDarkMode, 'License Expiry', _licenseExpiry, Icons.event),
                              _editField(isDarkMode, 'PRDP Number', _prdpNumber, TextInputType.text, Icons.verified_user),
                              _editDateField(isDarkMode, 'PRDP Expiry', _prdpExpiry, Icons.event),
                              _editDateField(isDarkMode, 'Medical Certificate Expiry', _medicalCertificateExpiry, Icons.medical_services),
                            ],
                          )
                        : _infoCard(isDarkMode, [
                            _infoRow('License Number', _profile?['licenseNumber'] ?? 'Not set', Icons.drive_eta),
                            _infoRow('License Expiry', _formatDate(_profile?['licenseExpiry']), Icons.event),
                            _infoRow('PRDP Number', _profile?['prdpNumber'] ?? 'Not set', Icons.verified_user),
                            _infoRow('PRDP Expiry', _formatDate(_profile?['prdpExpiry']), Icons.event),
                            _infoRow('Medical Certificate Expiry', _formatDate(_profile?['medicalCertificateExpiry']), Icons.medical_services),
                          ]),
                    if (_isEditing && _hasAnyExpiryEntered) ...[
                      const SizedBox(height: 12),
                      OutlinedButton.icon(
                        onPressed: _submittingExpiry ? null : () => _showSubmitExpiryDialog(isDarkMode),
                        icon: _submittingExpiry
                            ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                            : const Icon(Icons.send_outlined, size: 18),
                        label: Text(_submittingExpiry ? 'Submitting...' : 'Submit expiry dates for approval'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: AppTheme.primary,
                          side: const BorderSide(color: AppTheme.primary),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Admin will review your supporting documents before approving new dates.',
                        style: TextStyle(fontSize: 12, color: isDarkMode ? Colors.grey[400] : Colors.black54),
                      ),
                    ],
                    const SizedBox(height: 24),
                    _sectionHeader('Banking Information', isDarkMode),
                    _isEditing
                        ? _editableCard(
                            isDarkMode,
                            [
                              _editField(isDarkMode, 'Bank Name', _bankName, TextInputType.text, Icons.account_balance),
                              _editField(isDarkMode, 'Account Number', _bankAccountNumber, TextInputType.number, Icons.account_circle),
                              _editField(isDarkMode, 'Branch Code', _bankBranchCode, TextInputType.text, Icons.location_on),
                              _editField(isDarkMode, 'Account Holder', _accountHolderName, TextInputType.name, Icons.person_outline),
                            ],
                          )
                        : _infoCard(isDarkMode, [
                            _infoRow('Bank Name', _profile?['bankName'] ?? 'Not set', Icons.account_balance),
                            _infoRow('Account Number', _profile?['bankAccountNumber'] ?? 'Not set', Icons.account_circle),
                            _infoRow('Branch Code', _profile?['bankBranchCode'] ?? 'Not set', Icons.location_on),
                            _infoRow('Account Holder', _profile?['accountHolderName'] ?? 'Not set', Icons.person_outline),
                          ]),
                    const SizedBox(height: 24),
                    _sectionHeader('Emergency Contact', isDarkMode),
                    _isEditing
                        ? _editableCard(
                            isDarkMode,
                            [
                              _editField(isDarkMode, 'Contact Name', _emergencyContactName, TextInputType.name, Icons.contact_emergency),
                              _editField(isDarkMode, 'Contact Phone', _emergencyContactPhone, TextInputType.phone, Icons.phone),
                            ],
                          )
                        : _infoCard(isDarkMode, [
                            _infoRow('Contact Name', _profile?['emergencyContactName'] ?? 'Not set', Icons.contact_emergency),
                            _infoRow('Contact Phone', _profile?['emergencyContactPhone'] ?? 'Not set', Icons.phone),
                          ]),
                    const SizedBox(height: 24),
                    _sectionHeader('Documents', isDarkMode),
                    ElevatedButton.icon(
                      onPressed: _uploading ? null : _uploadDocument,
                      icon: _uploading
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.upload),
                      label: Text(_uploading ? 'Uploading...' : 'Upload Document'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 16),
                    if (_documents.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: isDarkMode ? AppTheme.darkSurface : Colors.grey[100],
                          borderRadius: BorderRadius.circular(AppTheme.radius),
                        ),
                        child: const Text('No documents uploaded yet'),
                      )
                    else
                      ..._documents.map((doc) => _documentCard(doc, isDarkMode)),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _sectionHeader(String title, bool isDarkMode) {
    return Text(
      title,
      style: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.bold,
        color: isDarkMode ? Colors.white : Colors.black87,
      ),
    );
  }

  Widget _infoCard(bool isDarkMode, List<Widget> children) {
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
      child: Column(children: children),
    );
  }

  Widget _infoRow(String label, String value, IconData icon) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: AppTheme.primary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    fontSize: 12,
                    color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  value,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                    color: isDarkMode ? Colors.white : Colors.black87,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _editableCard(bool isDarkMode, List<Widget> children) {
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
        children: children,
      ),
    );
  }

  Widget _editField(
    bool isDarkMode,
    String label,
    TextEditingController controller,
    TextInputType keyboardType,
    IconData icon,
  ) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: TextFormField(
        controller: controller,
        keyboardType: keyboardType,
        style: TextStyle(
          fontSize: 16,
          color: isDarkMode ? Colors.white : Colors.black87,
        ),
        decoration: InputDecoration(
          labelText: label,
          labelStyle: TextStyle(color: isDarkMode ? Colors.grey[400] : Colors.grey[600]),
          prefixIcon: Icon(icon, color: AppTheme.primary, size: 20),
          filled: true,
          fillColor: isDarkMode ? AppTheme.darkBackground : Colors.grey.shade50,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppTheme.radius),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppTheme.radius),
            borderSide: BorderSide(color: isDarkMode ? AppTheme.darkBorder : Colors.grey.shade300),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppTheme.radius),
            borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
          ),
        ),
      ),
    );
  }

  Widget _editDateField(bool isDarkMode, String label, TextEditingController controller, IconData icon) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: InkWell(
        onTap: () => _pickDate(context, controller),
        borderRadius: BorderRadius.circular(AppTheme.radius),
        child: IgnorePointer(
          child: TextFormField(
            controller: controller,
            style: TextStyle(
              fontSize: 16,
              color: isDarkMode ? Colors.white : Colors.black87,
            ),
            decoration: InputDecoration(
              labelText: label,
              hintText: 'Tap to pick date',
              labelStyle: TextStyle(color: isDarkMode ? Colors.grey[400] : Colors.grey[600]),
              prefixIcon: Icon(icon, color: AppTheme.primary, size: 20),
              suffixIcon: const Icon(Icons.calendar_today, size: 20),
              filled: true,
              fillColor: isDarkMode ? AppTheme.darkBackground : Colors.grey.shade50,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppTheme.radius),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppTheme.radius),
                borderSide: BorderSide(color: isDarkMode ? AppTheme.darkBorder : Colors.grey.shade300),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(AppTheme.radius),
                borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _documentCard(Map<String, dynamic> doc, bool isDarkMode) {
    final typeLabel = DocumentType.values.firstWhere(
      (t) => t.value == doc['documentType'],
      orElse: () => DocumentType.other,
    ).label;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDarkMode ? AppTheme.darkSurface : Colors.white,
        borderRadius: BorderRadius.circular(AppTheme.radius),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: Row(
        children: [
          Icon(Icons.description, color: AppTheme.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  typeLabel,
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: isDarkMode ? Colors.white : Colors.black87,
                  ),
                ),
                Text(
                  doc['fileName'] ?? 'Unknown',
                  style: TextStyle(
                    fontSize: 12,
                    color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                  ),
                ),
              ],
            ),
          ),
          IconButton(
            icon: const Icon(Icons.delete),
            onPressed: () async {
              final confirmed = await ConfirmationDialog.show(
                context: context,
                title: 'Delete Document',
                message: 'Are you sure you want to delete this document? This action cannot be undone.',
                confirmText: 'Delete',
                cancelText: 'Cancel',
                isDestructive: true,
              );
              if (confirmed == true) {
                try {
                  await _api.deleteDriverDocument(doc['id']);
                  if (!mounted) return;
                  AppToast.success(context, 'Document deleted');
                  _loadDocuments();
                } catch (e) {
                  if (mounted) AppToast.error(context, 'Failed to delete document', e);
                }
              }
            },
          ),
        ],
      ),
    );
  }

  Widget _buildInitialsAvatar() {
    final firstName = _profile?['firstName'] ?? '';
    final lastName = _profile?['lastName'] ?? '';
    final initials = '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}'.toUpperCase();
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [AppTheme.primary, AppTheme.primary.withOpacity(0.8)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Text(
          initials,
          style: const TextStyle(
            fontSize: 48,
            fontWeight: FontWeight.bold,
            color: Colors.white,
          ),
        ),
      ),
    );
  }
}

