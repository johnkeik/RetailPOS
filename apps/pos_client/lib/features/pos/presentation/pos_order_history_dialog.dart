import 'dart:async';

import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';

import '../data/pos_order_repository.dart';
import '../models/pos_models.dart';

class _OrderCancellationDialog extends StatefulWidget {
  const _OrderCancellationDialog({required this.order});

  final PosOrder order;

  @override
  State<_OrderCancellationDialog> createState() => _OrderCancellationDialogState();
}

class _OrderCancellationDialogState extends State<_OrderCancellationDialog> {
  final _pinController = TextEditingController();
  final _reasonController = TextEditingController();
  String? _formError;

  @override
  void dispose() {
    _pinController.dispose();
    _reasonController.dispose();
    super.dispose();
  }

  void _submit() {
    final managerPin = _pinController.text.trim();
    final reason = _reasonController.text.trim();
    if (!RegExp(r'^\d{6}$').hasMatch(managerPin)) {
      setState(() => _formError = 'Ο κωδικός manager πρέπει να έχει 6 ψηφία.');
      return;
    }
    if (reason.isEmpty) {
      setState(() => _formError = 'Συμπληρώστε την αιτία ακύρωσης.');
      return;
    }
    Navigator.of(context).pop((managerPin: managerPin, reason: reason));
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Ακύρωση παραγγελίας'),
      content: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Παραγγελία ${widget.order.id} · ${widget.order.total.toStringAsFixed(2)} €'),
            const SizedBox(height: 16),
            TextField(
              controller: _pinController,
              autofocus: true,
              keyboardType: TextInputType.number,
              obscureText: true,
              maxLength: 6,
              decoration: const InputDecoration(
                labelText: '6ψήφιος κωδικός manager',
                border: OutlineInputBorder(),
                counterText: '',
              ),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: _reasonController,
              maxLength: 200,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                labelText: 'Αιτία ακύρωσης',
                hintText: 'π.χ. Λάθος προϊόν ή ποσότητα',
                border: OutlineInputBorder(),
              ),
            ),
            if (_formError != null) ...[
              const SizedBox(height: 8),
              Text(_formError!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Πίσω'),
        ),
        FilledButton.icon(
          onPressed: _submit,
          icon: const Icon(Icons.cancel_outlined),
          label: const Text('Επιβεβαίωση ακύρωσης'),
        ),
      ],
    );
  }
}

class PosOrderHistoryDialog extends StatefulWidget {
  const PosOrderHistoryDialog({
    super.key,
    required this.repository,
    required this.tenantId,
    required this.employeeId,
  });

  final PosOrderRepository repository;
  final String tenantId;
  final String employeeId;

  @override
  State<PosOrderHistoryDialog> createState() => _PosOrderHistoryDialogState();
}

class _PosOrderHistoryDialogState extends State<PosOrderHistoryDialog> {
  late Future<List<PosOrder>> _ordersFuture;
  String? _printingKey;
  String? _cancellingOrderId;

  @override
  void initState() {
    super.initState();
    _ordersFuture =
        widget.repository.loadRecentOrders(tenantId: widget.tenantId);
  }

  Future<void> _reload() async {
    setState(() {
      _ordersFuture =
          widget.repository.loadRecentOrders(tenantId: widget.tenantId);
    });
  }

