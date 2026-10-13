export const variants = [
  // =====================================================
  // PERFUME
  // =====================================================

  {
    code: 'TRAVEL-10',
    name: 'Travel 10ml',
    size: 10,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 5,
    costPrice: 0,
    perfumeMl: 9,
    essenceMl: 1,
    recipeConsumables: [
      { consumableCode: 'BTL-TRAVEL-10', quantity: 1 },
    ],
  },

  {
    code: 'BULK-30',
    name: 'Χύμα 30ml',
    size: 30,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 8,
    costPrice: 0,
    perfumeMl: 27.5,
    essenceMl: 2.5,
    recipeConsumables: [
      { consumableCode: 'BTL-30', quantity: 1 },
      { consumableCode: 'PMP-STD', quantity: 1 },
    ],
    hasSpecialBottle: true,
    specialBottleConsumableCode: 'BTL-PREM-30',
    specialBottleExtraPrice: 2,
  },

  {
    code: 'BULK-50',
    name: 'Χύμα 50ml',
    size: 50,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 12,
    costPrice: 0,
    perfumeMl: 46,
    essenceMl: 4,
    recipeConsumables: [
      { consumableCode: 'BTL-50', quantity: 1 },
      { consumableCode: 'PMP-STD', quantity: 1 },
    ],
    hasSpecialBottle: true,
    specialBottleConsumableCode: 'BTL-PREM-50',
    specialBottleExtraPrice: 2,
  },

  {
    code: 'BULK-100',
    name: 'Χύμα 100ml',
    size: 100,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 18,
    costPrice: 0,
    perfumeMl: 91,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'BTL-100', quantity: 1 },
      { consumableCode: 'PMP-STD', quantity: 1 },
    ],
    hasSpecialBottle: true,
    specialBottleConsumableCode: 'BTL-PREM-100',
    specialBottleExtraPrice: 2,
  },

  // =====================================================
  // ROLL ON
  // =====================================================

  {
    code: 'ROLLON-5',
    name: 'Roll On 5ml',
    size: 5,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 5,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 6,
    recipeConsumables: [
      { consumableCode: 'ROLLON-5', quantity: 1 },
    ],
  },

  {
    code: 'ROLLON-10',
    name: 'Roll On 10ml',
    size: 10,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 10,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 12,
    recipeConsumables: [
      { consumableCode: 'ROLLON-10', quantity: 1 },
    ],
  },

  // =====================================================
  // BODY / CARE
  // =====================================================

  {
    code: 'SHOWER-GEL',
    name: 'Shower Gel',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 13,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'SHOWER-GEL', quantity: 1 },
    ],
  },

  {
    code: 'BODY-MILK',
    name: 'Body Milk',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 13,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'BODY-MILK', quantity: 1 },
    ],
  },

  {
    code: 'BODY-OIL',
    name: 'Body Oil',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 13,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'BODY-OIL', quantity: 1 },
    ],
  },

  {
    code: 'BODY-MIST',
    name: 'Body Mist',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 13,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'BODY-MIST', quantity: 1 },
    ],
  },

  {
    code: 'BODY-BUTTER',
    name: 'Body Butter',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 15,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'BODY-BUTTER', quantity: 1 },
    ],
  },

  {
    code: 'GLITTER-BODY-OIL',
    name: 'Glitter Body Oil',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 15,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'GLITTER-BODY-OIL', quantity: 1 },
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
    sellingPrice: 5,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 6,
    recipeConsumables: [
      { consumableCode: 'CAR-FRESHENER', quantity: 1 },
    ],
  },

  // =====================================================
  // ROOM FRAGRANCE
  // =====================================================

  {
    code: 'ROOM-FRESHENER-50',
    name: 'Αρωματικό Χώρου 50ml',
    size: 50,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 12,
    costPrice: 0,
    perfumeMl: 46,
    essenceMl: 4,
    recipeConsumables: [
      { consumableCode: 'ROOM-FRESHENER-50', quantity: 1 },
    ],
  },

  {
    code: 'ROOM-FRESHENER-100',
    name: 'Αρωματικό Χώρου 100ml',
    size: 100,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 17,
    costPrice: 0,
    perfumeMl: 91,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'ROOM-FRESHENER-100', quantity: 1 },
    ],
  },
];

