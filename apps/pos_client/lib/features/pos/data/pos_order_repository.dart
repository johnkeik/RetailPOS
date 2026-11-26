import '../models/pos_models.dart';

abstract class PosOrderRepository {
  Future<String> submitOrder({
    required String tenantId,
    required String employeeId,
    required List<CartLine> lines,
    required PaymentMethod paymentMethod,
    double? expectedTotal,
  });

  /// Loads at most [limit] orders from the current local calendar day.
  Future<List<PosOrder>> loadTodayOrders({
    required String tenantId,
    int limit = 50,
  });

  Future<void> cancelOrder({
    required String tenantId,
    required String employeeId,
    required String orderId,
  });

  Future<void> submitExpense({
    required String tenantId,
    required String employeeId,
    required double amount,
    required PaymentMethod paymentMethod,
    required String description,
  });

  /// Loads the session employee's expenses from the current local calendar day,
  /// newest first, including voided ones.
  Future<List<PosExpense>> loadTodayExpenses({
    required String tenantId,
    required String employeeId,
  });

  Future<void> updateExpense({
    required String tenantId,
    required String employeeId,
    required String expenseId,
    required double amount,
    required PaymentMethod paymentMethod,
    required String description,
  });

  /// Marks the expense voided; it stays visible but no longer counts.
  Future<void> voidExpense({
    required String tenantId,
    required String employeeId,
    required String expenseId,
  });
}
