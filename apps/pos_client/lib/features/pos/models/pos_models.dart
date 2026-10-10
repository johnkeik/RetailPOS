enum ProductVariantType { packaged, bulk }

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
  });

  final List<String> categories;
  final List<ProductItem> products;
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
  });

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
    this.status = 'COMPLETED',
    this.cancellationReason,
    this.isSeeded = false,
  });

  final String id;
  final String employeeId;
  final double total;
  final DateTime? createdAt;
  final List<PosOrderItem> items;
  final String status;
  final String? cancellationReason;
  final bool isSeeded;
}