export const premiumVariants = [
  // =====================================================
  // PREMIUM PERFUME
  // =====================================================

  {
    code: 'PREM-TRAVEL-10',
    name: 'Prem Travel 10ml',
    size: 10,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 7,
    costPrice: 0,
    perfumeMl: 9,
    essenceMl: 1,
    recipeConsumables: [
      { consumableCode: 'BTL-TRAVEL-10', quantity: 1 },
    ],
  },

  {
    code: 'PREM-BULK-30',
    name: 'Prem Χύμα 30ml',
    size: 30,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 10,
    costPrice: 0,
    perfumeMl: 27.5,
    essenceMl: 2.5,
    recipeConsumables: [
      { consumableCode: 'BTL-30', quantity: 1 },
      { consumableCode: 'PMP-STD', quantity: 1 },
    ],
    hasSpecialBottle: true,
    specialBottleConsumableCode: 'BTL-PREM-30',
    specialBottleExtraPrice: 2,
  },

  {
    code: 'PREM-BULK-50',
    name: 'Prem Χύμα 50ml',
    size: 50,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 15,
    costPrice: 0,
    perfumeMl: 46,
    essenceMl: 4,
    recipeConsumables: [
      { consumableCode: 'BTL-50', quantity: 1 },
      { consumableCode: 'PMP-STD', quantity: 1 },
    ],
    hasSpecialBottle: true,
    specialBottleConsumableCode: 'BTL-PREM-50',
    specialBottleExtraPrice: 2,
  },

  {
    code: 'PREM-BULK-100',
    name: 'Prem Χύμα 100ml',
    size: 100,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 25,
    costPrice: 0,
    perfumeMl: 91,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'BTL-100', quantity: 1 },
      { consumableCode: 'PMP-STD', quantity: 1 },
    ],
    hasSpecialBottle: true,
    specialBottleConsumableCode: 'BTL-PREM-100',
    specialBottleExtraPrice: 2,
  },

  // =====================================================
  // PREMIUM ROLL ON
  // =====================================================

  {
    code: 'PREM-ROLLON-5',
    name: 'Prem Roll On 5ml',
    size: 5,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 7,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 6,
    recipeConsumables: [
      { consumableCode: 'ROLLON-5', quantity: 1 },
    ],
  },

  {
    code: 'PREM-ROLLON-10',
    name: 'Prem Roll On 10ml',
    size: 10,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 12,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 12,
    recipeConsumables: [
      { consumableCode: 'ROLLON-10', quantity: 1 },
    ],
  },

  // =====================================================
  // PREMIUM BODY / CARE
  // =====================================================

  {
    code: 'PREM-SHOWER-GEL',
    name: 'Prem Shower Gel',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 15,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'SHOWER-GEL', quantity: 1 },
    ],
  },

  {
    code: 'PREM-BODY-MILK',
    name: 'Prem Body Milk',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 15,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'BODY-MILK', quantity: 1 },
    ],
  },

  {
    code: 'PREM-BODY-OIL',
    name: 'Prem Body Oil',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 15,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'BODY-OIL', quantity: 1 },
    ],
  },

  {
    code: 'PREM-BODY-MIST',
    name: 'Prem Body Mist',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 15,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'BODY-MIST', quantity: 1 },
    ],
  },

  {
    code: 'PREM-BODY-BUTTER',
    name: 'Prem Body Butter',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 17,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'BODY-BUTTER', quantity: 1 },
    ],
  },

  {
    code: 'PREM-GLITTER-BODY-OIL',
    name: 'Prem Glitter Body Oil',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 17,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'GLITTER-BODY-OIL', quantity: 1 },
    ],
  },

  // =====================================================
  // PREMIUM CAR PERFUME
  // =====================================================

  {
    code: 'PREM-CAR-FRESHENER',
    name: 'Prem Αρωματικό Αυτοκινήτου',
    size: 1,
    unit: 'pcs',
    packagingType: 'BULK',
    sellingPrice: 7,
    costPrice: 0,
    perfumeMl: 0,
    essenceMl: 6,
    recipeConsumables: [
      { consumableCode: 'CAR-FRESHENER', quantity: 1 },
    ],
  },

  // =====================================================
  // PREMIUM ROOM FRAGRANCE
  // =====================================================

  {
    code: 'PREM-ROOM-FRESHENER-50',
    name: 'Prem Αρωματικό Χώρου 50ml',
    size: 50,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 14,
    costPrice: 0,
    perfumeMl: 46,
    essenceMl: 4,
    recipeConsumables: [
      { consumableCode: 'ROOM-FRESHENER-50', quantity: 1 },
    ],
  },

  {
    code: 'PREM-ROOM-FRESHENER-100',
    name: 'Prem Αρωματικό Χώρου 100ml',
    size: 100,
    unit: 'ml',
    packagingType: 'BULK',
    sellingPrice: 19,
    costPrice: 0,
    perfumeMl: 91,
    essenceMl: 9,
    recipeConsumables: [
      { consumableCode: 'ROOM-FRESHENER-100', quantity: 1 },
    ],
  },
];
