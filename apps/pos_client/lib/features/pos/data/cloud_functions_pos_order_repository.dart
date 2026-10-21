import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';
import 'package:http/http.dart' as http;

import '../../../core/firebase/firebase_config.dart';
import '../models/pos_models.dart';
import 'pos_order_repository.dart';

class CloudFunctionsPosOrderRepository implements PosOrderRepository {
  CloudFunctionsPosOrderRepository(
      {FirebaseFunctions? functions,
      FirebaseFirestore? firestore,
      http.Client? httpClient})
      : _functions = functions ?? FirebaseFunctions.instance,
        _firestore = firestore ?? FirebaseFirestore.instance,
        _httpClient = httpClient;

  final FirebaseFunctions _functions;
  final FirebaseFirestore _firestore;
  final http.Client? _httpClient;

  static const _functionsRegion = 'us-central1';

  @override
  Future<String> submitOrder({
    required String tenantId,
    required String employeeId,
    required List<CartLine> lines,
    required PaymentMethod paymentMethod,
  }) async {
    final payload = {
      'tenantId': tenantId,
      'employeeId': employeeId,
      'paymentMethod': paymentMethod.wireValue,
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
    };

    if (Platform.isWindows) {
      final result = await _callWindowsCallable('createOrder', payload);
      return result['orderId'] as String;
    }

    final callable = _functions.httpsCallable('createOrder');
    final result = await callable.call(payload);

    final data = result.data as Map<Object?, Object?>;
    return data['orderId'] as String;
  }

  @override
  Future<void> cancelOrder({
    required String tenantId,
    required String employeeId,
    required String orderId,
  }) async {
    final payload = {
      'tenantId': tenantId,
      'employeeId': employeeId,
      'orderId': orderId,
    };

    if (Platform.isWindows) {
      await _callWindowsCallable('cancelOrder', payload);
      return;
    }

    await _functions.httpsCallable('cancelOrder').call(payload);
  }

  @override
  Future<void> submitExpense({
    required String tenantId,
    required String employeeId,
    required double amount,
    required PaymentMethod paymentMethod,
    required String description,
  }) async {
    final payload = {
      'tenantId': tenantId,
      'employeeId': employeeId,
      'amount': amount,
      'paymentMethod': paymentMethod.wireValue,
      'description': description,
    };

    if (Platform.isWindows) {
      await _callWindowsCallable('createExpense', payload);
      return;
    }

    await _functions.httpsCallable('createExpense').call(payload);
  }

