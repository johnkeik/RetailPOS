export const variants = [
  {
    code: 'TRAVEL-10',
    name: 'Travel 10ml',
    size: 10,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 8,
    costPrice: 0,
    perfumeMl: 8,
    essenceMl: 2,
    recipeConsumables: [{ consumableCode: 'BTL-TRAVEL-10', quantity: 1 }],
  },

  {
    code: 'BULK-30',
    name: 'Χύμα 30ml',
    size: 30,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 15,
    costPrice: 0,
    perfumeMl: 24,
    essenceMl: 6,
    recipeConsumables: [
      { consumableCode: 'BTL-30', quantity: 1 },
      { consumableCode: 'PMP-STD', quantity: 1 },
      { consumableCode: 'CAP-STD', quantity: 1 },
    ],
  },

  {
    code: 'BULK-50',
    name: 'Χύμα 50ml',
    size: 50,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 22,
    costPrice: 0,
    perfumeMl: 40,
    essenceMl: 10,
    recipeConsumables: [
      { consumableCode: 'BTL-50', quantity: 1 },
      { consumableCode: 'PMP-STD', quantity: 1 },
      { consumableCode: 'CAP-STD', quantity: 1 },
    ],
  },

  {
    code: 'BULK-100',
    name: 'Χύμα 100ml',
    size: 100,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 38,
    costPrice: 0,
    perfumeMl: 80,
    essenceMl: 20,
    recipeConsumables: [
      { consumableCode: 'BTL-100', quantity: 1 },
      { consumableCode: 'PMP-STD', quantity: 1 },
      { consumableCode: 'CAP-STD', quantity: 1 },
    ],
  },

  // =====================================================
  // PREMIUM PERFUME
  // =====================================================

  {
    code: 'PREM-TRAVEL-10',
    name: 'Premium Travel 10ml',
    size: 10,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 12,
    costPrice: 0,
    perfumeMl: 7,
    essenceMl: 3,
    recipeConsumables: [{ consumableCode: 'BTL-TRAVEL-10', quantity: 1 }],
  },

  {
    code: 'PREM-30',
    name: 'Premium 30ml',
    size: 30,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 20,
    costPrice: 0,
    perfumeMl: 21,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'BTL-PREM-30', quantity: 1 },
      { consumableCode: 'PMP-STD', quantity: 1 },
      { consumableCode: 'CAP-MAG', quantity: 1 },
    ],
  },

  {
    code: 'PREM-50',
    name: 'Premium 50ml',
    size: 50,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 30,
    costPrice: 0,
    perfumeMl: 35,
    essenceMl: 15,
    recipeConsumables: [
      { consumableCode: 'BTL-PREM-50', quantity: 1 },
      { consumableCode: 'PMP-STD', quantity: 1 },
      { consumableCode: 'CAP-MAG', quantity: 1 },
    ],
  },

  {
    code: 'PREM-100',
    name: 'Premium 100ml',
    size: 100,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 52,
    costPrice: 0,
    perfumeMl: 70,
    essenceMl: 30,
    recipeConsumables: [
      { consumableCode: 'BTL-PREM-100', quantity: 1 },
      { consumableCode: 'PMP-STD', quantity: 1 },
      { consumableCode: 'CAP-MAG', quantity: 1 },
    ],
  },

  // =====================================================
  // SIMPLE ROLL ON
  // =====================================================

  {
    code: 'ROLLON-5',
    name: 'Roll On 5ml',
    size: 5,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 6,
    costPrice: 0,
    perfumeMl: 4,
    essenceMl: 1,
    recipeConsumables: [{ consumableCode: 'ROLLON-5', quantity: 1 }],
  },

  {
    code: 'ROLLON-10',
    name: 'Roll On 10ml',
    size: 10,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 8,
    costPrice: 0,
    perfumeMl: 8,
    essenceMl: 2,
    recipeConsumables: [{ consumableCode: 'ROLLON-10', quantity: 1 }],
  },

  // =====================================================
  // PREMIUM ROLL ON
  // =====================================================

  {
    code: 'ROLLON-PREM-5',
    name: 'Premium Roll On 5ml',
    size: 5,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 9,
    costPrice: 0,
    perfumeMl: 3.5,
    essenceMl: 1.5,
    recipeConsumables: [{ consumableCode: 'ROLLON-PREM-5', quantity: 1 }],
  },

  {
    code: 'ROLLON-PREM-10',
    name: 'Premium Roll On 10ml',
    size: 10,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 12,
    costPrice: 0,
    perfumeMl: 7,
    essenceMl: 3,
    recipeConsumables: [{ consumableCode: 'ROLLON-PREM-10', quantity: 1 }],
  },

  // =====================================================
  // BODY CREAM
  // =====================================================

  {
    code: 'BODY-CREAM',
    name: 'Κρέμα Σώματος Απλή',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 12,
    costPrice: 0,
    recipeConsumables: [{ consumableCode: 'CREAM-BODY', quantity: 1 }],
  },

  {
    code: 'BODY-CREAM-PREMIUM',
    name: 'Κρέμα Σώματος Premium',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 16,
    costPrice: 0,
    recipeConsumables: [{ consumableCode: 'CREAM-BODY-PREMIUM', quantity: 1 }],
  },

  // =====================================================
  // GLITTER CREAM
  // =====================================================

  {
    code: 'GLITTER-CREAM',
    name: 'Glitter Κρέμα Απλή',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 14,
    costPrice: 0,
    recipeConsumables: [{ consumableCode: 'CREAM-GLITTER', quantity: 1 }],
  },

  {
    code: 'GLITTER-CREAM-PREMIUM',
    name: 'Glitter Κρέμα Premium',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 18,
    costPrice: 0,
    recipeConsumables: [
      { consumableCode: 'CREAM-GLITTER-PREMIUM', quantity: 1 },
    ],
  },

  // =====================================================
  // CAR PERFUME
  // =====================================================

  {
    code: 'CAR-FRESHENER',
    name: 'Αρωματικό Αυτοκινήτου',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 7,
    costPrice: 0,
    recipeConsumables: [{ consumableCode: 'CAR-FRESHENER', quantity: 1 }],
  },

  // =====================================================
  // ROOM FRAGRANCE
  // =====================================================

  {
    code: 'ROOM-FRESHENER',
    name: 'Αρωματικό Χώρου',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 10,
    costPrice: 0,
    recipeConsumables: [{ consumableCode: 'ROOM-FRESHENER', quantity: 1 }],
  },
  // =====================================================
