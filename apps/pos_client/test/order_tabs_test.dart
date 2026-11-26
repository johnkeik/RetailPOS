import 'dart:convert';

import 'package:flutter/gestures.dart';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_client/core/theme/app_theme.dart';
import 'package:pos_client/features/pos/data/mock_pos_catalog_repository.dart';
import 'package:pos_client/features/pos/data/mock_pos_order_repository.dart';
import 'package:pos_client/features/pos/data/pos_order_repository.dart';
import 'package:pos_client/features/pos/models/order_tabs.dart';
import 'package:pos_client/features/pos/models/pos_models.dart';
import 'package:pos_client/features/pos/presentation/pos_expense_history_dialog.dart';
import 'package:pos_client/features/pos/presentation/pos_home_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _variant = ProductVariant(
  id: 'v1',
  code: 'V1',
  name: '50ml',
  label: '50ml',
  type: ProductVariantType.bulk,
  price: 10,
);
const _product = ProductItem(
  id: 'p1',
  code: 'P1',
  name: 'Άρωμα',
  category: 'Unisex',
  variants: [_variant],
);

String _savedTabs(List<Map<String, Object?>> tabs, {int activeIndex = 0}) =>
    jsonEncode({'activeIndex': activeIndex, 'tabs': tabs});

Map<String, Object?> _savedTab(int number, DateTime createdAt,
        List<Map<String, Object?>> lines) =>
    {
      'number': number,
      'paymentMethod': 'CARD',
      'createdAt': createdAt.millisecondsSinceEpoch,
      'lines': lines,
    };

class _ExpenseRepository extends MockPosOrderRepository {
  _ExpenseRepository(this.expenses);

  final List<PosExpense> expenses;
  final voided = <String>[];

  @override
  Future<List<PosExpense>> loadTodayExpenses({
    required String tenantId,
    required String employeeId,
  }) async =>
      expenses;

  @override
  Future<void> voidExpense({
    required String tenantId,
    required String employeeId,
    required String expenseId,
  }) async {
    voided.add(expenseId);
  }
}

