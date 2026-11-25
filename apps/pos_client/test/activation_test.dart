import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_client/features/pos/auth/pos_device_auth.dart';
import 'package:pos_client/features/pos/data/mock_pos_order_repository.dart';
import 'package:pos_client/features/pos/presentation/pos_activation_page.dart';
import 'package:pos_client/features/pos/presentation/pos_expense_page.dart';

class _Auth implements PosDeviceAuth {
  @override
  String get tenantId => 'store001';
  PosActivationException? failure;
  String? email;
  String? password;
  @override
  Future<void> activate(String email, String password) async {
    if (failure != null) throw failure!;
    this.email = email;
    this.password = password;
  }

  @override
  Future<bool> restore() async => false;
  @override
  Future<void> lock() async {}
  @override
  Future<PosEmployeeSession> loginEmployee(String code) async =>
      const PosEmployeeSession('e1', 'Test');
}

void main() {
  testWidgets('activation failure shows a safe stage and error code',
      (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final auth = _Auth()
      ..failure =
          const PosActivationException('secure-storage', 'keychain-error');
    await tester.pumpWidget(
        MaterialApp(home: PosActivationPage(auth: auth, onActivated: () {})));
    await tester.enterText(find.byKey(const ValueKey('activation-email')),
        'owner@example.invalid');
    await tester.enterText(
        find.byKey(const ValueKey('activation-password')), 'Secret-test-only');
    await tester.tap(find.byKey(const ValueKey('activate-pc')));
    await tester.pumpAndSettle();
    expect(
        find.textContaining('secure-storage/keychain-error'), findsOneWidget);
    expect(
        find.byWidgetPredicate((widget) =>
            widget is Text && (widget.data ?? '').contains('Secret-test-only')),
        findsNothing);
  });

  testWidgets(
      'activation accepts mixed hardware and touch input, Tab focus and password symbols',
      (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final auth = _Auth();
    var activated = false;
    await tester.pumpWidget(MaterialApp(
        home: PosActivationPage(
            auth: auth, onActivated: () => activated = true)));
    final email = find.byKey(const ValueKey('activation-email'));
    final password = find.byKey(const ValueKey('activation-password'));
    await tester.enterText(email, 'owner');
    await tester.tap(find.text('!@#'));
    await tester.pump();
    await tester.tap(find.text('@'));
    await tester.pump();
    expect(tester.widget<TextField>(email).controller!.text, 'owner@');
    // Touch keyboard must preserve the input's hardware focus.
    expect(tester.widget<TextField>(email).focusNode!.hasFocus, isTrue);
    await tester.enterText(email, 'owner@example.invalid');
    await tester.sendKeyEvent(LogicalKeyboardKey.tab);
    await tester.pump();
    expect(tester.widget<TextField>(password).focusNode!.hasFocus, isTrue);
    await tester.enterText(password, 'Pass');
    await tester.tap(find.text('!'));
    await tester.pump();
    expect(tester.widget<TextField>(password).controller!.text, 'Pass!');
    expect(tester.widget<TextField>(password).obscureText, isTrue);
    await tester.tap(find.byKey(const ValueKey('activate-pc')));
    await tester.pumpAndSettle();
    expect(activated, isTrue);
    expect(auth.email, 'owner@example.invalid');
    expect(auth.password, 'Pass!');
  });

  testWidgets(
      'expenses support hardware validation, Tab switching and touch editing',
      (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(const MaterialApp(
        home: PosExpensePage(
      repository: MockPosOrderRepository(),
      tenantId: 'store001',
      employeeId: 'e1',
      employeeName: 'Test',
    )));
    final amount = find.byType(TextField).first;
    final description = find.byType(TextField).last;
    await tester.enterText(amount, '12.50');
    expect(tester.widget<TextField>(amount).controller!.text, '12.50');
    await tester.enterText(amount, 'invalid');
    expect(tester.widget<TextField>(amount).controller!.text, '12.50');
    await tester.tap(description);
    await tester.enterText(description, 'Cleaning');
    await tester.pump();
    await tester.tap(find.text('ε'));
    await tester.pump();
    expect(tester.widget<TextField>(description).controller!.text, 'Cleaningε');
    expect(tester.widget<TextField>(description).focusNode!.hasFocus, isTrue);
  });
}
