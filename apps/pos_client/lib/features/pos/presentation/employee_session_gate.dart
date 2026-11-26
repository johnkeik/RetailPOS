import 'package:flutter/services.dart';
import '../auth/pos_device_auth.dart';
import 'pos_activation_page.dart';
import 'package:flutter/material.dart';

import '../data/pos_catalog_repository.dart';
import '../data/pos_order_repository.dart';
import 'pos_home_page.dart';
import 'pos_window_controls.dart';

class EmployeeSessionGate extends StatefulWidget {
  const EmployeeSessionGate({
    super.key,
    required this.catalogRepository,
    required this.orderRepository,
    PosDeviceAuth? auth,
  }) : _auth = auth;

  final PosCatalogRepository catalogRepository;
  final PosOrderRepository orderRepository;
  final PosDeviceAuth? _auth;

  @override
  State<EmployeeSessionGate> createState() => _EmployeeSessionGateState();
}

class _EmployeeSessionGateState extends State<EmployeeSessionGate> {
  PosEmployeeSession? _employee;
  late final PosDeviceAuth _auth = widget._auth ?? FirebasePosDeviceAuth();
  bool _restoring = true;
  bool _activated = false;
  String? _restoreError;

  @override
  void initState() {
    super.initState();
    _restore();
  }

  Future<void> _restore() async {
    setState(() {
      _restoring = true;
      _restoreError = null;
    });
    try {
      final activated = await _auth.restore();
      if (mounted) {
        setState(() {
          _activated = activated;
          _restoring = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _restoring = false;
          _restoreError =
              'Δεν ήταν δυνατή η σύνδεση. Ελέγξτε το δίκτυο και δοκιμάστε ξανά.';
        });
      }
    }
  }

  void _startSession(PosEmployeeSession employee) {
    setState(() => _employee = employee);
  }

  void _endSession() {
    setState(() => _employee = null);
    _restore();
  }

  @override
  Widget build(BuildContext context) {
    if (_restoring) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (_restoreError != null) {
      return Scaffold(
          body: Center(
              child: Column(mainAxisSize: MainAxisSize.min, children: [
        Text(_restoreError!),
        FilledButton(onPressed: _restore, child: const Text('Δοκιμή ξανά')),
        TextButton(
            onPressed: () => setState(() {
                  _restoreError = null;
                  _activated = false;
                }),
            child: const Text('Ενεργοποίηση με λογαριασμό διαχειριστή')),
      ])));
    }
    if (!_activated) {
      return PosActivationPage(
          auth: _auth, onActivated: () => setState(() => _activated = true));
    }
    final employee = _employee;

    if (employee == null) {
      return _EmployeeLoginView(
        tenantId: _auth.tenantId!,
        auth: _auth,
        onSuccess: _startSession,
        onActivate: () => setState(() => _activated = false),
      );
    }

    return PosHomePage(
      catalogRepository: widget.catalogRepository,
      orderRepository: widget.orderRepository,
      tenantId: _auth.tenantId!,
      employeeId: employee.id,
      employeeName: employee.name,
      onEndSession: _endSession,
    );
  }
}

class _EmployeeLoginView extends StatefulWidget {
  const _EmployeeLoginView({
    required this.tenantId,
    required this.auth,
    required this.onSuccess,
    required this.onActivate,
  });

  final String tenantId;
  final PosDeviceAuth auth;
  final ValueChanged<PosEmployeeSession> onSuccess;
  final VoidCallback onActivate;

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

  void _appendDigit(String digit) {
    if (_checking || _controller.text.length >= 12) return;
    _controller.text += digit;
    setState(() => _error = null);
  }

  void _backspace() {
    final text = _controller.text;
    if (_checking || text.isEmpty) return;
    _controller.text = text.substring(0, text.length - 1);
  }

  void _clear() {
    if (!_checking) _controller.clear();
  }

  Widget _keypadButton(String label, VoidCallback onTap) {
    return FilledButton.tonal(
      onPressed: _checking ? null : onTap,
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(60),
        padding: EdgeInsets.zero,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      ),
      child: Text(label,
          style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800)),
    );
  }

  Widget _buildKeypad() {
    final rows = [
      ['1', '2', '3'],
      ['4', '5', '6'],
      ['7', '8', '9'],
      ['⌫', '0', 'C'],
    ];
    return Column(
      children: [
        for (final row in rows) ...[
          Row(
            children: [
              for (var i = 0; i < row.length; i++) ...[
                if (i > 0) const SizedBox(width: 8),
                Expanded(
                  child: _keypadButton(
                    row[i],
                    row[i] == '⌫'
                        ? _backspace
                        : row[i] == 'C'
                            ? _clear
                            : () => _appendDigit(row[i]),
                  ),
                ),
              ],
            ],
          ),
          if (row != rows.last) const SizedBox(height: 8),
        ],
      ],
    );
  }

  Future<void> _submit() async {
    if (_checking) return;
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
      final employee = await widget.auth.loginEmployee(employeeCode);
      if (mounted) widget.onSuccess(employee);
    } catch (error) {
      if (!mounted) {
        return;
      }

      debugPrint('POS employee validation failed: ${error.runtimeType}');
      setState(() {
        _checking = false;
        _error =
            'Αποτυχία ελέγχου κωδικού υπαλλήλου. Ελέγξτε τη σύνδεση και δοκιμάστε ξανά.';
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
          child: Stack(
            children: [
              Center(
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
                            style: TextStyle(
                                fontSize: 26, fontWeight: FontWeight.w700),
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
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                              LengthLimitingTextInputFormatter(12)
                            ],
                            obscureText: true,
                            textAlign: TextAlign.center,
                            style: const TextStyle(
                                fontSize: 22, fontWeight: FontWeight.w700),
                            decoration: const InputDecoration(
                              labelText: 'Κωδικος υπαλληλου',
                              border: OutlineInputBorder(),
                            ),
                            onSubmitted: (_) => _submit(),
                          ),
                          const SizedBox(height: 12),
                          ExcludeFocus(child: _buildKeypad()),
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
                                      child: CircularProgressIndicator(
                                          strokeWidth: 3),
                                    )
                                  : const Text('Εναρξη',
                                      style: TextStyle(
                                          fontSize: 20,
                                          fontWeight: FontWeight.w700)),
                            ),
                          ),
                          TextButton(
                            onPressed: _checking ? null : widget.onActivate,
                            child: const Text(
                                'Ενεργοποίηση με λογαριασμό διαχειριστή'),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
              const Positioned(
                top: 12,
                right: 12,
                child: FullscreenToggleButton(),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
