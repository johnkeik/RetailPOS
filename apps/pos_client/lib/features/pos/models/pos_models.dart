import 'promotion_models.dart';

enum ProductVariantType { packaged, bulk }

enum PaymentMethod { card, cash }

extension PaymentMethodSerialization on PaymentMethod {
  String get wireValue => switch (this) {
        PaymentMethod.card => 'CARD',
        PaymentMethod.cash => 'CASH',
      };
}

PaymentMethod? paymentMethodFromWireValue(Object? value) => switch (value) {
      'CARD' => PaymentMethod.card,
      'CASH' => PaymentMethod.cash,
      _ => null,
    };

extension ProductVariantTypeLabel on ProductVariantType {
  String get label {
    switch (this) {
      case ProductVariantType.packaged:
        return 'Συσκευασμενο';
      case ProductVariantType.bulk:
        return 'Χυμα';
    }
  }
}

class ProductVariant {
  const ProductVariant({
    required this.id,
    required this.code,
    required this.name,
    required this.label,
    required this.type,
    required this.price,
    this.perfumeMl,
    this.essenceMl,
    this.hasSpecialBottle = false,
    this.specialBottleConsumableId,
    this.specialBottleExtraPrice,
  });

  final String id;
  final String code;
  final String name;
  final String label;
  final ProductVariantType type;
  final double price;
  final int? perfumeMl;
  final int? essenceMl;
  final bool hasSpecialBottle;
  final String? specialBottleConsumableId;
  final double? specialBottleExtraPrice;

  String get recipeSummary {
    if (type != ProductVariantType.bulk) return '';
    final parts = <String>[];
    if (perfumeMl != null && perfumeMl! > 0) {
      parts.add('${perfumeMl}ml βάση');
    }
    if (essenceMl != null && essenceMl! > 0) {
      parts.add('${essenceMl}ml εσάνς');
    }
    return parts.join(' + ');
  }
}

class ProductItem {
  const ProductItem({
    required this.id,
    required this.code,
    required this.name,
    required this.category,
    required this.variants,
    this.ingredients = '',
  });

  final String id;
  final String code;
  final String name;
  final String category;
  final List<ProductVariant> variants;
  final String ingredients;
}

class PosCatalog {
  const PosCatalog({
    required this.categories,
    required this.products,
    this.promotions = const [],
  });

  final List<String> categories;
  final List<ProductItem> products;
  final List<PosPromotion> promotions;
}

class CartLine {
  const CartLine({
    required this.product,
    required this.variant,
    required this.quantity,
    this.useSpecialBottle = false,
  });

  final ProductItem product;
  final ProductVariant variant;
  final int quantity;
  final bool useSpecialBottle;

  double get extraPricePerUnit =>
      (useSpecialBottle && variant.hasSpecialBottle)
          ? (variant.specialBottleExtraPrice ?? 0.0)
          : 0.0;

  double get unitPrice => variant.price + extraPricePerUnit;

  double get total => unitPrice * quantity;
}

class PosOrderItem {
  const PosOrderItem({
    required this.productCode,
    required this.productName,
    required this.variantCode,
    required this.variantLabel,
    required this.isBulk,
    required this.quantity,
    required this.unitPrice,
    this.useSpecialBottle = false,
    this.discountTotal = 0,
  });

  final double discountTotal;
  double get lineTotal => ((unitPrice * 100).round() * quantity - (discountTotal * 100).round()) / 100;
  final String productCode;
  final String productName;
  final String variantCode;
  final String variantLabel;
  final bool isBulk;
  final int quantity;
  final double unitPrice;
  final bool useSpecialBottle;
}

class PosOrder {
  const PosOrder({
    required this.id,
    required this.employeeId,
    required this.total,
    required this.createdAt,
    required this.items,
    this.paymentMethod,
    this.employeeName = '',
    this.subtotal,
    this.discountTotal = 0,
    this.promotionNames = const [],
    this.status = 'COMPLETED',
    this.cancelledAt,
    this.cancelledByEmployeeId,
    this.cancelledByEmployeeName,
    this.cancellationReason,
    this.originalOrderId,
    this.isSeeded = false,
  });

  final String id;
  final String employeeId;
  final double total;
  final DateTime? createdAt;
  final List<PosOrderItem> items;
  final PaymentMethod? paymentMethod;
  final double? subtotal;
  final double discountTotal;
  final List<String> promotionNames;
  final String employeeName;
  final String status;
  final DateTime? cancelledAt;
  final String? cancelledByEmployeeId;
  final String? cancelledByEmployeeName;
  final String? cancellationReason;
  final String? originalOrderId;
  final bool isSeeded;
}

class PosExpense {
  const PosExpense({
    required this.id,
    required this.amount,
    required this.paymentMethod,
    required this.description,
    required this.createdAt,
    this.voided = false,
    this.edited = false,
  });

  final String id;
  final double amount;
  final PaymentMethod paymentMethod;
  final String description;
  final DateTime? createdAt;
  final bool voided;
  final bool edited;
}

/// A staff-applied discount off the order total, after promotions: either a
/// whole percentage or a fixed amount in cents (exactly one is set).
class ManualDiscount {
  const ManualDiscount({this.percentage, this.fixedAmountCents, required this.details})
      : assert((percentage == null) != (fixedAmountCents == null));

  /// Whole percent, 1–100. 100 records the order at no charge.
  final int? percentage;

  /// Fixed discount in cents, at least 1. Capped at the order total.
  final int? fixedAmountCents;

  /// Why the discount was given, e.g. one of [detailOptions].
  final String details;

  static const detailOptions = ['Προσωπικό', 'Αυτοπαράδοση', 'Άλλο'];

  /// "15%" or "€5.00".
  String get valueLabel => percentage != null
      ? '$percentage%'
      : '€${(fixedAmountCents! / 100).toStringAsFixed(2)}';

  /// Cents taken off [totalCents]: a percentage rounds half-up, a fixed
  /// amount never exceeds the total.
  /// Keep in parity with manualDiscountCents in create-order.ts.
  int amountCentsOf(int totalCents) {
    final percent = percentage;
    if (percent != null) return (totalCents * percent + 50) ~/ 100;
    return fixedAmountCents! < totalCents ? fixedAmountCents! : totalCents;
  }

  Map<String, Object> toJson() => {
        if (percentage != null) 'percentage': percentage!,
        if (fixedAmountCents != null) 'fixedAmount': fixedAmountCents! / 100,
        'details': details,
      };

  static ManualDiscount? fromJson(Object? json) {
    if (json is! Map) return null;
    final percentage = json['percentage'];
    final fixedAmount = json['fixedAmount'];
    final details = json['details'];
    if (details is! String || details.trim().isEmpty) return null;
    if (percentage is int && percentage >= 1 && percentage <= 100) {
      return ManualDiscount(percentage: percentage, details: details);
    }
    if (fixedAmount is num && fixedAmount.isFinite) {
      final cents = (fixedAmount * 100).round();
      if (cents >= 1) {
        return ManualDiscount(fixedAmountCents: cents, details: details);
      }
    }
    return null;
  }
}