// PREMIUM BODY / CARE
// =====================================================

{
  code: 'SHOWER-GEL-PREMIUM',
  name: 'Premium Shower Gel',
  size: 1,
  unit: 'pcs',
  packagingType: 'BULK',
  sellingPrice: 0,
  costPrice: 0,
  recipeConsumables: [
    { consumableCode: 'SHOWER-GEL', quantity: 1 },
  ],
},

{
  code: 'BODY-MILK-PREMIUM',
  name: 'Premium Body Milk',
  size: 1,
  unit: 'pcs',
  packagingType: 'BULK',
  sellingPrice: 0,
  costPrice: 0,
  recipeConsumables: [
    { consumableCode: 'BODY-MILK', quantity: 1 },
  ],
},

{
  code: 'BODY-OIL-PREMIUM',
  name: 'Premium Body Oil',
  size: 1,
  unit: 'pcs',
  packagingType: 'BULK',
  sellingPrice: 0,
  costPrice: 0,
  recipeConsumables: [
    { consumableCode: 'BODY-OIL', quantity: 1 },
  ],
},

{
  code: 'BODY-MIST-PREMIUM',
  name: 'Premium Body Mist',
  size: 1,
  unit: 'pcs',
  packagingType: 'BULK',
  sellingPrice: 0,
  costPrice: 0,
  recipeConsumables: [
    { consumableCode: 'BODY-MIST', quantity: 1 },
  ],
},

{
  code: 'BODY-BUTTER-PREMIUM',
  name: 'Premium Body Butter',
  size: 1,
  unit: 'pcs',
  packagingType: 'BULK',
  sellingPrice: 0,
  costPrice: 0,
  recipeConsumables: [
    { consumableCode: 'BODY-BUTTER', quantity: 1 },
  ],
},

{
  code: 'GLITTER-BODY-OIL-PREMIUM',
  name: 'Premium Glitter Body Oil',
  size: 1,
  unit: 'pcs',
  packagingType: 'BULK',
  sellingPrice: 0,
  costPrice: 0,
  recipeConsumables: [
    { consumableCode: 'GLITTER-BODY-OIL', quantity: 1 },
  ],
},

// =====================================================
// PREMIUM CAR PERFUME
// =====================================================

{
  code: 'CAR-FRESHENER-PREMIUM',
  name: 'Premium Αρωματικό Αυτοκινήτου',
  size: 1,
  unit: 'pcs',
  packagingType: 'BULK',
  sellingPrice: 0,
  costPrice: 0,
  recipeConsumables: [
    { consumableCode: 'CAR-FRESHENER', quantity: 1 },
  ],
},

// =====================================================
// PREMIUM ROOM FRAGRANCE
// =====================================================

{
  code: 'ROOM-FRESHENER-PREMIUM',
  name: 'Premium Αρωματικό Χώρου',
  size: 1,
  unit: 'pcs',
  packagingType: 'BULK',
  sellingPrice: 0,
  costPrice: 0,
  recipeConsumables: [
    { consumableCode: 'ROOM-FRESHENER', quantity: 1 },
  ],
},
];
