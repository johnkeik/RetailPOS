import { PackagingCategory, ProductGender } from '../../../core/types/domain.models';

type MockBrandSeed = {
  code: string;
  name: string;
};

type MockCategorySeed = {
  code: string;
  name: string;
};

type MockConsumableSeed = {
  code: string;
  name: string;
  unit: string;
  costPrice: number;
};

type MockRecipeConsumableSeed = {
  consumableCode: string;
  quantity: number;
};

type MockVariantTemplateSeed = {
  code: string;
  name: string;
  size: number;
  unit: 'ml';
  packagingType: 'BULK' | 'PACKAGED';
  sellingPrice: number;
  costPrice: number;
  perfumeMl?: number;
  essenceMl?: number;
  recipeConsumables?: MockRecipeConsumableSeed[];
};

type MockVariantAssignmentSeed = {
  templateCode: string;
  sellingPrice: number;
  costPrice: number;
};

type MockProductSeed = {
  productCode: string;
  name: string;
  brandCode: string;
  categoryCode: string;
  gender: ProductGender;
  packagingCategory: PackagingCategory;
  perfumeBaseCode?: string;
  essenceCode?: string;
  variantAssignments: MockVariantAssignmentSeed[];
};

const bulkAssignments = (base: number): MockVariantAssignmentSeed[] => [
  { templateCode: 'BULK-30', sellingPrice: Math.round(base * 0.7), costPrice: Math.round(base * 0.3) },
  { templateCode: 'BULK-50', sellingPrice: base, costPrice: Math.round(base * 0.42) },
  { templateCode: 'BULK-100', sellingPrice: Math.round(base * 1.7), costPrice: Math.round(base * 0.72) },
  { templateCode: 'BULK-150', sellingPrice: Math.round(base * 2.3), costPrice: Math.round(base * 0.98) },
];

const premiumAssignments = (base: number): MockVariantAssignmentSeed[] => [
  { templateCode: 'PREM-30', sellingPrice: Math.round(base * 0.72), costPrice: Math.round(base * 0.35) },
  { templateCode: 'PREM-50', sellingPrice: base, costPrice: Math.round(base * 0.48) },
  { templateCode: 'PREM-100', sellingPrice: Math.round(base * 1.8), costPrice: Math.round(base * 0.85) },
];

const packagedAssignments = (base: number): MockVariantAssignmentSeed[] => [
  { templateCode: 'PACK-30', sellingPrice: Math.round(base * 0.75), costPrice: Math.round(base * 0.35) },
  { templateCode: 'PACK-50', sellingPrice: base, costPrice: Math.round(base * 0.45) },
  { templateCode: 'PACK-100', sellingPrice: Math.round(base * 1.75), costPrice: Math.round(base * 0.78) },
];

