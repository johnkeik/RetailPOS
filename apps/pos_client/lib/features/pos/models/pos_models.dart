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
    required this.label,
    required this.type,
    required this.price,
  });

  final String id;
  final String code;
  final String label;
  final ProductVariantType type;
  final double price;
}

class ProductItem {
  const ProductItem({
    required this.id,
    required this.code,
    required this.name,
    required this.category,
    required this.variants,
  });

  final String id;
  final String code;
  final String name;
  final String category;
  final List<ProductVariant> variants;
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
  });

  final ProductItem product;
  final ProductVariant variant;
  final int quantity;
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
  });

  final String productCode;
  final String productName;
  final String variantCode;
  final String variantLabel;
  final bool isBulk;
  final int quantity;
  final double unitPrice;
}

class PosOrder {
  const PosOrder({
    required this.id,
    required this.employeeId,
    required this.total,
    required this.createdAt,
    required this.items,
  });

  final String id;
  final String employeeId;
  final double total;
  final DateTime? createdAt;
  final List<PosOrderItem> items;
}
