import '../models/pos_models.dart';

abstract class PosOrderRepository {
  Future<String> submitOrder({
    required String tenantId,
    required String employeeId,
    required List<CartLine> lines,
    required PaymentMethod paymentMethod,
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
}
