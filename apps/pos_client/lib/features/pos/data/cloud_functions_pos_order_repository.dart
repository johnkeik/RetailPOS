import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/pos_models.dart';
import 'pos_order_repository.dart';

class CloudFunctionsPosOrderRepository implements PosOrderRepository {
  CloudFunctionsPosOrderRepository(
      {FirebaseFunctions? functions, FirebaseFirestore? firestore})
      : _functions = functions ?? FirebaseFunctions.instance,
        _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFunctions _functions;
  final FirebaseFirestore _firestore;

  @override
  Future<String> submitOrder({
    required String tenantId,
    required String employeeId,
    required List<CartLine> lines,
  }) async {
    final callable = _functions.httpsCallable('createOrder');
    final result = await callable.call({
      'tenantId': tenantId,
      'employeeId': employeeId,
      'items': lines
          .map(
            (line) => {
              'productId': line.product.id,
              'variantTemplateId': line.variant.id,
              'quantity': line.quantity,
              'unitPrice': line.unitPrice,
              'useSpecialBottle': line.useSpecialBottle,
            },
          )
          .toList(),
    });

    final data = result.data as Map<Object?, Object?>;
    return data['orderId'] as String;
  }

  @override
  Future<void> cancelOrder({
    required String tenantId,
    required String employeeId,
    required String orderId,
    required String managerPin,
    required String reason,
  }) async {
    await _functions.httpsCallable('cancelOrder').call({
      'tenantId': tenantId,
      'employeeId': employeeId,
      'orderId': orderId,
      'managerPin': managerPin,
      'reason': reason,
    });
  }

  @override
  Future<List<PosOrder>> loadRecentOrders(
      {required String tenantId, int limit = 50}) async {
    final snapshot = await _firestore
        .collection('tenants/$tenantId/orders')
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .get();

    return snapshot.docs.map((doc) {
      final data = doc.data();
      final rawItems = data['items'] as List<dynamic>? ?? const [];
      final items = rawItems.map((raw) {
        final item = Map<String, dynamic>.from(raw as Map);
        return PosOrderItem(
          productCode: item['productCode'] as String? ??
              item['productId'] as String? ??
              '',
          productName: item['productName'] as String? ?? '',
          variantCode: item['variantCode'] as String? ??
              item['variantTemplateId'] as String? ??
              '',
          variantLabel: item['variantLabel'] as String? ?? '',
          isBulk: item['isBulk'] as bool? ?? false,
          quantity: (item['quantity'] as num? ?? 0).toInt(),
          unitPrice: (item['unitPrice'] as num? ?? 0).toDouble(),
          useSpecialBottle: item['useSpecialBottle'] as bool? ?? false,
        );
      }).toList();
      final createdAtValue = data['createdAt'];
      final createdAt =
          createdAtValue is Timestamp ? createdAtValue.toDate() : null;

      return PosOrder(
        id: doc.id,
        employeeId: data['employeeId'] as String? ?? '',
        total: (data['total'] as num? ?? 0).toDouble(),
        createdAt: createdAt,
        items: items,
        status: data['status'] as String? ?? 'COMPLETED',
        cancellationReason: data['cancellationReason'] as String?,
        isSeeded: data['seededAt'] != null,
      );
    }).toList();
  }
}
