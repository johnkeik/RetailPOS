// This is a basic Flutter widget test.
//
// To perform an interaction with a widget in your test, use the WidgetTester
// utility in the flutter_test package. For example, you can send tap and scroll
// gestures. You can also use WidgetTester to find child widgets in the widget
// tree, read text, and verify that the values of widget properties are correct.

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_client/app/app.dart';
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
                builder: (_) => const PosOrderHistoryDialog(
                  repository: _HistoryOrderRepository(),
                  tenantId: 'store001',
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
    expect(find.byTooltip('Εκτύπωση κωδικού BULK-50'), findsOneWidget);
    expect(find.text('Εκτύπωση παραγγελίας'), findsOneWidget);
  });
}
