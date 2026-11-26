import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';

import '../data/pos_order_repository.dart';
import '../models/pos_models.dart';
import 'pos_expense_page.dart';

String _expenseTime(DateTime? value) {
  if (value == null) return '--:--';
  final date = value.toLocal();
  return '${date.hour.toString().padLeft(2, '0')}:'
      '${date.minute.toString().padLeft(2, '0')}';
}

String _expenseAmount(double value) =>
    '${value.toStringAsFixed(2).replaceAll('.', ',')} €';

/// Today's expenses of the logged-in employee, with edit and void actions.
class PosExpenseHistoryDialog extends StatefulWidget {
  const PosExpenseHistoryDialog({
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
  State<PosExpenseHistoryDialog> createState() =>
      _PosExpenseHistoryDialogState();
}

class _PosExpenseHistoryDialogState extends State<PosExpenseHistoryDialog> {
  late Future<List<PosExpense>> _expensesFuture = _load();
  String? _voidingId;

  Future<List<PosExpense>> _load() => widget.repository.loadTodayExpenses(
        tenantId: widget.tenantId,
        employeeId: widget.employeeId,
      );

  void _reload() => setState(() => _expensesFuture = _load());

  void _showMessage(String message) {
    ScaffoldMessenger.of(context)
        .showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _edit(PosExpense expense) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => PosExpensePage(
          repository: widget.repository,
          tenantId: widget.tenantId,
          employeeId: widget.employeeId,
          employeeName: widget.employeeName,
          expense: expense,
        ),
      ),
    );
    if (saved == true && mounted) {
      _reload();
      _showMessage('Οι αλλαγές αποθηκεύτηκαν.');
    }
  }

  Future<void> _void(PosExpense expense) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Ακύρωση εξόδου'),
        content: Text(
          'Θέλετε να ακυρώσετε το έξοδο "${expense.description}" '
          'των ${_expenseAmount(expense.amount)};\n\n'
          'Θα παραμείνει στο ιστορικό ως ακυρωμένο.',
        ),
        actionsOverflowButtonSpacing: 8,
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: const Text('Όχι'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            icon: const Icon(Icons.delete_outline),
            label: const Text('Ναι, ακύρωση'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _voidingId = expense.id);
    try {
      await widget.repository.voidExpense(
        tenantId: widget.tenantId,
        employeeId: widget.employeeId,
        expenseId: expense.id,
      );
      if (!mounted) return;
      _reload();
      _showMessage('Το έξοδο ακυρώθηκε.');
    } on FirebaseFunctionsException catch (error) {
      if (mounted) {
        _showMessage(error.message ?? 'Δεν ήταν δυνατή η ακύρωση του εξόδου.');
      }
    } catch (_) {
      if (mounted) _showMessage('Δεν ήταν δυνατή η ακύρωση του εξόδου.');
    } finally {
      if (mounted) setState(() => _voidingId = null);
    }
  }

