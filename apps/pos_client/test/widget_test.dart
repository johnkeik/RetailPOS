// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:pos_client/app/app.dart';
import 'package:pos_client/features/pos/data/label_print_service.dart';
import 'package:pos_client/features/pos/data/mock_pos_catalog_repository.dart';
import 'package:pos_client/features/pos/data/mock_pos_order_repository.dart';
import 'package:pos_client/features/pos/data/pos_order_repository.dart';
import 'package:pos_client/features/pos/models/pos_models.dart';
import 'package:pos_client/features/pos/presentation/pos_home_page.dart';
import 'package:pos_client/features/pos/presentation/pos_order_history_dialog.dart';

class _HistoryOrderRepository implements PosOrderRepository {
  const _HistoryOrderRepository();

  @override
  Future<String> submitOrder({
    required String tenantId,
    required String employeeId,
    required List<CartLine> lines,
  }) async =>
      'order-1';

  @override
  Future<List<PosOrder>> loadRecentOrders(
      {required String tenantId, int limit = 50}) async {
    return [
      PosOrder(
        id: 'order-1',
        employeeId: 'employee-1',
        total: 12,
        createdAt: DateTime(2026, 9, 27, 12),
        items: const [
          PosOrderItem(
            productCode: '310047',
            productName: 'Άρωμα δοκιμής',
            variantCode: 'BULK-50',
            variantLabel: '50ml',
            isBulk: true,
            quantity: 2,
            unitPrice: 6,
          ),
        ],
      ),
    ];
  }

  @override
  Future<void> cancelOrder({
    required String tenantId,
    required String employeeId,
    required String orderId,
    required String managerPin,
    required String reason,
  }) async {}
}

class _CancellableHistoryOrderRepository implements PosOrderRepository {
  PosOrder order = PosOrder(
    id: 'order-cancel-1',
    employeeId: 'employee-1',
    total: 12,
    createdAt: DateTime(2026, 10, 8, 12),
    items: const [],
  );
  String? cancelledOrderId;
  String? cancellationReason;

  @override
  Future<String> submitOrder({
    required String tenantId,
    required String employeeId,
    required List<CartLine> lines,
  }) async =>
      'order-cancel-1';

  @override
  Future<List<PosOrder>> loadRecentOrders({
    required String tenantId,
    int limit = 50,
  }) async =>
      [order];

  @override
  Future<void> cancelOrder({
    required String tenantId,
    required String employeeId,
    required String orderId,
    required String managerPin,
    required String reason,
  }) async {
    cancelledOrderId = orderId;
    cancellationReason = reason;
    order = PosOrder(
      id: order.id,
      employeeId: order.employeeId,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items,
      status: 'CANCELLED',
      cancellationReason: reason,
    );
  }
}

void main() {
  testWidgets('employee session entry renders', (tester) async {
    tester.view.physicalSize = const Size(1600, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(const RetailPosApp(
      catalogRepository: MockPosCatalogRepository(),
      orderRepository: MockPosOrderRepository(),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Εναρξη Συνεδριας'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.text('Εναρξη'), findsOneWidget);
  });

  testWidgets('POS session details and actions stay visible on desktop',
      (tester) async {
    tester.view.physicalSize = const Size(1360, 760);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      const MaterialApp(
        home: PosHomePage(
          catalogRepository: MockPosCatalogRepository(),
          orderRepository: MockPosOrderRepository(),
          employeeId: 'employee-1',
          employeeName: 'Μαρία Παπαδοπούλου',
          tenantId: 'store001',
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Μαρία Παπαδοπούλου'), findsOneWidget);
    expect(find.text('store001'), findsOneWidget);
    expect(find.text('Ιστορικό'), findsOneWidget);
    expect(find.text('Αποσύνδεση'), findsOneWidget);
    expect(tester.takeException(), isNull);

    tester.view.physicalSize = const Size(1280, 720);
    await tester.pumpAndSettle();
    expect(find.text('Μαρία Παπαδοπούλου'), findsOneWidget);
    expect(find.text('Ιστορικό'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('order history shows order and per-code print action',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => PosOrderHistoryDialog(
                  repository: const _HistoryOrderRepository(),
                  tenantId: 'store001',
                  employeeId: 'employee-1',
                  labelPrinter: LabelPrintService(),
                  products: const [],
                ),
              ),
              child: const Text('Άνοιγμα ιστορικού'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Άνοιγμα ιστορικού'));
    await tester.pumpAndSettle();

    expect(find.text('Παραγγελία order-1'), findsOneWidget);
    expect(find.textContaining('310047 · Άρωμα δοκιμής'), findsOneWidget);
    expect(find.byTooltip('Εκτύπωση 310047'), findsOneWidget);
    expect(find.text('Εκτύπωση παραγγελίας'), findsOneWidget);
  });

  testWidgets('order history reprints a single item with catalog ingredients',
      (tester) async {
    Map<String, dynamic>? sent;
    final client = MockClient((request) async {
      sent = jsonDecode(utf8.decode(request.bodyBytes)) as Map<String, dynamic>;
      return http.Response(
          jsonEncode({'success': true, 'labelsSubmitted': 4}), 200);
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => PosOrderHistoryDialog(
                  repository: const _HistoryOrderRepository(),
                  tenantId: 'store001',
                  employeeId: 'employee-1',
                  labelPrinter:
                      LabelPrintService(client: client, baseUrl: 'http://print'),
                  products: const [
                    ProductItem(
                      id: 'p1',
                      code: '310047',
                      name: 'Test',
                      category: 'All',
                      variants: [],
                      ingredients: 'ΛΩΤΟΣ, ΒΑΝΙΛΙΑ',
                    ),
                  ],
                ),
              ),
              child: const Text('Άνοιγμα ιστορικού'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Άνοιγμα ιστορικού'));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip('Εκτύπωση 310047'));
    await tester.pumpAndSettle();

    expect(sent?['orderId'], 'order-1');
    expect(sent?['items'], [
      {'productCode': '310047', 'ingredients': 'ΛΩΤΟΣ, ΒΑΝΙΛΙΑ', 'quantity': 2},
    ]);
  });

  testWidgets('manager PIN cancels an order and hides cancel action',
      (tester) async {
    final repository = _CancellableHistoryOrderRepository();
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => PosOrderHistoryDialog(
                  repository: repository,
                  tenantId: 'store001',
                  employeeId: 'employee-1',
                  labelPrinter: LabelPrintService(),
                  products: const [],
                ),
              ),
              child: const Text('Άνοιγμα ιστορικού'),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('Άνοιγμα ιστορικού'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ακύρωση'));
    await tester.pumpAndSettle();
    await tester.enterText(find.byType(TextField).at(0), '123456');
    await tester.enterText(find.byType(TextField).at(1), 'Λάθος ποσότητα');
    await tester.tap(find.text('Επιβεβαίωση ακύρωσης'));
    await tester.pumpAndSettle();

    expect(repository.cancelledOrderId, 'order-cancel-1');
    expect(repository.cancellationReason, 'Λάθος ποσότητα');
    expect(find.text('ΑΚΥΡΩΜΕΝΗ'), findsOneWidget);
    expect(find.text('Ακύρωση'), findsNothing);
  });
}
