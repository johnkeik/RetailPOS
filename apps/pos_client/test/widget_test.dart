import 'package:pos_client/features/pos/auth/pos_device_auth.dart';
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
import 'package:pos_client/core/theme/app_theme.dart';
import 'package:pos_client/features/pos/presentation/pos_expense_page.dart';
import 'package:pos_client/features/pos/data/label_print_service.dart';
import 'package:pos_client/features/pos/data/mock_pos_catalog_repository.dart';
import 'package:pos_client/features/pos/data/mock_pos_order_repository.dart';
import 'package:pos_client/features/pos/data/pos_order_repository.dart';
import 'package:pos_client/features/pos/data/pos_catalog_repository.dart';
import 'package:pos_client/features/pos/models/promotion_pricing.dart';
import 'package:pos_client/features/pos/models/pos_models.dart';
import 'package:pos_client/features/pos/presentation/on_screen_keyboard.dart';
import 'package:pos_client/features/pos/presentation/pos_home_page.dart';
import 'package:pos_client/features/pos/presentation/pos_order_history_dialog.dart';
import 'package:shared_preferences/shared_preferences.dart';

mixin _NoExpenseHistory {
  Future<List<PosExpense>> loadTodayExpenses({
    required String tenantId,
    required String employeeId,
  }) async =>
      const [];

  Future<void> updateExpense({
    required String tenantId,
    required String employeeId,
    required String expenseId,
    required double amount,
    required PaymentMethod paymentMethod,
    required String description,
  }) async {}

  Future<void> voidExpense({
    required String tenantId,
    required String employeeId,
    required String expenseId,
  }) async {}
}

