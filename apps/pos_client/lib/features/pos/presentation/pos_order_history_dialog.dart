import 'dart:async';

import 'package:flutter/material.dart';

import '../data/pos_order_repository.dart';
import '../models/pos_models.dart';

class PosOrderHistoryDialog extends StatefulWidget {
  const PosOrderHistoryDialog({
    super.key,
    required this.repository,
    required this.tenantId,
  });

  final PosOrderRepository repository;
  final String tenantId;

  @override
  State<PosOrderHistoryDialog> createState() => _PosOrderHistoryDialogState();
}

class _PosOrderHistoryDialogState extends State<PosOrderHistoryDialog> {
  late Future<List<PosOrder>> _ordersFuture;
  String? _printingKey;

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
                                'Δεν υπάρχουν ολοκληρωμένες παραγγελίες.'));
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
                                    ],
                                  ),
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
