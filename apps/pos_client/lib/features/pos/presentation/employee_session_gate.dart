import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';

import '../data/pos_catalog_repository.dart';
import '../data/pos_order_repository.dart';
import 'pos_home_page.dart';

class _EmployeeIdentity {
  const _EmployeeIdentity({required this.id, required this.name});

  final String id;
  final String name;
}

/// Shows a lightweight employee-code entry screen before the POS home page.
/// The device itself is provisioned per store (tenantId baked in at build time);
/// this screen only identifies which employee is operating it for the audit trail.
/// The typed code is matched against tenants/{tenantId}/employees (managed by the admin).
class EmployeeSessionGate extends StatefulWidget {
  const EmployeeSessionGate({
    super.key,
    required this.catalogRepository,
    required this.orderRepository,
    required this.tenantId,
    FirebaseFirestore? firestore,
  }) : _firestore = firestore;

  final PosCatalogRepository catalogRepository;
  final PosOrderRepository orderRepository;
  final String tenantId;
  final FirebaseFirestore? _firestore;

  @override
  State<EmployeeSessionGate> createState() => _EmployeeSessionGateState();
}

class _EmployeeSessionGateState extends State<EmployeeSessionGate> {
  _EmployeeIdentity? _employee;

  void _startSession(_EmployeeIdentity employee) {
    setState(() => _employee = employee);
  }

  void _endSession() {
    setState(() => _employee = null);
  }

  @override
  Widget build(BuildContext context) {
    final employee = _employee;

    if (employee == null) {
      return _EmployeeLoginView(
        tenantId: widget.tenantId,
        firestore: widget._firestore,
        onSuccess: _startSession,
      );
    }

    return PosHomePage(
      catalogRepository: widget.catalogRepository,
      orderRepository: widget.orderRepository,
      tenantId: widget.tenantId,
      employeeId: employee.id,
      employeeName: employee.name,
      onEndSession: _endSession,
    );
  }
}

class _EmployeeLoginView extends StatefulWidget {
  const _EmployeeLoginView({
    required this.tenantId,
    required this.firestore,
    required this.onSuccess,
  });

  final String tenantId;
  final FirebaseFirestore? firestore;
  final ValueChanged<_EmployeeIdentity> onSuccess;

  @override
  State<_EmployeeLoginView> createState() => _EmployeeLoginViewState();
}

class _EmployeeLoginViewState extends State<_EmployeeLoginView> {
  final _controller = TextEditingController();
  String? _error;
  bool _checking = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final employeeCode = _controller.text.trim();
    if (employeeCode.isEmpty) {
      setState(() => _error = 'Εισαγαγετε τον κωδικο υπαλληλου.');
      return;
    }

    setState(() {
      _checking = true;
      _error = null;
    });

    try {
      final firestore = widget.firestore ?? FirebaseFirestore.instance;
      final snapshot = await firestore
          .collection('tenants/${widget.tenantId}/employees')
          .where('employeeCode', isEqualTo: employeeCode)
          .where('active', isEqualTo: true)
          .limit(1)
          .get();

      if (!mounted) {
        return;
      }

      if (snapshot.docs.isEmpty) {
        setState(() {
          _checking = false;
          _error = 'Ο κωδικός δεν βρέθηκε ή ο υπάλληλος είναι ανενεργός.';
        });
        return;
      }

      final employee = snapshot.docs.first;
      final name = (employee.data()['name'] as String? ?? '').trim();
      widget.onSuccess(_EmployeeIdentity(
        id: employee.id,
        name: name.isEmpty ? employeeCode : name,
      ));
    } catch (error) {
      if (!mounted) {
        return;
      }

      debugPrint('POS employee validation failed: ${error.runtimeType}');
      setState(() {
        _checking = false;
        _error = 'Αποτυχία ελέγχου κωδικού υπαλλήλου. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;

    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [colors.surface, colors.primaryContainer],
          ),
        ),
        child: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Card(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Εναρξη Συνεδριας',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 26, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Καταστημα: ${widget.tenantId}',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: colors.secondary),
                      ),
                      const SizedBox(height: 24),
                      TextField(
                        controller: _controller,
                        autofocus: true,
                        enabled: !_checking,
                        textAlign: TextAlign.center,
                        style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
                        decoration: const InputDecoration(
                          labelText: 'Κωδικος υπαλληλου',
                          border: OutlineInputBorder(),
                        ),
                        onSubmitted: (_) => _submit(),
                      ),
                      if (_error != null) ...[
                        const SizedBox(height: 8),
                        Text(
                          _error!,
                          maxLines: 4,
                          overflow: TextOverflow.visible,
                          style: TextStyle(color: colors.error),
                        ),
                      ],
                      const SizedBox(height: 20),
                      SizedBox(
                        height: 58,
                        child: FilledButton(
                          onPressed: _checking ? null : _submit,
                          child: _checking
                              ? const SizedBox(
                                  width: 26,
                                  height: 26,
                                  child: CircularProgressIndicator(strokeWidth: 3),
                                )
                              : const Text('Εναρξη', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w700)),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

