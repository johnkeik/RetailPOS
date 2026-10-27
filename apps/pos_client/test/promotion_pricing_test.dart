import 'dart:convert';
import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_client/features/pos/models/pos_models.dart';
import 'package:pos_client/features/pos/models/promotion_pricing.dart';

void main() {
  final fixtures =
      jsonDecode(File('../../test-fixtures/promotions.json').readAsStringSync())
          as List;
  for (final fixture in fixtures) {
    test('promotion parity: ${fixture['name']}', () {
      final lines = (fixture['items'] as List).map((raw) {
        final variant = ProductVariant(
            id: raw['variantTemplateId'] as String,
            code: '',
            name: '',
            label: '',
            type: ProductVariantType.packaged,
            price: (raw['unitPrice'] as num).toDouble());
        return CartLine(
            product: ProductItem(
                id: 'p', code: '', name: '', category: '', variants: [variant]),
            variant: variant,
            quantity: raw['quantity'] as int);
      }).toList();
      final promotions = (fixture['promotions'] as List)
          .map((raw) => PosPromotion.fromMap(
              raw['id'] as String, Map<String, dynamic>.from(raw as Map)))
          .toList();
      final pricing = priceCart(lines, promotions,
          now: DateTime.parse(fixture['now'] as String));
      final expected = fixture['expected'] as Map;
      if (expected['pendingGiftQuantity'] != null) {
        expect(pricing.pendingGifts.single.quantity, expected['pendingGiftQuantity']);
        expect(pricing.pendingGifts.single.variantTemplateId, 'simple');
      }
      expect(pricing.total, expected['total']);
      expect(pricing.discountTotal, expected['discountTotal']);
      expect(pricing.lineDiscounts, expected['lineDiscounts']);
    });
  }
}
