import 'dart:async';

import 'package:cloud_functions/cloud_functions.dart';
import 'package:flutter/material.dart';

import '../data/label_print_service.dart';
import '../data/pos_order_repository.dart';
import '../models/pos_models.dart';

String _historyDate(DateTime? value) {
  if (value == null) return 'Χωρίς ημερομηνία';
  final date = value.toLocal();
  return '${date.day.toString().padLeft(2, '0')}/'
      '${date.month.toString().padLeft(2, '0')}/${date.year} · '
      '${date.hour.toString().padLeft(2, '0')}:'
      '${date.minute.toString().padLeft(2, '0')}';
}

String _historyAmount(double value) =>
    '${value.toStringAsFixed(2).replaceAll('.', ',')} €';

class _OrderCancellationDialog extends StatelessWidget {
  const _OrderCancellationDialog({required this.order});

  final PosOrder order;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Ακύρωση παραγγελίας'),
      content: Text(
        'Θέλετε να ακυρώσετε την πώληση της '
        '${_historyDate(order.createdAt)} '
        'με ποσό ${_historyAmount(order.total)};\n\n'
        'Οι ποσότητες και τα αναλώσιμα θα επιστραφούν στο απόθεμα.',
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.of(context).pop(false),
          child: const Text('Όχι'),
        ),
        FilledButton.icon(
          onPressed: () => Navigator.of(context).pop(true),
          icon: const Icon(Icons.delete_outline),
          label: const Text('Ναι, ακύρωση'),
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
    required this.labelPrinter,
    required this.products,
  });

  final PosOrderRepository repository;
  final String tenantId;
  final String employeeId;
  final LabelPrintService labelPrinter;
  final List<ProductItem> products;

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
        widget.repository.loadTodayOrders(tenantId: widget.tenantId);
  }

  Future<void> _reload() async {
    setState(() {
      _ordersFuture =
          widget.repository.loadTodayOrders(tenantId: widget.tenantId);
    });
  }

  Future<void> _print(
      String key, String orderId, List<PosOrderItem> items, String target) async {
    if (_printingKey != null) return;
    setState(() => _printingKey = key);

    // Ingredients are not stored on orders; use the current catalog.
    final productsByKey = {
      for (final product in widget.products) product.id: product,
      for (final product in widget.products) product.code: product,
    };
    final result = await widget.labelPrinter.printItems(
      orderId: orderId,
      items: [
        for (final item in items)
          LabelPrintItem(
            productCode: productsByKey[item.productCode]?.code ?? item.productCode,
            ingredients: productsByKey[item.productCode]?.ingredients ?? '',
            quantity: item.quantity,
          ),
      ],
    );

    if (!mounted) return;
    setState(() => _printingKey = null);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(result.ok
            ? '$target: ${result.message}'
            : 'Αποτυχία εκτύπωσης ($target): ${result.message}'),
      ),
    );
  }

  ProductItem? _catalogProduct(PosOrderItem item) {
    for (final product in widget.products) {
      if (product.id == item.productCode || product.code == item.productCode) {
        return product;
      }
    }
    return null;
  }

  String _productName(PosOrderItem item) {
    if (item.productName.trim().isNotEmpty) return item.productName;
    final name = _catalogProduct(item)?.name.trim() ?? '';
    return name.isEmpty ? 'Μη διαθέσιμο προϊόν' : name;
  }

  String _variantName(PosOrderItem item) {
    if (item.variantLabel.trim().isNotEmpty) return item.variantLabel;
    for (final variant in _catalogProduct(item)?.variants ?? <ProductVariant>[]) {
      if (variant.id == item.variantCode || variant.code == item.variantCode) {
        if (variant.name.trim().isNotEmpty) return variant.name;
        if (variant.label.trim().isNotEmpty) return variant.label;
      }
    }
    return 'Παραλλαγή μη διαθέσιμη';
  }

  String _itemKey(PosOrder order, PosOrderItem item) =>
      'item-${order.id}-${item.productCode}-${item.variantCode}-${item.useSpecialBottle}';

  Future<bool?> _confirmCancellation(
      PosOrder order) async {
    return showDialog<bool>(
      context: context,
      builder: (_) => _OrderCancellationDialog(order: order),
    );
  }

  Future<void> _cancelOrder(PosOrder order) async {
    final confirmed = await _confirmCancellation(order);
    if (confirmed != true || !mounted) return;

    setState(() => _cancellingOrderId = order.id);
    try {
      await widget.repository.cancelOrder(
        tenantId: widget.tenantId,
        employeeId: widget.employeeId,
        orderId: order.id,
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
                        'Σημερινές παραγγελίες',
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
                const SizedBox(height: 4),
                Text(
                  'Εμφανίζονται έως 50 εγγραφές της σημερινής ημέρας.',
                  style: TextStyle(color: colors.onSurfaceVariant),
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

                      final orders = (snapshot.data ?? const <PosOrder>[])
                          .where((order) => order.status != 'DELETED')
                          .toList();
                      if (orders.isEmpty) {
                        return const Center(
                            child: Text(
                                'Δεν υπάρχουν παραγγελίες για σήμερα.'));
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
                                      ConstrainedBox(
                                        constraints: const BoxConstraints(maxWidth: 460),
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Row(
                                              children: [
                                                Icon(
                                                  Icons.receipt_long_outlined,
                                                  color: order.status == 'COMPLETED'
                                                      ? colors.primary
                                                      : colors.error,
                                                ),
                                                const SizedBox(width: 10),
                                                Expanded(
                                                  child: Text(
                                                    'Πώληση · ${_historyDate(order.createdAt)}',
                                                    style: const TextStyle(
                                                      fontSize: 16,
                                                      fontWeight: FontWeight.w700,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            const SizedBox(height: 10),
                                            Text(
                                              _historyAmount(order.total),
                                              style: TextStyle(
                                                fontSize: 26,
                                                fontWeight: FontWeight.w800,
                                                color: colors.onSurface,
                                              ),
                                            ),
                                            const SizedBox(height: 8),
                                            Wrap(
                                              spacing: 14,
                                              runSpacing: 6,
                                              children: [
                                                _HistoryDetail(
                                                  icon: Icons.person_outline,
                                                  text: order.employeeName.trim().isEmpty
                                                      ? 'Υπάλληλος'
                                                      : order.employeeName,
                                                ),
                                                _HistoryDetail(
                                                  icon: Icons.shopping_bag_outlined,
                                                  text: '${order.items.fold<int>(0, (sum, item) => sum + item.quantity)} τεμ.',
                                                ),
                                                if (order.paymentMethod != null)
                                                  _HistoryDetail(
                                                    icon: order.paymentMethod == PaymentMethod.card
                                                        ? Icons.credit_card
                                                        : Icons.payments_outlined,
                                                    text: order.paymentMethod == PaymentMethod.card
                                                        ? 'Κάρτα'
                                                        : 'Μετρητά',
                                                  ),
                                              ],
                                            ),
                                            const SizedBox(height: 10),
                                            DecoratedBox(
                                              decoration: BoxDecoration(
                                                color: order.status != 'COMPLETED'
                                                    ? colors.errorContainer
                                                    : colors.primaryContainer,
                                                borderRadius: BorderRadius.circular(20),
                                              ),
                                              child: Padding(
                                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                                child: Text(
                                                  order.status == 'CANCELLED'
                                                      ? 'ΑΚΥΡΩΜΕΝΗ'
                                                      : 'ΟΛΟΚΛΗΡΩΜΕΝΗ',
                                                  style: TextStyle(
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.w700,
                                                    color: order.status != 'COMPLETED'
                                                        ? colors.onErrorContainer
                                                        : colors.onPrimaryContainer,
                                                  ),
                                                ),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      FilledButton.tonalIcon(
                                        onPressed: _printingKey == null
                                            ? () => _print(
                                                orderPrintKey,
                                                order.id,
                                                order.items,
                                                'πώληση της ${_historyDate(order.createdAt)}')
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
                                  if (order.status == 'CANCELLED') ...[
                                    const SizedBox(height: 10),
                                    Text(
                                      'Ακυρώθηκε ${order.cancelledAt == null ? 'σε άγνωστη ημερομηνία' : 'στις ${_historyDate(order.cancelledAt)}'}'
                                      ' · Από: ${order.cancelledByEmployeeName?.trim().isNotEmpty == true ? order.cancelledByEmployeeName : 'Μη διαθέσιμο όνομα'}',
                                      style: TextStyle(color: colors.error),
                                    ),
                                  ],
                                  if (order.cancellationReason != null) ...[
                                    const SizedBox(height: 8),
                                    Text('Αιτία ακύρωσης: ${order.cancellationReason}',
                                        style: TextStyle(color: colors.error)),
                                  ],
                                  const Divider(height: 20),
                                  for (final item in order.items)
                                    Container(
                                      margin: const EdgeInsets.only(bottom: 8),
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: colors.surfaceContainerLow,
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                            decoration: BoxDecoration(
                                              color: colors.secondaryContainer,
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            child: Text(
                                              '×${item.quantity}',
                                              style: TextStyle(
                                                fontWeight: FontWeight.w700,
                                                color: colors.onSecondaryContainer,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(width: 12),
                                          Expanded(
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  _productName(item),
                                                  style: const TextStyle(fontWeight: FontWeight.w700),
                                                ),
                                                const SizedBox(height: 4),
                                                Text(
                                                  _variantName(item),
                                                  style: TextStyle(color: colors.onSurfaceVariant),
                                                ),
                                                if (item.useSpecialBottle)
                                                  Padding(
                                                    padding: const EdgeInsets.only(top: 4),
                                                    child: Text(
                                                      '✨ Special Μπουκάλι',
                                                      style: TextStyle(color: colors.primary),
                                                    ),
                                                  ),
                                              ],
                                            ),
                                          ),
                                          const SizedBox(width: 10),
                                          Column(
                                            crossAxisAlignment: CrossAxisAlignment.end,
                                            children: [
                                              Text(
                                                _historyAmount(item.unitPrice * item.quantity),
                                                style: const TextStyle(fontWeight: FontWeight.w700),
                                              ),
                                              Text(
                                                '${_historyAmount(item.unitPrice)} / τεμ.',
                                                style: TextStyle(fontSize: 11, color: colors.onSurfaceVariant),
                                              ),
                                            ],
                                          ),
                                          IconButton(
                                            tooltip: 'Εκτύπωση ${_productName(item)}',
                                            onPressed: _printingKey == null
                                                ? () => _print(
                                                      _itemKey(order, item),
                                                      order.id,
                                                      [item],
                                                      _productName(item),
                                                    )
                                                : null,
                                            icon: _printingKey == _itemKey(order, item)
                                                ? const SizedBox(
                                                    width: 20,
                                                    height: 20,
                                                    child: CircularProgressIndicator(strokeWidth: 2))
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

class _HistoryDetail extends StatelessWidget {
  const _HistoryDetail({required this.icon, required this.text});

  final IconData icon;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 16, color: Theme.of(context).colorScheme.onSurfaceVariant),
        const SizedBox(width: 5),
        Flexible(child: Text(text)),
      ],
    );
  }
}
