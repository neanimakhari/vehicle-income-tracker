import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../services/session.dart';
import '../theme.dart';
import '../utils/app_toast.dart';

class MaintenanceScreen extends StatefulWidget {
  const MaintenanceScreen({super.key});

  @override
  State<MaintenanceScreen> createState() => _MaintenanceScreenState();
}

class _MaintenanceScreenState extends State<MaintenanceScreen> {
  final _api = ApiService();
  bool _loading = true;
  List<Map<String, dynamic>> _tasks = [];
  List<Map<String, dynamic>> _vehicles = [];

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final tasks = await _api.fetchMaintenanceTasks();
      final vehicles = Session.role == 'TENANT_ADMIN' ? await _api.fetchVehicles() : <Map<String, dynamic>>[];
      if (!mounted) return;
      setState(() {
        _tasks = tasks;
        _vehicles = vehicles;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _tasks = [];
        _vehicles = [];
      });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDarkMode = Theme.of(context).brightness == Brightness.dark;
    final isAdmin = Session.role == 'TENANT_ADMIN';
    return Scaffold(
      appBar: AppBar(
        title: const Text('Maintenance'),
        centerTitle: true,
        backgroundColor: isDarkMode ? AppTheme.darkBackground : null,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.maybePop(context),
        ),
      ),
      backgroundColor: isDarkMode ? AppTheme.darkBackground : Colors.white,
      floatingActionButton: isAdmin
          ? FloatingActionButton(
              backgroundColor: AppTheme.primary,
              onPressed: _showCreateDialog,
              child: const Icon(Icons.add),
            )
          : null,
      body: _loading
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  CircularProgressIndicator(color: AppTheme.primary),
                  const SizedBox(height: 16),
                  Text(
                    'Loading maintenance...',
                    style: TextStyle(
                      color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                      fontSize: 14,
                    ),
                  ),
                ],
              ),
            )
          : RefreshIndicator(
              onRefresh: _load,
              child: _tasks.isEmpty
                  ? ListView(
                      padding: const EdgeInsets.all(24),
                      children: [
                        const SizedBox(height: 48),
                        Icon(
                          Icons.build_circle_outlined,
                          size: 72,
                          color: isDarkMode ? Colors.grey[600] : Colors.grey[400],
                        ),
                        const SizedBox(height: 24),
                        Text(
                          'No maintenance tasks yet',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w600,
                            color: isDarkMode ? Colors.white : Colors.black87,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          isAdmin
                              ? 'Tap the + button below to add a task (e.g. oil change, service) for a vehicle. You can set a due date or due kilometrage.'
                              : 'Your admin can add maintenance tasks for vehicles. You can view and track when service is due.',
                          style: TextStyle(
                            fontSize: 14,
                            color: isDarkMode ? Colors.grey[400] : Colors.grey[600],
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    )
                  : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _tasks.length,
                itemBuilder: (context, index) {
                  final task = _tasks[index];
                  final status = task['status']?.toString() ?? 'ok';
                  final label = task['vehicleLabel']?.toString() ?? 'Vehicle';
                  final reg = task['registrationNumber']?.toString();
                  final dueKm = task['dueKm'];
                  final dueDate = task['dueDate']?.toString();
                  final isCompleted = task['isCompleted'] == true;
                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(AppTheme.radius),
                      color: isDarkMode ? AppTheme.darkSurface : Colors.white,
                      border: Border.all(color: AppTheme.primary.withOpacity(0.1)),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _statusDot(status, isCompleted),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                reg == null || reg.isEmpty ? label : '$label • $reg',
                                style: TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: isDarkMode ? Colors.white : Colors.black87,
                                ),
                              ),
                              const SizedBox(height: 6),
                              if (dueKm != null) Text('Due at $dueKm km'),
                              if (dueDate != null) Text('Due by $dueDate'),
                              if ((task['notes']?.toString() ?? '').isNotEmpty)
                                Text(task['notes'].toString()),
                              const SizedBox(height: 6),
                              Text(
                                _statusLabel(status, isCompleted),
                                style: TextStyle(
                                  color: _statusColor(status, isCompleted),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (isAdmin)
                          TextButton(
                            onPressed: () => _markCompleted(task['id']?.toString(), !isCompleted),
                            child: Text(isCompleted ? 'Reopen' : 'Done'),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
    );
  }

  Widget _statusDot(String status, bool isCompleted) {
    return Container(
      width: 10,
      height: 10,
      decoration: BoxDecoration(
        color: _statusColor(status, isCompleted),
        shape: BoxShape.circle,
      ),
    );
  }

  Color _statusColor(String status, bool isCompleted) {
    if (isCompleted) return Colors.green;
    if (status == 'overdue') return Colors.red;
    if (status == 'due_soon') return Colors.orange;
    return Colors.blueGrey;
  }

  String _statusLabel(String status, bool isCompleted) {
    if (isCompleted) return 'Completed';
    if (status == 'overdue') return 'Overdue';
    if (status == 'due_soon') return 'Due soon';
    return 'On track';
  }

  Future<void> _markCompleted(String? id, bool isCompleted) async {
    if (id == null || id.isEmpty) return;
    try {
      await _api.updateMaintenanceTask(id, {'isCompleted': isCompleted});
      if (!mounted) return;
      AppToast.success(context, isCompleted ? 'Task marked as completed' : 'Task reopened');
      await _load();
    } catch (e) {
      if (!mounted) return;
      AppToast.error(context, 'Failed to update task', e);
    }
  }

  Future<void> _showCreateDialog() async {
    final vehicleId = _vehicles.isNotEmpty ? _vehicles.first['id']?.toString() : null;
    String? selectedVehicleId = vehicleId;
    final dueKmController = TextEditingController();
    final notesController = TextEditingController();
    DateTime? dueDate;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 16,
                bottom: MediaQuery.of(context).viewInsets.bottom + 16,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Create Maintenance', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    value: selectedVehicleId,
                    decoration: const InputDecoration(labelText: 'Vehicle'),
                    items: _vehicles.map((vehicle) {
                      final id = vehicle['id']?.toString() ?? '';
                      final label = vehicle['label']?.toString() ?? 'Vehicle';
                      final reg = vehicle['registrationNumber']?.toString();
                      return DropdownMenuItem(
                        value: id,
                        child: Text(reg == null || reg.isEmpty ? label : '$label • $reg'),
                      );
                    }).toList(),
                    onChanged: (value) => setModalState(() => selectedVehicleId = value),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: dueKmController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Due Km (optional)'),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          dueDate == null
                              ? 'Due Date (optional)'
                              : 'Due Date: ${dueDate!.toIso8601String().split('T').first}',
                        ),
                      ),
                      TextButton(
                        onPressed: () async {
                          final picked = await showDatePicker(
                            context: context,
                            initialDate: DateTime.now(),
                            firstDate: DateTime.now().subtract(const Duration(days: 1)),
                            lastDate: DateTime.now().add(const Duration(days: 365)),
                          );
                          if (picked != null) {
                            setModalState(() => dueDate = picked);
                          }
                        },
                        child: const Text('Pick'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notesController,
                    decoration: const InputDecoration(labelText: 'Notes (optional)'),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: () async {
                      try {
                        final vehicle = _vehicles.firstWhere(
                          (item) => item['id']?.toString() == selectedVehicleId,
                          orElse: () => <String, dynamic>{},
                        );
                        await _api.createMaintenanceTask({
                          'vehicleId': selectedVehicleId,
                          'vehicleLabel': vehicle['label']?.toString() ?? 'Vehicle',
                          'registrationNumber': vehicle['registrationNumber']?.toString(),
                          'dueKm': dueKmController.text.trim().isEmpty
                              ? null
                              : int.tryParse(dueKmController.text.trim()),
                          'dueDate': dueDate == null ? null : dueDate!.toIso8601String().split('T').first,
                          'notes': notesController.text.trim().isEmpty ? null : notesController.text.trim(),
                        });
                        if (!mounted) return;
                        Navigator.pop(context);
                        AppToast.success(context, 'Maintenance task created');
                        await _load();
                      } catch (e) {
                        if (!mounted) return;
                        AppToast.error(context, 'Failed to create task', e);
                      }
                    },
                    child: const Text('Save'),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

