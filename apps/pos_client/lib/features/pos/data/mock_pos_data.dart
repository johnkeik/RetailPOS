import '../models/pos_models.dart';

const List<String> kPosCategories = <String>[
  'All',
  'Mens',
  'Womens',
  'Home Fragrance',
  'Body Care',
];

const List<ProductItem> kMockProducts = <ProductItem>[
  ProductItem(
    id: 'p1',
    code: '131107',
    name: 'ARMANI - SI W',
    category: 'Womens',
    variants: <ProductVariant>[
      ProductVariant(id: 'p1v1', code: '131107-50', label: '50ml', type: ProductVariantType.packaged, price: 30),
      ProductVariant(id: 'p1v2', code: '131107-100', label: '100ml', type: ProductVariantType.packaged, price: 52),
      ProductVariant(id: 'p1v3', code: '131107-B10', label: '10ml', type: ProductVariantType.bulk, price: 7),
    ],
  ),
  ProductItem(
    id: 'p2',
    code: '242708',
    name: 'ARMANI - STRONGER WITH YOU TOBACCO',
    category: 'Mens',
    variants: <ProductVariant>[
      ProductVariant(id: 'p2v1', code: '242708-50', label: '50ml', type: ProductVariantType.packaged, price: 44),
      ProductVariant(id: 'p2v2', code: '242708-100', label: '100ml', type: ProductVariantType.packaged, price: 69),
      ProductVariant(id: 'p2v3', code: '242708-B30', label: '30ml', type: ProductVariantType.bulk, price: 23),
    ],
  ),
  ProductItem(
    id: 'p3',
    code: '172146',
    name: 'ARMANI - STRONGER WITH YOU',
    category: 'Mens',
    variants: <ProductVariant>[
      ProductVariant(id: 'p3v1', code: '172146-50', label: '50ml', type: ProductVariantType.packaged, price: 41),
      ProductVariant(id: 'p3v2', code: '172146-100', label: '100ml', type: ProductVariantType.packaged, price: 64),
    ],
  ),
  ProductItem(
    id: 'p4',
    code: '221704',
    name: 'ARMANI - STRONGER WITH YOU ABSOLUTELY',
    category: 'Mens',
    variants: <ProductVariant>[
      ProductVariant(id: 'p4v1', code: '221704-50', label: '50ml', type: ProductVariantType.packaged, price: 46),
      ProductVariant(id: 'p4v2', code: '221704-B10', label: '10ml', type: ProductVariantType.bulk, price: 9),
    ],
  ),
  ProductItem(
    id: 'p5',
    code: '100374',
    name: 'AZZARO - CHROME M',
    category: 'Mens',
    variants: <ProductVariant>[
      ProductVariant(id: 'p5v1', code: '100374-50', label: '50ml', type: ProductVariantType.packaged, price: 28),
      ProductVariant(id: 'p5v2', code: '100374-100', label: '100ml', type: ProductVariantType.packaged, price: 45),
    ],
  ),
  ProductItem(
    id: 'p6',
    code: '171917',
    name: 'AZZARO - WANTED M',
    category: 'Mens',
    variants: <ProductVariant>[
      ProductVariant(id: 'p6v1', code: '171917-50', label: '50ml', type: ProductVariantType.packaged, price: 32),
      ProductVariant(id: 'p6v2', code: '171917-B30', label: '30ml', type: ProductVariantType.bulk, price: 18),
    ],
  ),
  ProductItem(
    id: 'p7',
    code: '130948',
    name: 'BENETTON - COLD UNI',
    category: 'Womens',
    variants: <ProductVariant>[
      ProductVariant(id: 'p7v1', code: '130948-50', label: '50ml', type: ProductVariantType.packaged, price: 24),
      ProductVariant(id: 'p7v2', code: '130948-B10', label: '10ml', type: ProductVariantType.bulk, price: 6),
    ],
  ),
  ProductItem(
    id: 'p8',
    code: '231082',
    name: 'BURBERRY - GODDESS',
    category: 'Womens',
    variants: <ProductVariant>[
      ProductVariant(id: 'p8v1', code: '231082-50', label: '50ml', type: ProductVariantType.packaged, price: 39),
      ProductVariant(id: 'p8v2', code: '231082-100', label: '100ml', type: ProductVariantType.packaged, price: 61),
      ProductVariant(id: 'p8v3', code: '231082-B30', label: '30ml', type: ProductVariantType.bulk, price: 21),
    ],
  ),
  ProductItem(
    id: 'p9',
    code: '191255',
    name: 'BURBERRY - HER',
    category: 'Womens',
    variants: <ProductVariant>[
      ProductVariant(id: 'p9v1', code: '191255-50', label: '50ml', type: ProductVariantType.packaged, price: 34),
      ProductVariant(id: 'p9v2', code: '191255-B10', label: '10ml', type: ProductVariantType.bulk, price: 8),
    ],
  ),
];
