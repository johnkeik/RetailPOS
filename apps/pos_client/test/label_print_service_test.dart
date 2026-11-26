import 'dart:convert';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:pos_client/features/pos/data/label_print_service.dart';

void main() {
  test('items without ingredients print the missing-ingredients notice',
      () async {
    Map<String, dynamic>? sent;
    final service = LabelPrintService(
      baseUrl: 'http://print',
      client: MockClient((request) async {
        sent = jsonDecode(request.body) as Map<String, dynamic>;
        return http.Response(
            jsonEncode({'success': true, 'labelsSubmitted': 4}), 200);
      }),
    );

    final result = await service.printItems(orderId: 'o1', items: const [
      LabelPrintItem(productCode: '542', ingredients: '  ', quantity: 1),
      LabelPrintItem(productCode: '316', ingredients: 'ΒΑΝΙΛΙΑ', quantity: 1),
    ]);

    expect(result.ok, isTrue);
    expect(sent?['items'], [
      {'productCode': '542', 'ingredients': 'ΔΕΝ ΥΠΑΡΧΟΥΝ ΣΥΣΤΑΤΙΚΑ', 'quantity': 1},
      {'productCode': '316', 'ingredients': 'ΒΑΝΙΛΙΑ', 'quantity': 1},
    ]);
  });
}