export const mockCatalogData = {
  brands: <MockBrandSeed[]>[
    { code: 'DIO', name: 'Dior' },
    { code: 'CHN', name: 'Chanel' },
    { code: 'YSL', name: 'Yves Saint Laurent' },
    { code: 'CRD', name: 'Creed' },
    { code: 'TMF', name: 'Tom Ford' },
    { code: 'MFK', name: 'Maison Francis Kurkdjian' },
    { code: 'LNC', name: 'Lancôme' },
    { code: 'ARM', name: 'Giorgio Armani' },
    { code: 'LLB', name: 'Le Labo' },
    { code: 'CAR', name: 'Carolina Herrera' },
  ],
  categories: <MockCategorySeed[]>[
    { code: 'MEN', name: 'Ανδρικά Αρώματα' },
    { code: 'WMN', name: 'Γυναικεία Αρώματα' },
    { code: 'UNX', name: 'Unisex Αρώματα' },
    { code: 'SIG', name: 'Signature Collection' },
    { code: 'PRM', name: 'Premium Collection' },
  ],
  consumables: <MockConsumableSeed[]>[
    { code: 'BTL-30', name: 'Μπουκάλι 30ml', unit: 'τεμ.', costPrice: 0.45 },
    { code: 'BTL-50', name: 'Μπουκάλι 50ml', unit: 'τεμ.', costPrice: 0.60 },
    { code: 'BTL-100', name: 'Μπουκάλι 100ml', unit: 'τεμ.', costPrice: 0.85 },
    { code: 'BTL-150', name: 'Μπουκάλι 150ml', unit: 'τεμ.', costPrice: 1.10 },
    { code: 'PMP-STD', name: 'Βαλβίδα Spray (Pump)', unit: 'τεμ.', costPrice: 0.30 },
    { code: 'CAP-STD', name: 'Καπάκι Standard', unit: 'τεμ.', costPrice: 0.20 },
    { code: 'CAP-MAG', name: 'Καπάκι Μαγνητικό', unit: 'τεμ.', costPrice: 0.50 },
  ],
  variantTemplates: <MockVariantTemplateSeed[]>[
    // 4 Bulk Standard variants (συνταγή: ~80% άρωμα, 20% εσάνς)
    {
      code: 'BULK-30',
      name: 'Χύμα 30ml',
      size: 30,
      unit: 'ml',
      packagingType: 'BULK',
      sellingPrice: 15,
      costPrice: 6,
      perfumeMl: 24,
      essenceMl: 6,
      recipeConsumables: [
        { consumableCode: 'BTL-30', quantity: 1 },
        { consumableCode: 'PMP-STD', quantity: 1 },
        { consumableCode: 'CAP-STD', quantity: 1 }
      ]
    },
    {
      code: 'BULK-50',
      name: 'Χύμα 50ml',
      size: 50,
      unit: 'ml',
      packagingType: 'BULK',
      sellingPrice: 22,
      costPrice: 9,
      perfumeMl: 40,
      essenceMl: 10,
      recipeConsumables: [
        { consumableCode: 'BTL-50', quantity: 1 },
        { consumableCode: 'PMP-STD', quantity: 1 },
        { consumableCode: 'CAP-STD', quantity: 1 }
      ]
    },
    {
      code: 'BULK-100',
      name: 'Χύμα 100ml',
      size: 100,
      unit: 'ml',
      packagingType: 'BULK',
      sellingPrice: 38,
      costPrice: 15,
      perfumeMl: 80,
      essenceMl: 20,
      recipeConsumables: [
        { consumableCode: 'BTL-100', quantity: 1 },
        { consumableCode: 'PMP-STD', quantity: 1 },
        { consumableCode: 'CAP-STD', quantity: 1 }
      ]
    },
    {
      code: 'BULK-150',
      name: 'Χύμα 150ml',
      size: 150,
      unit: 'ml',
      packagingType: 'BULK',
      sellingPrice: 52,
      costPrice: 21,
      perfumeMl: 120,
      essenceMl: 30,
      recipeConsumables: [
        { consumableCode: 'BTL-150', quantity: 1 },
        { consumableCode: 'PMP-STD', quantity: 1 },
        { consumableCode: 'CAP-STD', quantity: 1 }
      ]
    },

    // 3 Premium Bulk variants (συνταγή: ~70% άρωμα, 30% εσάνς + μαγνητικό καπάκι)
    {
      code: 'PREM-30',
      name: 'Premium 30ml',
      size: 30,
      unit: 'ml',
      packagingType: 'BULK',
      sellingPrice: 20,
      costPrice: 8,
      perfumeMl: 21,
      essenceMl: 9,
      recipeConsumables: [
        { consumableCode: 'BTL-30', quantity: 1 },
        { consumableCode: 'PMP-STD', quantity: 1 },
        { consumableCode: 'CAP-MAG', quantity: 1 }
      ]
    },
    {
      code: 'PREM-50',
      name: 'Premium 50ml',
      size: 50,
      unit: 'ml',
      packagingType: 'BULK',
      sellingPrice: 30,
      costPrice: 12,
      perfumeMl: 35,
      essenceMl: 15,
      recipeConsumables: [
        { consumableCode: 'BTL-50', quantity: 1 },
        { consumableCode: 'PMP-STD', quantity: 1 },
        { consumableCode: 'CAP-MAG', quantity: 1 }
      ]
    },
    {
      code: 'PREM-100',
      name: 'Premium 100ml',
      size: 100,
      unit: 'ml',
      packagingType: 'BULK',
      sellingPrice: 52,
      costPrice: 22,
      perfumeMl: 70,
      essenceMl: 30,
      recipeConsumables: [
        { consumableCode: 'BTL-100', quantity: 1 },
        { consumableCode: 'PMP-STD', quantity: 1 },
        { consumableCode: 'CAP-MAG', quantity: 1 }
      ]
    },

    // 3 Packaged variants (έτοιμα συσκευασμένα προϊόντα)
    {
      code: 'PACK-30',
      name: 'Συσκευασμένο 30ml',
      size: 30,
      unit: 'ml',
      packagingType: 'PACKAGED',
      sellingPrice: 25,
      costPrice: 10
    },
    {
      code: 'PACK-50',
      name: 'Συσκευασμένο 50ml',
      size: 50,
      unit: 'ml',
      packagingType: 'PACKAGED',
      sellingPrice: 35,
      costPrice: 15
    },
    {
      code: 'PACK-100',
      name: 'Συσκευασμένο 100ml',
      size: 100,
      unit: 'ml',
      packagingType: 'PACKAGED',
      sellingPrice: 58,
      costPrice: 25
    },
  ],
  products: <MockProductSeed[]>[
    {
      productCode: '310001',
      name: 'Sauvage Type',
      brandCode: 'DIO',
      categoryCode: 'MEN',
      gender: 'M',
      packagingCategory: 'BULK',
      perfumeBaseCode: 'PRF-SAUV',
      essenceCode: 'ESS-SAUV',
      variantAssignments: bulkAssignments(22)
    },
    {
      productCode: '310002',
      name: 'Black Opium Type',
      brandCode: 'YSL',
      categoryCode: 'WMN',
      gender: 'F',
      packagingCategory: 'BULK',
      perfumeBaseCode: 'PRF-BLKO',
      essenceCode: 'ESS-BLKO',
      variantAssignments: bulkAssignments(22)
    },
    {
      productCode: '310003',
      name: 'Baccarat Rouge 540 Type',
      brandCode: 'MFK',
      categoryCode: 'PRM',
      gender: 'UNISEX',
      packagingCategory: 'BULK',
      perfumeBaseCode: 'PRF-BR54',
      essenceCode: 'ESS-BR54',
      variantAssignments: premiumAssignments(32)
    },
    {
      productCode: '310004',
      name: 'Aventus Type',
      brandCode: 'CRD',
      categoryCode: 'MEN',
      gender: 'M',
      packagingCategory: 'BULK',
      perfumeBaseCode: 'PRF-AVNT',
      essenceCode: 'ESS-AVNT',
      variantAssignments: premiumAssignments(34)
    },
    {
      productCode: '310005',
      name: 'Good Girl Type',
      brandCode: 'CAR',
      categoryCode: 'WMN',
      gender: 'F',
      packagingCategory: 'BULK',
      perfumeBaseCode: 'PRF-GDGL',
      essenceCode: 'ESS-GDGL',
      variantAssignments: bulkAssignments(22)
    },
    {
      productCode: '310006',
      name: 'Tobacco Vanille Type',
      brandCode: 'TMF',
      categoryCode: 'SIG',
      gender: 'UNISEX',
      packagingCategory: 'BULK',
      perfumeBaseCode: 'PRF-TBVN',
      essenceCode: 'ESS-TBVN',
      variantAssignments: premiumAssignments(36)
    },
    {
      productCode: '310007',
      name: 'La Vie Est Belle Type',
      brandCode: 'LNC',
      categoryCode: 'WMN',
      gender: 'F',
      packagingCategory: 'BULK',
      perfumeBaseCode: 'PRF-LVEB',
      essenceCode: 'ESS-LVEB',
      variantAssignments: bulkAssignments(22)
    },
    {
      productCode: '310008',
      name: 'Bleu de Chanel Type',
      brandCode: 'CHN',
      categoryCode: 'MEN',
      gender: 'M',
      packagingCategory: 'BULK',
      perfumeBaseCode: 'PRF-BLCH',
      essenceCode: 'ESS-BLCH',
      variantAssignments: bulkAssignments(24)
    },
    {
      productCode: '310009',
      name: 'Santal 33 Type',
      brandCode: 'LLB',
      categoryCode: 'UNX',
      gender: 'UNISEX',
      packagingCategory: 'PACKAGED',
      variantAssignments: packagedAssignments(45)
    },
    {
      productCode: '310010',
      name: 'Acqua Di Gio Type',
      brandCode: 'ARM',
      categoryCode: 'MEN',
      gender: 'M',
      packagingCategory: 'PACKAGED',
      variantAssignments: packagedAssignments(38)
    },
  ],
};

export type {
  MockBrandSeed,
  MockCategorySeed,
  MockConsumableSeed,
  MockProductSeed,
  MockRecipeConsumableSeed,
  MockVariantAssignmentSeed,
  MockVariantTemplateSeed
};


