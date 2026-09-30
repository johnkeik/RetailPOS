import '../models/pos_models.dart';

abstract class PosOrderRepository {
  Future<String> submitOrder({
    required String tenantId,
    required String employeeId,
    required List<CartLine> lines,
  });

  Future<List<PosOrder>> loadRecentOrders({
    required String tenantId,
    int limit = 50,
  });
}