  Widget _totalTile(String label, double value, ColorScheme colors) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: colors.surfaceContainerHighest.withOpacity(0.5),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label,
                style: TextStyle(fontSize: 13, color: colors.onSurfaceVariant)),
            const SizedBox(height: 2),
            Text(_expenseAmount(value),
                style:
                    const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }

  Widget _expenseRow(PosExpense expense, ColorScheme colors) {
    final muted = expense.voided;
    final textColor = muted ? colors.onSurfaceVariant : colors.onSurface;
    final strike = muted ? TextDecoration.lineThrough : null;
    final busy = _voidingId != null;

    return Card(
      margin: EdgeInsets.zero,
      color: muted ? colors.surfaceContainerHighest.withOpacity(0.4) : null,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 10, 8, 10),
        child: Row(
          children: [
            SizedBox(
              width: 56,
              child: Text(_expenseTime(expense.createdAt),
                  style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w600,
                      color: textColor)),
            ),
            Icon(
              expense.paymentMethod == PaymentMethod.cash
                  ? Icons.payments_outlined
                  : Icons.credit_card,
              color: textColor,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    expense.description,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                        fontSize: 16, color: textColor, decoration: strike),
                  ),
                  if (muted || expense.edited)
                    Padding(
                      padding: const EdgeInsets.only(top: 2),
                      child: Text(
                        muted ? 'Ακυρώθηκε' : 'Τροποποιήθηκε',
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: muted ? colors.error : colors.tertiary,
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(
              _expenseAmount(expense.amount),
              style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w800,
                  color: textColor,
                  decoration: strike),
            ),
            const SizedBox(width: 8),
            if (!muted) ...[
              IconButton(
                tooltip: 'Επεξεργασία',
                iconSize: 26,
                constraints: const BoxConstraints.tightFor(width: 56, height: 56),
                onPressed: busy ? null : () => _edit(expense),
                icon: const Icon(Icons.edit_outlined),
              ),
              _voidingId == expense.id
                  ? const SizedBox(
                      width: 56,
                      height: 56,
                      child: Center(
                        child: SizedBox(
                            width: 22,
                            height: 22,
                            child: CircularProgressIndicator(strokeWidth: 2.5)),
                      ),
                    )
                  : IconButton(
                      tooltip: 'Ακύρωση',
                      iconSize: 26,
                      color: colors.error,
                      constraints:
                          const BoxConstraints.tightFor(width: 56, height: 56),
                      onPressed: busy ? null : () => _void(expense),
                      icon: const Icon(Icons.delete_outline),
                    ),
            ] else
              const SizedBox(width: 112),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final maxHeight = MediaQuery.sizeOf(context).height * 0.86;

    return Dialog(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: 820, maxHeight: maxHeight),
        child: SizedBox(
          width: 760,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Σημερινά έξοδα',
                        style: TextStyle(
                            fontSize: 24, fontWeight: FontWeight.w700),
                      ),
                    ),
                    IconButton.outlined(
                      tooltip: 'Ανανέωση',
                      onPressed: _reload,
                      icon: const Icon(Icons.refresh),
                    ),
                    const SizedBox(width: 8),
                    IconButton.outlined(
                      tooltip: 'Κλείσιμο',
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  'Έξοδα που καταχωρήσατε σήμερα · ${widget.employeeName}',
                  style: TextStyle(color: colors.onSurfaceVariant),
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: FutureBuilder<List<PosExpense>>(
                    future: _expensesFuture,
                    builder: (context, snapshot) {
                      if (snapshot.connectionState == ConnectionState.waiting) {
                        return const Center(child: CircularProgressIndicator());
                      }
                      if (snapshot.hasError) {
                        return Center(
                          child: Column(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                  'Δεν ήταν δυνατή η φόρτωση των εξόδων.'),
                              const SizedBox(height: 12),
                              FilledButton.tonal(
                                  onPressed: _reload,
                                  child: const Text('Δοκιμή ξανά')),
                            ],
                          ),
                        );
                      }

                      final expenses = snapshot.data ?? const <PosExpense>[];
                      final active = expenses.where((item) => !item.voided);
                      double sum(bool Function(PosExpense) test) => active
                          .where(test)
                          .fold(0.0, (total, item) => total + item.amount);

                      return Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Row(
                            children: [
                              _totalTile('Σύνολο', sum((_) => true), colors),
                              const SizedBox(width: 10),
                              _totalTile(
                                  'Μετρητά',
                                  sum((item) =>
                                      item.paymentMethod == PaymentMethod.cash),
                                  colors),
                              const SizedBox(width: 10),
                              _totalTile(
                                  'Κάρτα',
                                  sum((item) =>
                                      item.paymentMethod == PaymentMethod.card),
                                  colors),
                            ],
                          ),
                          const SizedBox(height: 12),
                          Expanded(
                            child: expenses.isEmpty
                                ? const Center(
                                    child: Text(
                                        'Δεν έχετε καταχωρήσει έξοδα σήμερα.'))
                                : ListView.separated(
                                    itemCount: expenses.length,
                                    separatorBuilder: (_, __) =>
                                        const SizedBox(height: 8),
                                    itemBuilder: (context, index) =>
                                        _expenseRow(expenses[index], colors),
                                  ),
                          ),
                        ],
                      );
                    },
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
