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
  const _HistoryOrderRepository({
    this.productCode = '310047',
    this.productName = 'Άρωμα δοκιμής',
    this.variantCode = 'BULK-50',
    this.variantLabel = '50ml',
  });

  final String productCode;
  final String productName;
  final String variantCode;
  final String variantLabel;

  @override
  Future<String> submitOrder({
    required String tenantId,
    required String employeeId,
    required List<CartLine> lines,
    required PaymentMethod paymentMethod,
  }) async =>
      'order-1';

  @override
  Future<List<PosOrder>> loadRecentOrders(
      {required String tenantId, int limit = 50}) async {
    return [
      PosOrder(
        id: 'order-1',
        employeeId: 'employee-1',
        employeeName: 'Μαρία Παπαδοπούλου',
        paymentMethod: PaymentMethod.card,
        total: 12,
        createdAt: DateTime(2026, 9, 27, 12),
        items: [
          PosOrderItem(
            productCode: productCode,
            productName: productName,
            variantCode: variantCode,
            variantLabel: variantLabel,
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
  }) async {}

  @override
  Future<void> submitExpense({
    required String tenantId,
    required String employeeId,
    required double amount,
    required PaymentMethod paymentMethod,
    required String description,
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
  PosOrder? deletionEntry;
  String? cancelledOrderId;

  @override
  Future<String> submitOrder({
    required String tenantId,
    required String employeeId,
    required List<CartLine> lines,
    required PaymentMethod paymentMethod,
  }) async =>
      'order-cancel-1';

  @override
  Future<List<PosOrder>> loadRecentOrders({
    required String tenantId,
    int limit = 50,
  }) async =>
      [if (deletionEntry != null) deletionEntry!, order];

  @override
  Future<void> cancelOrder({
    required String tenantId,
    required String employeeId,
    required String orderId,
  }) async {
    deletionEntry = PosOrder(
      id: 'deletion-1',
      originalOrderId: orderId,
      employeeId: employeeId,
      total: order.total,
      createdAt: DateTime(2026, 10, 21),
      items: order.items,
      status: 'DELETED',
    );
    cancelledOrderId = orderId;
    order = PosOrder(
      id: order.id,
      employeeId: order.employeeId,
      total: order.total,
      createdAt: order.createdAt,
      items: order.items,
      status: 'CANCELLED',
    );
  }

  @override
  Future<void> submitExpense({
    required String tenantId,
    required String employeeId,
    required double amount,
    required PaymentMethod paymentMethod,
    required String description,
  }) async {}
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
    final cardPayment = find.byKey(const ValueKey('payment-card'));
    final cashPayment = find.byKey(const ValueKey('payment-cash'));
    expect(cardPayment, findsOneWidget);
    expect(cashPayment, findsOneWidget);
    expect(tester.getSize(cardPayment).height, 56);
    expect(tester.getSize(cashPayment).height, 56);
    final initialSelectedColor = tester.widget<Material>(cashPayment).color;
    final initialUnselectedColor = tester.widget<Material>(cardPayment).color;
    expect(initialSelectedColor, isNot(initialUnselectedColor));
    expect(find.text('Κάρτα'), findsOneWidget);
    expect(find.text('Μετρητά'), findsOneWidget);
    await tester.tap(cardPayment);
    await tester.pump();
    expect(tester.widget<Material>(cardPayment).color, initialSelectedColor);
    expect(tester.widget<Material>(cashPayment).color, initialUnselectedColor);
    expect(tester.takeException(), isNull);

    await tester.tap(find.textContaining('Προσθήκη — €15.00'));
    await tester.pumpAndSettle();
    expect(find.text('Καθαρή αξία'), findsNothing);
    expect(find.textContaining('ΦΠΑ'), findsNothing);
    expect(find.text('ΣΥΝΟΛΟ'), findsOneWidget);
    expect(find.text('€12.10'), findsNothing);
    expect(find.text('€2.90'), findsNothing);
    expect(find.text('€15.00'), findsNWidgets(3));

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

    expect(find.textContaining('order-1'), findsNothing);
    expect(find.textContaining('employee-1'), findsNothing);
    expect(find.text('Πώληση · 27/09/2026 · 12:00'), findsOneWidget);
    expect(find.text('Μαρία Παπαδοπούλου'), findsOneWidget);
    expect(find.text('12,00 €'), findsNWidgets(2));
    expect(find.text('2 τεμ.'), findsOneWidget);
    expect(find.text('Κάρτα'), findsOneWidget);
    expect(tester.takeException(), isNull);
    expect(find.text('Άρωμα δοκιμής'), findsOneWidget);
    expect(find.text('50ml'), findsOneWidget);
    expect(find.text('×2'), findsOneWidget);
    expect(find.text('6,00 € / τεμ.'), findsOneWidget);
    expect(find.textContaining('310047'), findsNothing);
    expect(find.textContaining('BULK-50'), findsNothing);
    expect(find.byTooltip('Εκτύπωση Άρωμα δοκιμής'), findsOneWidget);
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
    await tester.tap(find.byTooltip('Εκτύπωση Άρωμα δοκιμής'));
    await tester.pumpAndSettle();

    expect(sent?['orderId'], 'order-1');
    expect(sent?['items'], [
      {'productCode': '310047', 'ingredients': 'ΛΩΤΟΣ, ΒΑΝΙΛΙΑ', 'quantity': 2},
    ]);
  });

  testWidgets('order history resolves product IDs before reprinting labels',
      (tester) async {
    Map<String, dynamic>? sent;
    final client = MockClient((request) async {
      sent = jsonDecode(utf8.decode(request.bodyBytes)) as Map<String, dynamic>;
      return http.Response(
          jsonEncode({'success': true, 'labelsSubmitted': 2}), 200);
    });

    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: TextButton(
              onPressed: () => showDialog<void>(
                context: context,
                builder: (_) => PosOrderHistoryDialog(
                  repository: const _HistoryOrderRepository(
                    productCode: 'p1',
                    productName: '',
                    variantCode: 'internal-variant-id',
                    variantLabel: '',
                  ),
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
                      variants: [
                        ProductVariant(
                          id: 'internal-variant-id',
                          code: 'BULK-50',
                          name: 'Άρωμα 50 ml',
                          label: '50 ml',
                          type: ProductVariantType.bulk,
                          price: 6,
                        ),
                      ],
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
    expect(find.text('Test'), findsOneWidget);
    expect(find.text('Άρωμα 50 ml'), findsOneWidget);
    expect(find.textContaining('internal-variant-id'), findsNothing);
    expect(find.textContaining('p1'), findsNothing);
    await tester.tap(find.text('Εκτύπωση παραγγελίας'));
    await tester.pumpAndSettle();

    expect(sent?['items'], [
      {'productCode': '310047', 'ingredients': 'ΛΩΤΟΣ, ΒΑΝΙΛΙΑ', 'quantity': 2},
    ]);
  });

  testWidgets('cancellation only asks for confirmation and shows a deleted history entry',
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
    expect(find.byType(TextField), findsNothing);
    expect(find.text('Διαγραφή παραγγελίας'), findsOneWidget);
    await tester.tap(find.text('Όχι'));
    await tester.pumpAndSettle();
    expect(repository.cancelledOrderId, isNull);
    await tester.tap(find.text('Ακύρωση'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ναι, διαγραφή'));
    await tester.pumpAndSettle();

    expect(repository.cancelledOrderId, 'order-cancel-1');
    expect(find.text('ΑΚΥΡΩΜΕΝΗ'), findsOneWidget);
    expect(find.text('ΔΙΑΓΡΑΜΜΕΝΗ'), findsOneWidget);
    expect(find.text('Ακύρωση'), findsNothing);
  });
}
