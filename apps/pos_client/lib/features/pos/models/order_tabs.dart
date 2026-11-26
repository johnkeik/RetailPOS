import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'pos_models.dart';

/// One open order on the POS: its own cart and payment method.
class OrderTab {
  OrderTab({
    required this.number,
    List<CartLine>? lines,
    this.paymentMethod = PaymentMethod.cash,
    DateTime? createdAt,
  })  : lines = lines ?? <CartLine>[],
        createdAt = createdAt ?? DateTime.now();

  /// Shown as "Παραγγελία {number}".
  final int number;
  final List<CartLine> lines;
  PaymentMethod paymentMethod;
  final DateTime createdAt;

  int get itemCount => lines.fold(0, (sum, line) => sum + line.quantity);
}

const maxOrderTabs = 6;

/// The lowest tab number not already in use, so numbering restarts at 1.
int nextOrderTabNumber(Iterable<OrderTab> tabs) {
  final used = tabs.map((tab) => tab.number).toSet();
  var number = 1;
  while (used.contains(number)) {
    number++;
  }
  return number;
}

/// Re-points every line at the current catalog so prices stay current.
/// Lines whose product or variant no longer exists are removed and returned.
List<String> rebindOrderTabs(List<OrderTab> tabs, List<ProductItem> products) {
  final dropped = <String>[];
  for (final tab in tabs) {
    for (var index = tab.lines.length - 1; index >= 0; index--) {
      final line = tab.lines[index];
      final rebound = _findLine(products, line.product.id, line.variant.id,
          line.quantity, line.useSpecialBottle);
      if (rebound == null) {
        dropped.add('${line.product.name} ${line.variant.name}'.trim());
        tab.lines.removeAt(index);
      } else {
        tab.lines[index] = rebound;
      }
    }
  }
  return dropped;
}

CartLine? _findLine(List<ProductItem> products, String productId,
    String variantId, int quantity, bool useSpecialBottle) {
  for (final product in products) {
    if (product.id != productId) continue;
    for (final variant in product.variants) {
      if (variant.id != variantId) continue;
      return CartLine(
        product: product,
        variant: variant,
        quantity: quantity,
        useSpecialBottle: useSpecialBottle && variant.hasSpecialBottle,
      );
    }
  }
  return null;
}

class RestoredOrderTabs {
  const RestoredOrderTabs(this.tabs, this.activeIndex, this.droppedCount);

  final List<OrderTab> tabs;
  final int activeIndex;

  /// Saved items whose product is no longer in the catalog.
  final int droppedCount;
}

/// Saves open tabs on this device so a restart or crash keeps them.
/// Tabs only live for the day they were opened.
class OrderTabsStore {
  OrderTabsStore(String tenantId) : _key = 'pos.orderTabs.$tenantId';

  final String _key;

  Future<void> save(List<OrderTab> tabs, int activeIndex) async {
    final data = {
      'activeIndex': activeIndex,
      'tabs': [
        for (final tab in tabs)
          {
            'number': tab.number,
            'paymentMethod': tab.paymentMethod.wireValue,
            'createdAt': tab.createdAt.millisecondsSinceEpoch,
            'lines': [
              for (final line in tab.lines)
                {
                  'productId': line.product.id,
                  'variantId': line.variant.id,
                  'quantity': line.quantity,
                  'useSpecialBottle': line.useSpecialBottle,
                },
            ],
          },
      ],
    };
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode(data));
  }

  /// Returns today's saved tabs rebuilt against [products], or null if none.
  Future<RestoredOrderTabs?> restore(List<ProductItem> products,
      {DateTime? now}) async {
    // Storage problems or a corrupt entry must never block the till.
    try {
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(_key);
      if (raw == null) return null;
      try {
        return decode(raw, products, now: now ?? DateTime.now());
      } on Object catch (error) {
        debugPrint('Discarding unreadable saved order tabs: $error');
        await prefs.remove(_key);
        return null;
      }
    } on Object catch (error) {
      debugPrint('Could not restore saved order tabs: $error');
      return null;
    }
  }

  static RestoredOrderTabs? decode(String raw, List<ProductItem> products,
      {required DateTime now}) {
    final data = jsonDecode(raw) as Map<String, dynamic>;
    final savedTabs = data['tabs'] as List<dynamic>? ?? const [];
    final savedActive = data['activeIndex'] as int? ?? 0;

    final tabs = <OrderTab>[];
    var dropped = 0;
    var activeIndex = 0;
    for (var index = 0; index < savedTabs.length; index++) {
      final tab = savedTabs[index] as Map<String, dynamic>;
      final createdAt = DateTime.fromMillisecondsSinceEpoch(
          tab['createdAt'] as int? ?? 0);
      if (!_sameDay(createdAt, now)) continue;

      final lines = <CartLine>[];
      for (final item in tab['lines'] as List<dynamic>? ?? const []) {
        final line = item as Map<String, dynamic>;
        final rebound = _findLine(
          products,
          line['productId'] as String? ?? '',
          line['variantId'] as String? ?? '',
          line['quantity'] as int? ?? 1,
          line['useSpecialBottle'] as bool? ?? false,
        );
        if (rebound == null) {
          dropped++;
        } else {
          lines.add(rebound);
        }
      }
      if (index == savedActive) activeIndex = tabs.length;
      tabs.add(OrderTab(
        number: tab['number'] as int? ?? nextOrderTabNumber(tabs),
        lines: lines,
        paymentMethod: paymentMethodFromWireValue(tab['paymentMethod']) ??
            PaymentMethod.cash,
        createdAt: createdAt,
      ));
    }
    if (tabs.isEmpty) return null;
    return RestoredOrderTabs(
        tabs.take(maxOrderTabs).toList(),
        activeIndex.clamp(0, (tabs.length - 1).clamp(0, maxOrderTabs - 1)),
        dropped);
  }

  static bool _sameDay(DateTime a, DateTime b) =>
      a.year == b.year && a.month == b.month && a.day == b.day;
}