Widget _home({PosOrderRepository? orders}) => MaterialApp(
      theme: AppTheme.light(),
      home: PosHomePage(
        catalogRepository: const MockPosCatalogRepository(),
        orderRepository: orders ?? const MockPosOrderRepository(),
        employeeId: 'employee-1',
        employeeName: 'Μαρία',
        tenantId: 'store001',
      ),
    );

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  group('OrderTabsStore.decode', () {
    final now = DateTime(2026, 11, 26, 18);

    test('drops tabs from earlier days and keeps today', () {
      final raw = _savedTabs([
        _savedTab(1, DateTime(2026, 11, 25, 20), [
          {'productId': 'p1', 'variantId': 'v1', 'quantity': 1},
        ]),
        _savedTab(2, DateTime(2026, 11, 26, 9), [
          {'productId': 'p1', 'variantId': 'v1', 'quantity': 3},
        ]),
      ], activeIndex: 1);

      final restored = OrderTabsStore.decode(raw, [_product], now: now)!;

      expect(restored.tabs, hasLength(1));
      expect(restored.tabs.single.number, 2);
      expect(restored.tabs.single.lines.single.quantity, 3);
      expect(restored.tabs.single.paymentMethod, PaymentMethod.card);
      expect(restored.activeIndex, 0);
    });

    test('returns null when every saved tab is from another day', () {
      final raw = _savedTabs([_savedTab(1, DateTime(2026, 11, 25), [])]);
      expect(OrderTabsStore.decode(raw, [_product], now: now), isNull);
    });

    test('removes items no longer in the catalog and counts them', () {
      final raw = _savedTabs([
        _savedTab(1, now, [
          {'productId': 'p1', 'variantId': 'v1', 'quantity': 1},
          {'productId': 'gone', 'variantId': 'v9', 'quantity': 2},
        ]),
      ]);

      final restored = OrderTabsStore.decode(raw, [_product], now: now)!;

      expect(restored.tabs.single.lines, hasLength(1));
      expect(restored.droppedCount, 1);
    });
  });

  test('nextOrderTabNumber reuses the lowest free number', () {
    final tabs = [OrderTab(number: 1), OrderTab(number: 3)];
    expect(nextOrderTabNumber(tabs), 2);
    expect(nextOrderTabNumber(const []), 1);
  });

  testWidgets('tabs keep separate carts and survive a restart',
      (tester) async {
    tester.view.physicalSize = const Size(1366, 768);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_home());
    await tester.pumpAndSettle();

    await tester.tap(find.textContaining('Προσθήκη — €15.00'));
    await tester.pumpAndSettle();
    expect(find.text('1 τεμ. · 15,00 €'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('order-tab-add')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('order-tab-2')), findsOneWidget);
    expect(find.text('Το καλάθι είναι άδειο'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('order-tab-1')));
    await tester.pumpAndSettle();
    expect(find.text('Το καλάθι είναι άδειο'), findsNothing);

    // A fresh page restores both tabs from storage.
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pumpWidget(_home());
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('order-tab-1')), findsOneWidget);
    expect(find.byKey(const ValueKey('order-tab-2')), findsOneWidget);
    expect(find.text('1 τεμ. · 15,00 €'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('overflowing tabs scroll horizontally with a touch drag',
      (tester) async {
    tester.view.physicalSize = const Size(1024, 768);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_home());
    await tester.pumpAndSettle();
    for (var i = 0; i < maxOrderTabs - 1; i++) {
      await tester.ensureVisible(find.byKey(const ValueKey('order-tab-add')));
      await tester.tap(find.byKey(const ValueKey('order-tab-add')));
      await tester.pumpAndSettle();
    }
    final strip = find.ancestor(
      of: find.byKey(const ValueKey('order-tab-1')),
      matching: find.byType(Scrollable),
    );
    final position =
        tester.state<ScrollableState>(strip.first).position;
    position.jumpTo(0);
    await tester.pumpAndSettle();
    expect(position.maxScrollExtent, greaterThan(0));

    // Starting on a tab must still scroll, not just select it.
    await tester.dragFrom(
      tester.getCenter(find.byKey(const ValueKey('order-tab-2'))),
      const Offset(-400, 0),
      kind: PointerDeviceKind.touch,
    );
    await tester.pumpAndSettle();
    expect(position.pixels, greaterThan(0));
  });

  testWidgets('completing an order closes its tab', (tester) async {
    tester.view.physicalSize = const Size(1366, 768);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(_home());
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('order-tab-add')));
    await tester.pumpAndSettle();
    await tester.tap(find.textContaining('Προσθήκη — €15.00'));
    await tester.pumpAndSettle();

    await tester.tap(find.textContaining('Ολοκλήρωση Πώλησης'));
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));

    expect(find.byKey(const ValueKey('order-tab-2')), findsNothing);
    expect(find.byKey(const ValueKey('order-tab-1')), findsOneWidget);
  });

  testWidgets('expense history totals skip voided entries and can void',
      (tester) async {
    tester.view.physicalSize = const Size(1366, 768);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final repository = _ExpenseRepository([
      PosExpense(
          id: 'e1',
          amount: 12.5,
          paymentMethod: PaymentMethod.cash,
          description: 'Καθαριστικά',
          createdAt: DateTime(2026, 11, 26, 10, 5)),
      PosExpense(
          id: 'e2',
          amount: 4,
          paymentMethod: PaymentMethod.card,
          description: 'Καφέδες',
          createdAt: DateTime(2026, 11, 26, 11),
          edited: true),
      PosExpense(
          id: 'e3',
          amount: 100,
          paymentMethod: PaymentMethod.cash,
          description: 'Λάθος',
          createdAt: DateTime(2026, 11, 26, 12),
          voided: true),
    ]);

    await tester.pumpWidget(MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(
        body: PosExpenseHistoryDialog(
          repository: repository,
          tenantId: 'store001',
          employeeId: 'employee-1',
          employeeName: 'Μαρία',
        ),
      ),
    ));
    await tester.pumpAndSettle();

    expect(find.text('16,50 €'), findsOneWidget); // total
    expect(find.text('12,50 €'), findsNWidgets(2)); // cash tile + row
    expect(find.text('4,00 €'), findsNWidgets(2)); // card tile + row
    expect(find.text('Τροποποιήθηκε'), findsOneWidget);
    expect(find.text('Ακυρώθηκε'), findsOneWidget);
    // Voided rows offer no actions.
    expect(find.byTooltip('Ακύρωση'), findsNWidgets(2));

    await tester.tap(find.byTooltip('Ακύρωση').first);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ναι, ακύρωση'));
    await tester.pumpAndSettle();
    expect(repository.voided, ['e1']);
  });
}
