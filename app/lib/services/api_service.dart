import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config.dart';
import 'session.dart';

class ApiService {
  ApiService({String? baseUrl}) : baseUrl = baseUrl ?? AppConfig.apiBaseUrl;

  final String baseUrl;

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
    String? mfaToken,
    String? tenantId,
    String? deviceId,
    String? deviceName,
    String? pushToken,
  }) async {
    try {
      print('API Login: POST $baseUrl/tenant/auth/login');
      print('Headers: ${tenantId != null && tenantId.isNotEmpty ? 'X-Tenant-Id: $tenantId' : 'No tenant ID'}');
      final response = await http.post(
        Uri.parse('$baseUrl/tenant/auth/login'),
        headers: {
          'Content-Type': 'application/json',
          if (tenantId != null && tenantId.isNotEmpty) 'X-Tenant-Id': tenantId,
        },
        body: jsonEncode({
          'email': email,
          'password': password,
          if (mfaToken != null && mfaToken.isNotEmpty) 'mfaToken': mfaToken,
          if (deviceId != null && deviceId.isNotEmpty) 'deviceId': deviceId,
          if (deviceName != null && deviceName.isNotEmpty) 'deviceName': deviceName,
          if (pushToken != null && pushToken.isNotEmpty) 'pushToken': pushToken,
        }),
      ).timeout(
        const Duration(seconds: 30),
        onTimeout: () {
          throw Exception('Login request timed out. Please check your internet connection.');
        },
      );

      print('Login response status: ${response.statusCode}');
      print('Login response body: ${response.body}');

      return _decodeObject(response, errorPrefix: 'Login failed');
    } on http.ClientException catch (e) {
      print('Network error during login: $e');
      throw Exception('Network error: Unable to connect to server. Please check your internet connection.');
    } on FormatException catch (e) {
      print('Format error during login: $e');
      throw Exception('Invalid response from server. Please try again.');
    } catch (e) {
      print('Unexpected error during login: $e');
      rethrow;
    }
  }

  /// Page size for paginated incomes (History, dashboard recent).
  static const int incomesPageSize = 30;

  Future<List<Map<String, dynamic>>> fetchIncomes() async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/incomes'),
      headers: _authHeaders(),
    );
    final data = await _decodeList(response, errorPrefix: 'Failed to fetch incomes');
    return data.cast<Map<String, dynamic>>();
  }

  /// Paginated incomes for History screen (avoids loading all into memory).
  Future<Map<String, dynamic>> fetchIncomesPaginated({int page = 1, int limit = incomesPageSize}) async {
    final uri = Uri.parse('$baseUrl/tenant/incomes').replace(
      queryParameters: {'page': page.toString(), 'limit': limit.toString()},
    );
    final response = await http.get(uri, headers: _authHeaders());
    if (response.statusCode == 401) {
      await Session.clear();
      throw Exception('Unauthorized');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw Exception('Failed to fetch incomes (${response.statusCode})');
    }
    final json = jsonDecode(response.body);
    if (json is List) {
      return {'data': json, 'total': json.length, 'page': 1, 'limit': json.length};
    }
    final map = json as Map<String, dynamic>;
    final data = map['data'] as List<dynamic>? ?? [];
    return {
      'data': data,
      'total': (map['total'] as num?)?.toInt() ?? data.length,
      'page': (map['page'] as num?)?.toInt() ?? page,
      'limit': (map['limit'] as num?)?.toInt() ?? limit,
    };
  }

  /// Last odometer for a vehicle (for prefill and validation). Returns lastEndKm and lastLoggedOn.
  Future<Map<String, dynamic>> fetchLastOdometer(String vehicleLabel) async {
    if (vehicleLabel.isEmpty) return {'lastEndKm': null, 'lastLoggedOn': null};
    final uri = Uri.parse('$baseUrl/tenant/incomes/last-odometer').replace(
      queryParameters: {'vehicle': vehicleLabel},
    );
    final response = await http.get(uri, headers: _authHeaders());
    if (response.statusCode == 401) {
      await Session.clear();
      throw Exception('Unauthorized');
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      return {'lastEndKm': null, 'lastLoggedOn': null};
    }
    try {
      final map = jsonDecode(response.body) as Map<String, dynamic>;
      final lastEndKm = map['lastEndKm'];
      final lastLoggedOn = map['lastLoggedOn'];
      return {
        'lastEndKm': lastEndKm is num ? lastEndKm.toInt() : (lastEndKm != null ? int.tryParse(lastEndKm.toString()) : null),
        'lastLoggedOn': lastLoggedOn?.toString(),
      };
    } catch (_) {
      return {'lastEndKm': null, 'lastLoggedOn': null};
    }
  }

  Future<Map<String, dynamic>> createIncome(Map<String, dynamic> payload) async {
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/incomes'),
      headers: _authHeaders(contentType: true),
      body: jsonEncode(payload),
    );
    return _decodeObject(response, errorPrefix: 'Failed to create income');
  }

  Future<Map<String, dynamic>> fetchSummary() async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/reports/summary'),
      headers: _authHeaders(),
    );
    return _decodeObject(response, errorPrefix: 'Failed to fetch summary');
  }

  Future<List<Map<String, dynamic>>> fetchVehicles() async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/vehicles'),
      headers: _authHeaders(),
    );
    final data = await _decodeList(response, errorPrefix: 'Failed to fetch vehicles');
    return data.cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> fetchVehicleStats() async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/reports/vehicle-stats'),
      headers: _authHeaders(),
    );
    final data = await _decodeList(response, errorPrefix: 'Failed to fetch vehicle stats');
    return data.cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> fetchVehicleTrends({int days = 30}) async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/reports/vehicle-trends?days=$days'),
      headers: _authHeaders(),
    );
    final data = await _decodeList(response, errorPrefix: 'Failed to fetch vehicle trends');
    return data.cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> fetchMaintenanceTasks() async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/maintenance'),
      headers: _authHeaders(),
    );
    final data = await _decodeList(response, errorPrefix: 'Failed to fetch maintenance');
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> createMaintenanceTask(Map<String, dynamic> payload) async {
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/maintenance'),
      headers: _authHeaders(contentType: true),
      body: jsonEncode(payload),
    );
    return _decodeObject(response, errorPrefix: 'Failed to create maintenance task');
  }

  Future<Map<String, dynamic>> updateMaintenanceTask(String id, Map<String, dynamic> payload) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/tenant/maintenance/$id'),
      headers: _authHeaders(contentType: true),
      body: jsonEncode(payload),
    );
    return _decodeObject(response, errorPrefix: 'Failed to update maintenance task');
  }

  Future<List<Map<String, dynamic>>> fetchTenantAuditLogs() async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/audit'),
      headers: _authHeaders(),
    );
    final data = await _decodeList(response, errorPrefix: 'Failed to fetch audit logs');
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> setupMfa() async {
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/auth/mfa/setup'),
      headers: _authHeaders(contentType: true),
    );
    return _decodeObject(response, errorPrefix: 'Failed to setup MFA');
  }

  Future<Map<String, dynamic>> verifyMfa(String token) async {
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/auth/mfa/verify'),
      headers: _authHeaders(contentType: true),
      body: jsonEncode({'token': token}),
    );
    return _decodeObject(response, errorPrefix: 'Failed to verify MFA');
  }

  Future<Map<String, dynamic>> fetchTenantPolicy() async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/policy'),
      headers: _authHeaders(),
    );
    return _decodeObject(response, errorPrefix: 'Failed to fetch tenant policy');
  }

  Future<Map<String, dynamic>> fetchTenantPolicyPublic(String tenantId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/policy/public'),
      headers: {
        'X-Tenant-Id': tenantId,
      },
    );
    return _decodeObject(response, errorPrefix: 'Failed to fetch tenant policy');
  }

  Future<Map<String, dynamic>> setupMfaInit({
    required String email,
    required String password,
    required String tenantId,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/auth/mfa/setup-init'),
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
      body: jsonEncode({'email': email, 'password': password}),
    );
    return _decodeObject(response, errorPrefix: 'Failed to setup MFA');
  }

  Future<Map<String, dynamic>> verifyMfaInit({
    required String email,
    required String password,
    required String tenantId,
    required String token,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/auth/mfa/verify-init'),
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-Id': tenantId,
      },
      body: jsonEncode({
        'email': email,
        'password': password,
        'token': token,
      }),
    );
    return _decodeObject(response, errorPrefix: 'Failed to verify MFA');
  }

  Future<Map<String, dynamic>> refreshSession({
    String? refreshToken,
  }) async {
    final token = refreshToken ?? Session.refreshToken;
    if (token == null || token.isEmpty) {
      throw Exception('No refresh token');
    }
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/auth/refresh'),
      headers: {
        'Content-Type': 'application/json',
        if (Session.tenantId != null && Session.tenantId!.isNotEmpty)
          'X-Tenant-Id': Session.tenantId!,
      },
      body: jsonEncode({
        'refreshToken': token,
      }),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      return data;
    }
    await Session.clear();
    throw Exception('Failed to refresh session');
  }

  Future<Map<String, dynamic>> fetchDriverProfile() async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/drivers/profile'),
      headers: _authHeaders(),
    );
    return _decodeObject(response, errorPrefix: 'Failed to fetch driver profile');
  }

  Future<Map<String, dynamic>> updateDriverProfile(Map<String, dynamic> data) async {
    final response = await http.put(
      Uri.parse('$baseUrl/tenant/drivers/profile'),
      headers: _authHeaders(contentType: true),
      body: jsonEncode(data),
    );
    return _decodeObject(response, errorPrefix: 'Failed to update driver profile');
  }

  /// For badge: expiringCount, hasPendingRequest, showExpiryBadge.
  Future<Map<String, dynamic>> fetchExpiryStatus() async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/drivers/profile/expiry-status'),
      headers: _authHeaders(),
    );
    return _decodeObject(response, errorPrefix: 'Failed to fetch expiry status');
  }

  Future<Map<String, dynamic>> createExpiryUpdateRequest({
    String? requestedLicenseExpiry,
    String? requestedPrdpExpiry,
    String? requestedMedicalCertificateExpiry,
    List<String>? supportingDocumentIds,
  }) async {
    final body = <String, dynamic>{};
    if (requestedLicenseExpiry != null && requestedLicenseExpiry.isNotEmpty) body['requestedLicenseExpiry'] = requestedLicenseExpiry;
    if (requestedPrdpExpiry != null && requestedPrdpExpiry.isNotEmpty) body['requestedPrdpExpiry'] = requestedPrdpExpiry;
    if (requestedMedicalCertificateExpiry != null && requestedMedicalCertificateExpiry.isNotEmpty) body['requestedMedicalCertificateExpiry'] = requestedMedicalCertificateExpiry;
    if (supportingDocumentIds != null && supportingDocumentIds.isNotEmpty) body['supportingDocumentIds'] = supportingDocumentIds;
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/drivers/profile/expiry-update-requests'),
      headers: _authHeaders(contentType: true),
      body: jsonEncode(body),
    );
    return _decodeObject(response, errorPrefix: 'Failed to submit expiry update request');
  }

  Future<List<Map<String, dynamic>>> fetchMyExpiryUpdateRequests() async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/drivers/profile/expiry-update-requests'),
      headers: _authHeaders(),
    );
    final data = await _decodeList(response, errorPrefix: 'Failed to fetch expiry requests');
    return data.cast<Map<String, dynamic>>();
  }

  Future<List<Map<String, dynamic>>> fetchDriverDocuments() async {
    final response = await http.get(
      Uri.parse('$baseUrl/tenant/drivers/documents'),
      headers: _authHeaders(),
    );
    final data = await _decodeList(response, errorPrefix: 'Failed to fetch documents');
    return data.cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> uploadDriverDocument(
    List<int> fileBytes,
    String fileName,
    String documentType,
    String? notes,
  ) async {
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/tenant/drivers/documents'),
    );
    request.headers.addAll(_authHeaders());
    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        fileBytes,
        filename: fileName,
      ),
    );
    request.fields['documentType'] = documentType;
    if (notes != null && notes.isNotEmpty) {
      request.fields['notes'] = notes;
    }
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    return _decodeObject(response, errorPrefix: 'Failed to upload document');
  }

  Future<void> deleteDriverDocument(String documentId) async {
    final response = await http.delete(
      Uri.parse('$baseUrl/tenant/drivers/documents/$documentId'),
      headers: _authHeaders(),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    }
    throw Exception('Failed to delete document');
  }

  Future<Map<String, dynamic>> uploadProfilePicture(
    List<int> fileBytes,
    String fileName,
  ) async {
    // Ensure filename has an image extension (server may validate by extension if mimetype is missing)
    String name = fileName;
    if (!RegExp(r'\.(jpe?g|png|gif|webp)$', caseSensitive: false).hasMatch(name)) {
      name = name.isEmpty ? 'image.jpg' : '$name.jpg';
    }
    final request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/tenant/drivers/profile/picture'),
    );
    request.headers.addAll(_authHeaders());
    request.files.add(
      http.MultipartFile.fromBytes(
        'file',
        fileBytes,
        filename: name,
      ),
    );
    final streamedResponse = await request.send();
    final response = await http.Response.fromStream(streamedResponse);
    return _decodeObject(response, errorPrefix: 'Failed to upload profile picture');
  }

  Future<void> deleteProfilePicture() async {
    final response = await http.delete(
      Uri.parse('$baseUrl/tenant/drivers/profile/picture'),
      headers: _authHeaders(),
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    }
    throw Exception('Failed to delete profile picture');
  }

  String getProfilePictureUrl() {
    return '$baseUrl/tenant/drivers/profile/picture';
  }

  /// Fetches the current driver's profile picture with auth. Returns null if none or error.
  Future<List<int>?> getProfilePictureBytes() async {
    final token = Session.accessToken;
    if (token == null || token.isEmpty) return null;
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/tenant/drivers/profile/picture'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return response.bodyBytes;
      }
    } catch (_) {}
    return null;
  }

  Future<List<dynamic>> _decodeList(
    http.Response response, {
    required String errorPrefix,
  }) async {
    if (response.statusCode == 401) {
      await Session.clear();
      throw Exception('Unauthorized');
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return jsonDecode(response.body) as List<dynamic>;
    }
    throw Exception('$errorPrefix (${response.statusCode})');
  }

  /// Parses the response body and returns a user-friendly error message.
  String _parseErrorMessage(http.Response response, String fallback) {
    try {
      final data = jsonDecode(response.body);
      if (data is! Map<String, dynamic>) return fallback;
      if (data['message'] is String) {
        final msg = (data['message'] as String).trim();
        if (msg.isNotEmpty) return msg;
      }
      if (data['message'] is List) {
        final parts = (data['message'] as List).whereType<String>().toList();
        if (parts.isNotEmpty) return parts.join(' ');
      }
    } catch (_) {}
    return fallback;
  }

  Future<Map<String, dynamic>> _decodeObject(
    http.Response response, {
    required String errorPrefix,
  }) async {
    print('_decodeObject: status=${response.statusCode}, body=${response.body}');
    if (response.statusCode == 401) {
      await Session.clear();
      final message = _parseErrorMessage(response, 'Unauthorized');
      throw Exception(message);
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      try {
        return jsonDecode(response.body) as Map<String, dynamic>;
      } catch (e) {
        print('JSON decode error: $e');
        throw Exception('$errorPrefix: Invalid response format from server');
      }
    }
    final message = _parseErrorMessage(response, '$errorPrefix (${response.statusCode})');
    throw Exception(message.isNotEmpty ? message : '$errorPrefix (${response.statusCode})');
  }

  Map<String, String> _authHeaders({bool contentType = false}) {
    final headers = <String, String>{};
    if (contentType) {
      headers['Content-Type'] = 'application/json';
    }
    final token = Session.accessToken;
    if (token != null && token.isNotEmpty) {
      headers['Authorization'] = 'Bearer $token';
    }
    final tenantId = Session.tenantId;
    if (tenantId != null && tenantId.isNotEmpty) {
      headers['X-Tenant-Id'] = tenantId;
    }
    return headers;
  }

  Future<Map<String, dynamic>> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/auth/change-password'),
      headers: _authHeaders(),
      body: jsonEncode({
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      }),
    );
    return _decodeObject(response, errorPrefix: 'Failed to change password');
  }

  Future<Map<String, dynamic>> forgotPassword(String email, {String? tenantId}) async {
    final effectiveTenantId = tenantId ?? Session.tenantId;
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/auth/forgot-password'),
      headers: {
        'Content-Type': 'application/json',
        if (effectiveTenantId != null && effectiveTenantId.isNotEmpty)
          'X-Tenant-Id': effectiveTenantId,
      },
      body: jsonEncode({'email': email}),
    );
    return _decodeObject(response, errorPrefix: 'Failed to send password reset email');
  }

  Future<Map<String, dynamic>> resetPassword({
    required String token,
    required String newPassword,
    String? tenantId,
  }) async {
    final effectiveTenantId = tenantId ?? Session.tenantId;
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/auth/reset-password'),
      headers: {
        'Content-Type': 'application/json',
        if (effectiveTenantId != null && effectiveTenantId.isNotEmpty)
          'X-Tenant-Id': effectiveTenantId,
      },
      body: jsonEncode({
        'token': token,
        'newPassword': newPassword,
      }),
    );
    return _decodeObject(response, errorPrefix: 'Failed to reset password');
  }

  Future<Map<String, dynamic>> resendVerificationEmail(String email, {String? tenantId}) async {
    final effectiveTenantId = tenantId ?? Session.tenantId;
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/auth/resend-verification'),
      headers: {
        'Content-Type': 'application/json',
        if (effectiveTenantId != null && effectiveTenantId.isNotEmpty)
          'X-Tenant-Id': effectiveTenantId,
      },
      body: jsonEncode({'email': email}),
    );
    return _decodeObject(response, errorPrefix: 'Failed to resend verification email');
  }

  Future<Map<String, dynamic>> verifyEmail(String token, {String? tenantId}) async {
    final effectiveTenantId = tenantId ?? Session.tenantId;
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/auth/verify-email'),
      headers: {
        'Content-Type': 'application/json',
        if (effectiveTenantId != null && effectiveTenantId.isNotEmpty)
          'X-Tenant-Id': effectiveTenantId,
      },
      body: jsonEncode({'token': token}),
    );
    return _decodeObject(response, errorPrefix: 'Failed to verify email');
  }

  Future<Map<String, dynamic>> sendEmailOtp(String email, {String? tenantId}) async {
    final effectiveTenantId = tenantId ?? Session.tenantId;
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/auth/send-email-otp'),
      headers: {
        'Content-Type': 'application/json',
        if (effectiveTenantId != null && effectiveTenantId.isNotEmpty)
          'X-Tenant-Id': effectiveTenantId,
      },
      body: jsonEncode({'email': email}),
    );
    return _decodeObject(response, errorPrefix: 'Failed to send verification code');
  }

  Future<Map<String, dynamic>> verifyEmailOtp(String email, String code, {String? tenantId}) async {
    final effectiveTenantId = tenantId ?? Session.tenantId;
    final response = await http.post(
      Uri.parse('$baseUrl/tenant/auth/verify-email-otp'),
      headers: {
        'Content-Type': 'application/json',
        if (effectiveTenantId != null && effectiveTenantId.isNotEmpty)
          'X-Tenant-Id': effectiveTenantId,
      },
      body: jsonEncode({'email': email, 'code': code}),
    );
    return _decodeObject(response, errorPrefix: 'Failed to verify code');
  }
}

