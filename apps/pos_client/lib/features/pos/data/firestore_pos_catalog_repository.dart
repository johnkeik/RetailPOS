import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/pos_models.dart';
import 'pos_catalog_repository.dart';

class FirestorePosCatalogRepository implements PosCatalogRepository {
  FirestorePosCatalogRepository({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  @override
  Future<PosCatalog> loadCatalog(String tenantId) async {
    final categoriesRef = _firestore.collection('tenants/$tenantId/categories');
    final productsRef = _firestore.collection('tenants/$tenantId/products');
    final templatesRef = _firestore.collection('tenants/$tenantId/variantTemplates');

    final categoriesFuture = categoriesRef.get();
    final productsFuture = productsRef.get();
    final templatesFuture = templatesRef.get();

    final categoriesSnapshot = await categoriesFuture;
    final productsSnapshot = await productsFuture;
    final templatesSnapshot = await templatesFuture;

    final categoryById = <String, String>{};
    final categoryNames = <String>[];
    for (final doc in categoriesSnapshot.docs) {
      final data = doc.data();
      if (data['active'] == false) {
        continue;
      }

      final name = (data['name'] as String? ?? '').trim();
      if (name.isEmpty) {
        continue;
      }

      categoryById[doc.id] = name;
      categoryNames.add(name);
    }
    categoryNames.sort();

    final templateById = <String, Map<String, dynamic>>{};
    for (final doc in templatesSnapshot.docs) {
      final data = doc.data();
      if (data['active'] == false) {
        continue;
      }

      templateById[doc.id] = data;
    }

    final products = <ProductItem>[];
    for (final doc in productsSnapshot.docs) {
      final data = doc.data();
      if (data['active'] == false) {
        continue;
      }

      final productCode = (data['productCode'] as String? ?? '').trim();
      final name = (data['name'] as String? ?? '').trim();
      if (productCode.isEmpty || name.isEmpty) {
        continue;
      }

      final variantAssignments =
          (data['variantAssignments'] as Map<Object?, Object?>? ?? const <Object?, Object?>{});
      final variants = <ProductVariant>[];

      for (final entry in variantAssignments.entries) {
        final templateId = entry.key?.toString();
        if (templateId == null) {
          continue;
        }

        final template = templateById[templateId];
        if (template == null) {
          continue;
        }

        final assignment = (entry.value as Map<Object?, Object?>? ?? const <Object?, Object?>{});
        final templateCode = (template['code'] as String? ?? templateId).trim();
        final price = (assignment['sellingPrice'] as num?)?.toDouble() ??
            (template['sellingPrice'] as num?)?.toDouble() ??
            0;

        final perfumeMl = (template['perfumeMl'] as num?)?.toInt();
        final essenceMl = (template['essenceMl'] as num?)?.toInt();
        final hasSpecialBottle = template['hasSpecialBottle'] == true;
        final specialBottleConsumableId = template['specialBottleConsumableId'] as String?;
        final specialBottleExtraPrice = (template['specialBottleExtraPrice'] as num?)?.toDouble();

        final templateName = (template['name'] as String? ?? templateCode).trim();

        variants.add(
          ProductVariant(
            id: templateId,
            code: templateCode,
            name: templateName,
            label: _variantLabel(template),
            type: _variantType(template['packagingType'] as String?),
            price: price,
            perfumeMl: perfumeMl,
            essenceMl: essenceMl,
            hasSpecialBottle: hasSpecialBottle,
            specialBottleConsumableId: specialBottleConsumableId,
            specialBottleExtraPrice: specialBottleExtraPrice,
          ),
        );
      }

      variants.sort(_sortVariants);

      products.add(
        ProductItem(
          id: doc.id,
          code: productCode,
          name: name,
          category: categoryById[data['categoryId'] as String? ?? ''] ?? 'Uncategorized',
          variants: variants,
        ),
      );
    }

    products.sort((left, right) => left.name.compareTo(right.name));

    return PosCatalog(
      categories: ['All', ...categoryNames],
      products: products,
    );
  }

  static int _sortVariants(ProductVariant left, ProductVariant right) {
    final typeCompare = left.type.index.compareTo(right.type.index);
    if (typeCompare != 0) {
      return typeCompare;
    }

    return left.label.compareTo(right.label);
  }

  static ProductVariantType _variantType(String? packagingType) {
    return packagingType == 'PACKAGED'
        ? ProductVariantType.packaged
        : ProductVariantType.bulk;
  }

  static String _variantLabel(Map<String, dynamic> template) {
    final size = (template['size'] as num?)?.toDouble();
    final unit = (template['unit'] as String? ?? '').trim();
    if (size == null || unit.isEmpty) {
      return (template['name'] as String? ?? 'Variant').trim();
    }

    final formattedSize = size == size.roundToDouble()
        ? size.round().toString()
        : size.toStringAsFixed(1);

    return '$formattedSize$unit';
  }
}