  Future<Map<Object?, Object?>> _callWindowsCallable(
    String functionName,
    Map<String, Object?> data,
  ) async {
    final projectId = PosFirebaseConfig.options.projectId;
    final uri = PosFirebaseConfig.useEmulators
        ? Uri.http(
            '${PosFirebaseConfig.emulatorHost}:${PosFirebaseConfig.functionsPort}',
            '/$projectId/$_functionsRegion/$functionName',
          )
        : Uri.https(
            '$_functionsRegion-$projectId.cloudfunctions.net',
            '/$functionName',
          );
    final request = {'data': data};
    final headers = {'Content-Type': 'application/json'};

    late final http.Response response;
    try {
      final responseFuture = _httpClient == null
          ? http.post(uri, headers: headers, body: jsonEncode(request))
          : _httpClient.post(uri, headers: headers, body: jsonEncode(request));
      response = await responseFuture.timeout(const Duration(seconds: 30));
    } on SocketException catch (error) {
      throw FirebaseFunctionsException(
        code: 'unavailable',
        message: error.message,
      );
    } on TimeoutException {
      throw FirebaseFunctionsException(
        code: 'deadline-exceeded',
        message: 'Cloud Function request timed out.',
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map) {
      throw FirebaseFunctionsException(
        code: 'internal',
        message: 'Invalid callable response.',
      );
    }
    final responseData = Map<String, dynamic>.from(decoded);
    final error = responseData['error'];
    if (error is Map) {
      final errorData = Map<String, dynamic>.from(error);
      final status = errorData['status'] as String? ?? 'unknown';
      throw FirebaseFunctionsException(
        code: status.toLowerCase().replaceAll('_', '-'),
        message: errorData['message'] as String? ?? 'Cloud Function failed.',
        details: errorData['details'],
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw FirebaseFunctionsException(
        code: response.statusCode >= 500 ? 'internal' : 'unknown',
        message: 'Cloud Function returned HTTP ${response.statusCode}.',
      );
    }

    final result = responseData['result'] ?? responseData['data'];
    if (result is Map) {
      return Map<Object?, Object?>.from(result);
    }
    throw FirebaseFunctionsException(
      code: 'internal',
      message: 'Cloud Function returned an invalid result.',
    );
  }

  @override
  Future<List<PosOrder>> loadTodayOrders(
      {required String tenantId, int limit = 50}) async {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    // Construct the next calendar day rather than adding 24 hours (DST).
    final endOfDay = DateTime(now.year, now.month, now.day + 1);
    final snapshot = await _firestore
        .collection('tenants/$tenantId/orders')
        .where('createdAt', isGreaterThanOrEqualTo: Timestamp.fromDate(startOfDay))
        .where('createdAt', isLessThan: Timestamp.fromDate(endOfDay))
        .orderBy('createdAt', descending: true)
        .limit(limit)
        .get();
    if (snapshot.docs.isEmpty) return [];

    final snapshots = await Future.wait([
      _firestore.collection('tenants/$tenantId/employees').get(),
      _firestore.collection('tenants/$tenantId/products').get(),
      _firestore.collection('tenants/$tenantId/variantTemplates').get(),
    ]);
    final employeeNames = {
      for (final employee in snapshots[0].docs)
        employee.id: (employee.data()['name'] as String? ?? '').trim(),
    };

    // Include inactive catalog records so older sales remain readable.
    final productNames = <String, String>{};
    for (final product in snapshots[1].docs) {
      final name = (product.data()['name'] as String? ?? '').trim();
      productNames[product.id] = name;
      final code = product.data()['productCode'] as String?;
      if (code != null) productNames[code] = name;
    }
    final variantNames = <String, String>{};
    for (final variant in snapshots[2].docs) {
      final name = (variant.data()['name'] as String? ?? '').trim();
      variantNames[variant.id] = name;
      final code = variant.data()['code'] as String?;
      if (code != null) variantNames[code] = name;
    }

    // Older versions wrote a second DELETED order as an audit record.
    // Retain it in storage, but only show the original order to employees.
    return snapshot.docs.where((doc) => doc.data()['status'] != 'DELETED').map((doc) {
      final data = doc.data();
      final rawItems = data['items'] as List<dynamic>? ?? const [];
      final items = rawItems.map((raw) {
        final item = Map<String, dynamic>.from(raw as Map);
        return PosOrderItem(
          productCode: item['productCode'] as String? ??
              item['productId'] as String? ??
              '',
          productName: (item['productName'] as String?)?.trim().isNotEmpty == true
              ? item['productName'] as String
              : productNames[item['productId'] ?? item['productCode']] ?? '',
          variantCode: item['variantCode'] as String? ??
              item['variantTemplateId'] as String? ??
              item['variantId'] as String? ??
              '',
          variantLabel: (item['variantLabel'] as String?)?.trim().isNotEmpty == true
              ? item['variantLabel'] as String
              : variantNames[item['variantTemplateId'] ??
                  item['variantId'] ?? item['variantCode']] ?? '',
          isBulk: item['isBulk'] as bool? ?? false,
          quantity: (item['quantity'] as num? ?? 0).toInt(),
          unitPrice: (item['unitPrice'] as num? ?? 0).toDouble(),
          useSpecialBottle: item['useSpecialBottle'] as bool? ?? false,
        );
      }).toList();
      final createdAtValue = data['createdAt'];
      final createdAt =
          createdAtValue is Timestamp ? createdAtValue.toDate() : null;

      final cancelledAtValue = data['cancelledAt'];
      final cancelledByEmployeeId = data['cancelledByEmployeeId'] as String?;
      final savedCancellerName =
          (data['cancelledByEmployeeName'] as String? ?? '').trim();

      return PosOrder(
        id: doc.id,
        employeeId: data['employeeId'] as String? ?? '',
        employeeName: employeeNames[data['employeeId']] ??
            data['employeeName'] as String? ?? '',
        total: (data['total'] as num? ?? 0).toDouble(),
        createdAt: createdAt,
        items: items,
        paymentMethod: paymentMethodFromWireValue(data['paymentMethod']),
        status: data['status'] as String? ?? 'COMPLETED',
        cancelledAt: cancelledAtValue is Timestamp ? cancelledAtValue.toDate() : null,
        cancelledByEmployeeId: cancelledByEmployeeId,
        cancelledByEmployeeName: savedCancellerName.isNotEmpty
            ? savedCancellerName
            : employeeNames[cancelledByEmployeeId],
        cancellationReason: data['cancellationReason'] as String?,
        originalOrderId: data['originalOrderId'] as String?,
        isSeeded: data['seededAt'] != null,
      );
    }).toList();
  }
}
