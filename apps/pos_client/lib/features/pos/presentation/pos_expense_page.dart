import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';

import '../data/pos_order_repository.dart';
import '../models/pos_models.dart';
import 'on_screen_keyboard.dart';

class PosExpensePage extends StatefulWidget {
  const PosExpensePage({
    super.key,
    required this.repository,
    required this.tenantId,
    required this.employeeId,
    required this.employeeName,
  });

  final PosOrderRepository repository;
  final String tenantId;
  final String employeeId;
  final String employeeName;

  @override
  State<PosExpensePage> createState() => _PosExpensePageState();
}

class _PosExpensePageState extends State<PosExpensePage> {
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  late TextEditingController _active = _amountController;
  PaymentMethod _method = PaymentMethod.cash;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  bool get _amountActive => identical(_active, _amountController);

  void _insert(String text) {
    final c = _active;
    final sel = c.selection;
    final start = sel.isValid ? sel.start : c.text.length;
    final end = sel.isValid ? sel.end : c.text.length;
    final next = c.text.replaceRange(start, end, text);
    if (_amountActive && !RegExp(r'^\d{0,6}([.,]\d{0,2})?$').hasMatch(next)) {
      return;
    }
    if (!_amountActive && next.length > 300) return;
    c.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: start + text.length),
    );
    setState(() => _error = null);
  }

  void _backspace() {
    final c = _active;
    final sel = c.selection;
    final start = sel.isValid ? sel.start : c.text.length;
    final end = sel.isValid ? sel.end : c.text.length;
    if (start != end) {
      c.value = TextEditingValue(
        text: c.text.replaceRange(start, end, ''),
        selection: TextSelection.collapsed(offset: start),
      );
    } else if (start > 0) {
      c.value = TextEditingValue(
        text: c.text.replaceRange(start - 1, start, ''),
        selection: TextSelection.collapsed(offset: start - 1),
      );
    }
  }

  Future<void> _submit() async {
    final amount =
        double.tryParse(_amountController.text.replaceAll(',', '.').trim());
    final description = _descriptionController.text.trim();
    if (amount == null || amount <= 0) {
      setState(() => _error = 'Συμπληρώστε έγκυρο ποσό.');
      return;
    }
    if (description.isEmpty) {
      setState(() => _error = 'Συμπληρώστε περιγραφή.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });
    try {
      await widget.repository.submitExpense(
        tenantId: widget.tenantId,
        employeeId: widget.employeeId,
        amount: amount,
        paymentMethod: _method,
        description: description,
      );
      if (mounted) Navigator.of(context).pop(true);
    } on FirebaseFunctionsException catch (error) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = error.message ?? 'Αποτυχία καταχώρησης εξόδου.';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _submitting = false;
        _error = 'Αποτυχία καταχώρησης εξόδου. Ελέγξτε τη σύνδεση.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final keyboardHeight = MediaQuery.of(context).size.height * 0.46;

    return Scaffold(
      appBar: AppBar(
        title: Text('Καταχώρηση εξόδου · ${widget.employeeName}'),
        leadingWidth: 72,
      ),
      body: Column(
        children: [
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _amountController,
                    readOnly: true,
                    showCursor: true,
                    autofocus: true,
                    onTap: () => setState(() => _active = _amountController),
                    style: const TextStyle(
                        fontSize: 28, fontWeight: FontWeight.w700),
                    decoration: InputDecoration(
                      labelText: 'Ποσό',
                      suffixText: '€',
                      border: const OutlineInputBorder(),
                      enabledBorder: OutlineInputBorder(
                        borderSide: BorderSide(
                            color: _amountActive
                                ? colors.primary
                                : colors.outline,
                            width: _amountActive ? 2 : 1),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      for (final method in const [PaymentMethod.cash, PaymentMethod.card]) ...[
                        if (method == PaymentMethod.card)
                          const SizedBox(width: 12),
                        Expanded(
                          child: Semantics(
                            selected: _method == method,
                            child: OutlinedButton.icon(
                              key: ValueKey('expense-payment-${method.name}'),
                              style: OutlinedButton.styleFrom(
                                minimumSize: const Size(56, 64),
                                backgroundColor: _method == method ? colors.secondary : colors.surface,
                                foregroundColor: _method == method ? colors.onSecondary : colors.onSurface,
                                textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
                              ),
                              onPressed: _submitting ? null : () => setState(() => _method = method),
                              icon: Icon(method == PaymentMethod.cash ? Icons.payments_outlined : Icons.credit_card),
                              label: Text(method == PaymentMethod.cash ? 'Μετρητά' : 'Κάρτα'),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _descriptionController,
                    readOnly: true,
                    showCursor: true,
                    minLines: 3,
                    maxLines: 3,
                    onTap: () =>
                        setState(() => _active = _descriptionController),
                    decoration: InputDecoration(
                      labelText: 'Περιγραφή',
                      hintText: 'π.χ. Καθαριστικά',
                      border: const OutlineInputBorder(),
                      enabledBorder: OutlineInputBorder(
                        borderSide: BorderSide(
                            color: _amountActive
                                ? colors.outline
                                : colors.primary,
                            width: _amountActive ? 1 : 2),
                      ),
                    ),
                  ),

                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (_error != null) ...[
                  Text(_error!, style: TextStyle(color: colors.error)),
                  const SizedBox(height: 8),
                ],
                FilledButton.icon(
                  style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(64)),
                  onPressed: _submitting ? null : _submit,
                  icon: const Icon(Icons.check),
                  label: Text(_submitting ? 'Καταχώρηση...' : 'Καταχώρηση'),
                ),
              ],
            ),
          ),
          SizedBox(
            height: keyboardHeight,
            child: _amountActive
                ? OnScreenNumpad(onText: _insert, onBackspace: _backspace)
                : OnScreenKeyboard(onText: _insert, onBackspace: _backspace),
          ),
        ],
      ),
    );
  }
}
