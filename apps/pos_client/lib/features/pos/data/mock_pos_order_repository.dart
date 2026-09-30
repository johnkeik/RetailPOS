import '../models/pos_models.dart';
import 'pos_order_repository.dart';

class MockPosOrderRepository implements PosOrderRepository {
  const MockPosOrderRepository();

  @override
  Future<String> submitOrder({
    required String tenantId,
    required String employeeId,
    required List<CartLine> lines,
  }) async {
    return 'mock-order-id';
  }

  @override
  Future<List<PosOrder>> loadRecentOrders(
      {required String tenantId, int limit = 50}) async {
    return const [];
  }
}
