import '../models/pos_models.dart';
import 'pos_order_repository.dart';

class MockPosOrderRepository implements PosOrderRepository {
  const MockPosOrderRepository();

  @override
  Future<String> submitOrder({
    required String tenantId,
    required String employeeId,
    required List<CartLine> lines,
    required PaymentMethod paymentMethod,
  }) async {
    return 'mock-order-id';
  }

  @override
  Future<List<PosOrder>> loadTodayOrders(
      {required String tenantId, int limit = 50}) async {
    return const [];
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