  Future<void> _simulatePrint(String key, String target) async {
    if (_printingKey != null) return;
    setState(() => _printingKey = key);
    await Future<void>.delayed(const Duration(seconds: 5));
    if (!mounted) return;
    setState(() => _printingKey = null);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('Ολοκληρώθηκε η δοκιμαστική εκτύπωση: $target')),
    );
  }

  Future<({String managerPin, String reason})?> _requestCancellationDetails(
      PosOrder order) async {
    return showDialog<({String managerPin, String reason})>(
      context: context,
      builder: (_) => _OrderCancellationDialog(order: order),
    );
  }

  Future<void> _cancelOrder(PosOrder order) async {
    final details = await _requestCancellationDetails(order);
    if (details == null || !mounted) return;

    setState(() => _cancellingOrderId = order.id);
    try {
      await widget.repository.cancelOrder(
        tenantId: widget.tenantId,
        employeeId: widget.employeeId,
        orderId: order.id,
        managerPin: details.managerPin,
        reason: details.reason,
      );
      await _reload();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Η παραγγελία ακυρώθηκε και το απόθεμα ενημερώθηκε.')),
      );
    } on FirebaseFunctionsException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message ?? 'Δεν ήταν δυνατή η ακύρωση της παραγγελίας.')),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Δεν ήταν δυνατή η ακύρωση της παραγγελίας.')),
      );
    } finally {
      if (mounted) setState(() => _cancellingOrderId = null);
    }
  }

  String _formatDate(DateTime? date) {
    if (date == null) return 'Ημερομηνία μη διαθέσιμη';
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} '
        '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final maxHeight = MediaQuery.sizeOf(context).height * 0.86;

    return Dialog(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: 980, maxHeight: maxHeight),
        child: SizedBox(
          width: 900,
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Row(
                  children: [
                    const Expanded(
                      child: Text(
                        'Ιστορικό παραγγελιών',
                        style: TextStyle(
                            fontSize: 24, fontWeight: FontWeight.w700),
                      ),
                    ),
                    IconButton(
                      tooltip: 'Ανανέωση ιστορικού',
                      onPressed: _reload,
                      icon: const Icon(Icons.refresh),
                    ),
                    IconButton(
                      tooltip: 'Κλείσιμο',
                      onPressed: () => Navigator.of(context).pop(),
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: FutureBuilder<List<PosOrder>>(
                    future: _ordersFuture,
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
                                  'Δεν ήταν δυνατή η φόρτωση του ιστορικού.'),
                              const SizedBox(height: 12),
                              FilledButton.tonal(
                                  onPressed: _reload,
                                  child: const Text('Δοκιμή ξανά')),
                            ],
                          ),
                        );
                      }

                      final orders = snapshot.data ?? const <PosOrder>[];
                      if (orders.isEmpty) {
                        return const Center(
                            child: Text(
                                'Δεν υπάρχουν καταχωρημένες παραγγελίες.'));
                      }

                      return ListView.separated(
                        itemCount: orders.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 10),
                        itemBuilder: (context, index) {
                          final order = orders[index];
                          final orderPrintKey = 'order-${order.id}';
                          return Card(
                            margin: EdgeInsets.zero,
                            child: Padding(
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Wrap(
                                    alignment: WrapAlignment.spaceBetween,
                                    crossAxisAlignment:
                                        WrapCrossAlignment.center,
                                    spacing: 12,
                                    runSpacing: 8,
                                    children: [
                                      Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text('Παραγγελία ${order.id}',
                                              style: const TextStyle(
                                                  fontWeight: FontWeight.w700)),
                                          Text(
                                            '${_formatDate(order.createdAt)} · Υπάλληλος ${order.employeeId} · ${order.total.toStringAsFixed(2)} €',
                                            style: TextStyle(
                                                color: colors.onSurfaceVariant),
                                          ),
                                          const SizedBox(height: 6),
                                          DecoratedBox(
                                            decoration: BoxDecoration(
                                              color: order.status == 'CANCELLED'
                                                  ? colors.errorContainer
                                                  : colors.primaryContainer,
                                              borderRadius: BorderRadius.circular(5),
                                            ),
                                            child: Padding(
                                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                              child: Text(
                                                order.status == 'CANCELLED' ? 'ΑΚΥΡΩΜΕΝΗ' : 'ΟΛΟΚΛΗΡΩΜΕΝΗ',
                                                style: TextStyle(
                                                  fontSize: 11,
                                                  fontWeight: FontWeight.w700,
                                                  color: order.status == 'CANCELLED'
                                                      ? colors.onErrorContainer
                                                      : colors.onPrimaryContainer,
                                                ),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      FilledButton.tonalIcon(
                                        onPressed: _printingKey == null
                                            ? () => _simulatePrint(
                                                orderPrintKey,
                                                'παραγγελία ${order.id}')
                                            : null,
                                        icon: _printingKey == orderPrintKey
                                            ? const SizedBox(
                                                width: 18,
                                                height: 18,
                                                child:
                                                    CircularProgressIndicator(
                                                        strokeWidth: 2))
                                            : const Icon(Icons.print),
                                        label: Text(
                                            _printingKey == orderPrintKey
                                                ? 'Εκτύπωση…'
                                                : 'Εκτύπωση παραγγελίας'),
                                      ),
                                      if (order.status == 'COMPLETED' && !order.isSeeded)
                                        OutlinedButton.icon(
                                          onPressed: _printingKey == null && _cancellingOrderId == null
                                              ? () => _cancelOrder(order)
                                              : null,
                                          icon: _cancellingOrderId == order.id
                                              ? const SizedBox(
                                                  width: 18,
                                                  height: 18,
                                                  child: CircularProgressIndicator(strokeWidth: 2))
                                              : const Icon(Icons.cancel_outlined),
                                          label: Text(_cancellingOrderId == order.id ? 'Ακύρωση…' : 'Ακύρωση'),
                                        ),
                                    ],
                                  ),
                                  if (order.cancellationReason != null) ...[
                                    const SizedBox(height: 8),
                                    Text('Αιτία ακύρωσης: ${order.cancellationReason}',
                                        style: TextStyle(color: colors.error)),
                                  ],
                                  const Divider(height: 20),
                                  for (final item in order.items)
                                    Padding(
                                      padding: const EdgeInsets.symmetric(
                                          vertical: 4),
                                      child: Row(
                                        children: [
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  '${item.productCode} · ${item.productName.isEmpty ? 'Προϊόν' : item.productName}',
                                                  style: const TextStyle(
                                                      fontWeight:
                                                          FontWeight.w600),
                                                ),
                                                Text(
                                                  '${item.variantCode}${item.variantLabel.isEmpty ? '' : ' · ${item.variantLabel}'}${item.useSpecialBottle ? ' · ✨ Special Μπουκάλι' : ''} · ${item.quantity} τεμ.',
                                                  style: TextStyle(
                                                      color: colors.onSurfaceVariant),
                                                ),
                                              ],
                                            ),
                                          ),
                                          IconButton(
                                            tooltip:
                                                'Εκτύπωση κωδικού ${item.variantCode}',
                                            onPressed: _printingKey == null
                                                ? () => _simulatePrint(
                                                      'item-${order.id}-${item.variantCode}',
                                                      'κωδικός ${item.variantCode}',
                                                    )
                                                : null,
                                            icon: _printingKey ==
                                                    'item-${order.id}-${item.variantCode}'
                                                ? const SizedBox(
                                                    width: 20,
                                                    height: 20,
                                                    child:
                                                        CircularProgressIndicator(
                                                            strokeWidth: 2))
                                                : const Icon(Icons.print),
                                          ),
                                        ],
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
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