class _HistoryOrderRepository
    with _NoExpenseHistory
    implements PosOrderRepository {
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
    double? expectedTotal,
    ManualDiscount? manualDiscount,
  }) async =>
      'order-1';

  @override
  Future<List<PosOrder>> loadTodayOrders(
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

class _CancellableHistoryOrderRepository
    with _NoExpenseHistory
    implements PosOrderRepository {
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
    double? expectedTotal,
    ManualDiscount? manualDiscount,
  }) async =>
      'order-cancel-1';

  @override
  Future<List<PosOrder>> loadTodayOrders({
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
      cancelledAt: DateTime(2026, 10, 21, 12, 50),
      cancelledByEmployeeId: employeeId,
      cancelledByEmployeeName: 'Μαρία Παπαδοπούλου',
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

class _OfferCatalogRepository implements PosCatalogRepository {
  @override
  Future<PosCatalog> loadCatalog(String tenantId) async {
    const variant = ProductVariant(id: 'offer-variant', code: 'OFFER', name: 'Χύμα 50 ml', label: '50 ml',
      type: ProductVariantType.bulk, price: 12);
    return const PosCatalog(categories: ['All'], products: [
      ProductItem(id: 'offer-product', code: '100', name: 'Άρωμα προσφοράς', category: 'All', variants: [variant])
    ], promotions: [PosPromotion(id: 'offer', name: 'Πάρε 3, πλήρωσε 2', variantTemplateIds: ['offer-variant'],
      groupSize: 3, discountPercent: 100)]);
  }
}

class _OfferOrderRepository extends MockPosOrderRepository {
  double? expectedTotal;
  ManualDiscount? manualDiscount;
  int? quantity;
  @override
  Future<String> submitOrder({required String tenantId, required String employeeId,
    required List<CartLine> lines, required PaymentMethod paymentMethod, double? expectedTotal,
    ManualDiscount? manualDiscount}) async {
    this.expectedTotal = expectedTotal;
    this.manualDiscount = manualDiscount;
    quantity = lines.fold<int>(0, (sum, line) => sum + line.quantity);
    return 'offer-order';
  }
}

Finder _buttonWithLabel(String label) => find.ancestor(
  of: find.text(label),
  matching: find.byWidgetPredicate((widget) => widget is ButtonStyleButton),
).first;

Finder _iconWithTooltip(String label) => find.ancestor(
  of: find.byTooltip(label),
  matching: find.byWidgetPredicate((widget) => widget is IconButton),
).first;

class _ActivatedDevice implements PosDeviceAuth {
  @override
  String get tenantId => 'activated-shop';
  const _ActivatedDevice();
  @override
  Future<bool> restore() async => true;
  @override
  Future<void> activate(String email, String password) async {}
  @override
  Future<PosEmployeeSession> loginEmployee(String code) async => const PosEmployeeSession('employee', 'Employee');
  @override
  Future<void> lock() async {}
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('employee session entry renders', (tester) async {
    tester.view.physicalSize = const Size(1600, 900);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(const RetailPosApp(
      deviceAuth: _ActivatedDevice(),
      catalogRepository: MockPosCatalogRepository(),
      orderRepository: MockPosOrderRepository(),
    ));
    await tester.pumpAndSettle();

    expect(find.text('Εναρξη Συνεδριας'), findsOneWidget);
    expect(find.text('Καταστημα: activated-shop'), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.text('Εναρξη'), findsOneWidget);
  });

  testWidgets('POS session details and actions stay visible on desktop',
      (tester) async {
    tester.view.physicalSize = const Size(1360, 760);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: const PosHomePage(
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
    expect(find.byTooltip('Ιστορικό παραγγελιών'), findsOneWidget);
    expect(find.byTooltip('Έξοδα'), findsOneWidget);
    expect(find.byTooltip('Αποσύνδεση'), findsOneWidget);
    expect(find.byKey(const ValueKey('order-tab-1')), findsOneWidget);
    final cardPayment = find.byKey(const ValueKey('payment-card'));
    final cashPayment = find.byKey(const ValueKey('payment-cash'));
    expect(cardPayment, findsOneWidget);
    expect(cashPayment, findsOneWidget);
    expect(tester.getSize(cardPayment).height, 64);
    expect(tester.getSize(cashPayment).height, 64);
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
    expect(find.byTooltip('Ιστορικό παραγγελιών'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('order history shows order and per-code print action',
      (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
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
    expect(_iconWithTooltip('Εκτύπωση Άρωμα δοκιμής'), findsOneWidget);
    expect(find.text('Εκτύπωση παραγγελίας'), findsOneWidget);
    for (final target in [
      _iconWithTooltip('Ανανέωση ιστορικού'),
      _iconWithTooltip('Κλείσιμο'),
      _iconWithTooltip('Εκτύπωση Άρωμα δοκιμής'),
      _buttonWithLabel('Εκτύπωση παραγγελίας'),
      _buttonWithLabel('Ακύρωση'),
    ]) {
      expect(tester.getSize(target).height, greaterThanOrEqualTo(56));
      expect(tester.getSize(target).width, greaterThanOrEqualTo(56));
    }

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
        theme: AppTheme.light(),
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
    await tester.ensureVisible(_iconWithTooltip('Εκτύπωση Άρωμα δοκιμής'));
    await tester.pumpAndSettle();
    await tester.tap(_iconWithTooltip('Εκτύπωση Άρωμα δοκιμής'));
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
        theme: AppTheme.light(),
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

  testWidgets('cancellation shows one card with sale time, cancellation time and canceller',
      (tester) async {
    final repository = _CancellableHistoryOrderRepository();
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
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
    expect(find.text('Ακύρωση παραγγελίας'), findsOneWidget);
    await tester.tap(find.text('Όχι'));
    await tester.pumpAndSettle();
    expect(repository.cancelledOrderId, isNull);
    await tester.tap(find.text('Ακύρωση'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Ναι, ακύρωση'));
    await tester.pumpAndSettle();

    expect(repository.cancelledOrderId, 'order-cancel-1');
    expect(find.text('ΑΚΥΡΩΜΕΝΗ'), findsOneWidget);
    expect(find.text('ΔΙΑΓΡΑΜΜΕΝΗ'), findsNothing);
    expect(find.text('Πώληση · 08/10/2026 · 12:00'), findsOneWidget);
    expect(find.textContaining('21/10/2026 · 12:50'), findsOneWidget);
    expect(find.textContaining('Από: Μαρία Παπαδοπούλου'), findsOneWidget);
    expect(find.text('12,00 €'), findsOneWidget);
    expect(find.text('Εκτύπωση παραγγελίας'), findsOneWidget);
    expect(find.text('Ακύρωση'), findsNothing);
  });
  testWidgets('expense payment controls and keyboard have large touch targets', (tester) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    for (final size in [const Size(1024, 768), const Size(1280, 720), const Size(1920, 1080)]) {
      tester.view.physicalSize = size;
      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.light(),
        home: const PosExpensePage(
          repository: MockPosOrderRepository(), tenantId: 'store001',
          employeeId: 'employee-1', employeeName: 'Μαρία',
        ),
      ));
      await tester.pumpAndSettle();
      final submit = _buttonWithLabel('Καταχώρηση');
      expect(tester.getSize(submit).height, greaterThanOrEqualTo(64));
      expect(tester.getBottomRight(submit).dy, lessThan(size.height));
      expect(submit.hitTestable(), findsOneWidget);
      final card = find.byKey(const ValueKey('expense-payment-card'));
      final cash = find.byKey(const ValueKey('expense-payment-cash'));
      for (final button in [card, cash]) {
        expect(tester.getSize(button).height, greaterThanOrEqualTo(64));
        expect(tester.getSize(button).width, greaterThanOrEqualTo(56));
      }
      await tester.tap(card);
      await tester.pump();
      final key = find.widgetWithText(FilledButton, '1');
      expect(tester.getSize(key).height, greaterThanOrEqualTo(56));
      expect(tester.getSize(key).width, greaterThanOrEqualTo(56));
      await tester.tap(key);
      await tester.pump();
      expect(tester.widget<TextField>(find.byType(TextField).first).controller!.text, contains('1'));
      await tester.ensureVisible(find.byType(TextField).last);
      await tester.tap(find.byType(TextField).last);
      await tester.pumpAndSettle();
      final letter = find.widgetWithText(FilledButton, 'ε');
      expect(tester.getSize(letter).height, greaterThanOrEqualTo(56));
      expect(tester.getSize(letter).width, greaterThanOrEqualTo(56));
      await tester.tap(letter);
      await tester.pump();
      expect(tester.widget<TextField>(find.byType(TextField).last).controller!.text, 'ε');

      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    }
  });

  testWidgets('POS touch controls fit 15 inch desktop resolutions', (tester) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    for (final size in [const Size(1024, 768), const Size(1280, 720), const Size(1366, 768), const Size(1920, 1080)]) {
      tester.view.physicalSize = size;
      await tester.pumpWidget(MaterialApp(
        theme: AppTheme.light(),
        home: const PosHomePage(
          catalogRepository: MockPosCatalogRepository(), orderRepository: MockPosOrderRepository(),
          employeeId: 'employee-1', employeeName: 'Μαρία Παπαδοπούλου', tenantId: 'store001',
        ),
      ));
      await tester.pumpAndSettle();
      for (final label in [
        'Ιστορικό παραγγελιών',
        'Έξοδα',
        'Ανανέωση καταλόγου',
        'Αποσύνδεση',
      ]) {
        final target = _iconWithTooltip(label);
        expect(tester.getSize(target).height, greaterThanOrEqualTo(56));
        expect(tester.getSize(target).width, greaterThanOrEqualTo(56));
      }
      for (final key in ['order-tab-1', 'order-tab-add']) {
        expect(tester.getSize(find.byKey(ValueKey(key))).height,
            greaterThanOrEqualTo(56));
      }
      final add = _buttonWithLabel('Προσθήκη — €15.00');
      expect(tester.getSize(add).height, greaterThanOrEqualTo(64));
      await tester.tap(add);
      await tester.pumpAndSettle();
      final increase = _iconWithTooltip('Αύξηση ποσότητας');
      expect(tester.getSize(increase).height, greaterThanOrEqualTo(56));
      expect(tester.getSize(increase).width, greaterThanOrEqualTo(56));
      await tester.tap(increase);
      await tester.pumpAndSettle();
      expect(find.byTooltip('Μείωση ποσότητας'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    }
  });

  testWidgets('promotion preview recalculates quantities and sends the displayed total at checkout', (tester) async {
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    for (final size in [const Size(1024, 768), const Size(1280, 720)]) {
      tester.view.physicalSize = size;
      final repository = _OfferOrderRepository();
      final printer = LabelPrintService(baseUrl: 'http://print', client: MockClient((request) async =>
        http.Response(jsonEncode({'success': true, 'labelsSubmitted': 6}), 200)));
      await tester.pumpWidget(MaterialApp(theme: AppTheme.light(), home: PosHomePage(
        catalogRepository: _OfferCatalogRepository(), orderRepository: repository, labelPrintService: printer,
        employeeId: 'employee', employeeName: 'Μαρία', tenantId: 'store001',
      )));
      await tester.pumpAndSettle();
      for (var i = 0; i < 3; i++) {
        await tester.tap(_buttonWithLabel('Προσθήκη — €12.00'));
        await tester.pumpAndSettle();
      }
      expect(find.text('Πάρε 3, πλήρωσε 2: −€12.00'), findsOneWidget);
      expect(_buttonWithLabel('Ολοκλήρωση Πώλησης (€24.00)').hitTestable(), findsOneWidget);
      await tester.tap(_iconWithTooltip('Μείωση ποσότητας'));
      await tester.pumpAndSettle();
      expect(find.text('Πάρε 3, πλήρωσε 2: −€12.00'), findsNothing);
      await tester.tap(_iconWithTooltip('Αύξηση ποσότητας'));
      await tester.pumpAndSettle();
      await tester.tap(_buttonWithLabel('Ολοκλήρωση Πώλησης (€24.00)'));
      await tester.pumpAndSettle();
      expect(repository.expectedTotal, 24);
      expect(repository.quantity, 3);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    }
  });

  testWidgets('manual discount applies after promotions and is sent at checkout', (tester) async {
    tester.view.devicePixelRatio = 1;
    tester.view.physicalSize = const Size(1280, 720);
    addTearDown(tester.view.reset);
    final repository = _OfferOrderRepository();
    final printer = LabelPrintService(baseUrl: 'http://print', client: MockClient((request) async =>
      http.Response(jsonEncode({'success': true, 'labelsSubmitted': 3}), 200)));
    await tester.pumpWidget(MaterialApp(theme: AppTheme.light(), home: PosHomePage(
      catalogRepository: _OfferCatalogRepository(), orderRepository: repository, labelPrintService: printer,
      employeeId: 'employee', employeeName: 'Μαρία', tenantId: 'store001',
    )));
    await tester.pumpAndSettle();
    for (var i = 0; i < 3; i++) {
      await tester.tap(_buttonWithLabel('Προσθήκη — €12.00'));
      await tester.pumpAndSettle();
    }
    await tester.tap(_buttonWithLabel('Έκπτωση'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('20%'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Άλλο'));
    await tester.pumpAndSettle();
    Finder numpadKey(String label) =>
        find.descendant(of: find.byType(OnScreenNumpad), matching: find.text(label));
    // Backspace twice clears the 20% preset; typing "150" stops at 15.
    final backspace = find.descendant(
        of: find.byType(OnScreenNumpad), matching: find.byIcon(Icons.backspace_outlined));
    await tester.tap(backspace);
    await tester.tap(backspace);
    for (final key in ['1', '5', '0']) {
      await tester.tap(numpadKey(key));
    }
    await tester.pumpAndSettle();
    // The dialog with its numpad must fit a 1280×720 screen without scrolling.
    expect(_buttonWithLabel('Εφαρμογή').hitTestable(), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(_buttonWithLabel('Εφαρμογή'));
    await tester.pumpAndSettle();

    // €36 − 3-for-2 €12 = €24; 15% discount = €3.60.
    expect(find.text('Έκπτωση Άλλο 15%: −€3.60'), findsOneWidget);
    await tester.tap(_buttonWithLabel('Ολοκλήρωση Πώλησης (€20.40)'));
    await tester.pumpAndSettle();
    expect(repository.expectedTotal, 20.4);
    expect(repository.manualDiscount?.percentage, 15);
    expect(repository.manualDiscount?.details, 'Άλλο');
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
