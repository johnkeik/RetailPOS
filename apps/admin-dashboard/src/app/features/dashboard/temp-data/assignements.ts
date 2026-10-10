import { MockVariantAssignmentSeed } from "./mock-catalog.data";

export const normalAssignments = (
  base: number,
): MockVariantAssignmentSeed[] => [
  // =====================================================
  // SIMPLE PERFUME
  // =====================================================

  {
    templateCode: 'TRAVEL-10',
    sellingPrice: Math.round(base * 0.5),
    costPrice: Math.round(base * 0.2),
  },
  {
    templateCode: 'BULK-30',
    sellingPrice: Math.round(base * 0.7),
    costPrice: Math.round(base * 0.3),
  },
  {
    templateCode: 'BULK-50',
    sellingPrice: base,
    costPrice: Math.round(base * 0.42),
  },
  {
    templateCode: 'BULK-100',
    sellingPrice: Math.round(base * 1.7),
    costPrice: Math.round(base * 0.72),
  },

  // =====================================================
  // SIMPLE ROLL ON
  // =====================================================

  {
    templateCode: 'ROLLON-5',
    sellingPrice: Math.round(base * 0.35),
    costPrice: Math.round(base * 0.14),
  },
  {
    templateCode: 'ROLLON-10',
    sellingPrice: Math.round(base * 0.5),
    costPrice: Math.round(base * 0.2),
  },

  // =====================================================
  // BODY CREAM
  // =====================================================

  {
    templateCode: 'BODY-CREAM',
    sellingPrice: Math.round(base * 0.8),
    costPrice: Math.round(base * 0.32),
  },

  // =====================================================
  // GLITTER CREAM
  // =====================================================

  {
    templateCode: 'GLITTER-CREAM',
    sellingPrice: Math.round(base * 0.95),
    costPrice: Math.round(base * 0.38),
  },

  // =====================================================
  // CAR PERFUME
  // =====================================================

  {
    templateCode: 'CAR-FRESHENER',
    sellingPrice: Math.round(base * 0.45),
    costPrice: Math.round(base * 0.18),
  },

  // =====================================================
  // ROOM FRAGRANCE
  // =====================================================

  {
    templateCode: 'ROOM-FRESHENER',
    sellingPrice: Math.round(base * 0.8),
    costPrice: Math.round(base * 0.32),
  },
];

export const premiumAssignments = (
  base: number,
): MockVariantAssignmentSeed[] => [
  // =====================================================
  // PREMIUM PERFUME
  // =====================================================

  {
    templateCode: 'PREM-TRAVEL-10',
    sellingPrice: Math.round(base * 0.8),
    costPrice: Math.round(base * 0.32),
  },
  {
    templateCode: 'PREM-30',
    sellingPrice: Math.round(base * 0.95),
    costPrice: Math.round(base * 0.4),
  },
  {
    templateCode: 'PREM-50',
    sellingPrice: Math.round(base * 1.35),
    costPrice: Math.round(base * 0.58),
  },
  {
    templateCode: 'PREM-100',
    sellingPrice: Math.round(base * 2.2),
    costPrice: Math.round(base * 0.95),
  },

  // =====================================================
  // PREMIUM ROLL ON
  // =====================================================

  {
    templateCode: 'ROLLON-PREM-5',
    sellingPrice: Math.round(base * 0.6),
    costPrice: Math.round(base * 0.24),
  },
  {
    templateCode: 'ROLLON-PREM-10',
    sellingPrice: Math.round(base * 0.8),
    costPrice: Math.round(base * 0.32),
  },

  // =====================================================
  // PREMIUM BODY CREAM
  // =====================================================

  {
    templateCode: 'BODY-CREAM-PREMIUM',
    sellingPrice: Math.round(base * 1.05),
    costPrice: Math.round(base * 0.42),
  },

  // =====================================================
  // PREMIUM GLITTER CREAM
  // =====================================================

  {
    templateCode: 'GLITTER-CREAM-PREMIUM',
    sellingPrice: Math.round(base * 1.2),
    costPrice: Math.round(base * 0.48),
  },

  // =====================================================
  // PREMIUM BODY / CARE
  // =====================================================

  {
    templateCode: 'SHOWER-GEL-PREMIUM',
    sellingPrice: Math.round(base * 1.05),
    costPrice: Math.round(base * 0.42),
  },
  {
    templateCode: 'BODY-MILK-PREMIUM',
    sellingPrice: Math.round(base * 1.1),
    costPrice: Math.round(base * 0.44),
  },
  {
    templateCode: 'BODY-OIL-PREMIUM',
    sellingPrice: Math.round(base * 1.15),
    costPrice: Math.round(base * 0.46),
  },
  {
    templateCode: 'BODY-MIST-PREMIUM',
    sellingPrice: Math.round(base * 1.1),
    costPrice: Math.round(base * 0.44),
  },
  {
    templateCode: 'BODY-BUTTER-PREMIUM',
    sellingPrice: Math.round(base * 1.15),
    costPrice: Math.round(base * 0.46),
  },
  {
    templateCode: 'GLITTER-BODY-OIL-PREMIUM',
    sellingPrice: Math.round(base * 1.25),
    costPrice: Math.round(base * 0.5),
  },

  // =====================================================
  // PREMIUM CAR PERFUME
  // =====================================================

  {
    templateCode: 'CAR-FRESHENER-PREMIUM',
    sellingPrice: Math.round(base * 0.6),
    costPrice: Math.round(base * 0.24),
  },

  // =====================================================
  // PREMIUM ROOM FRAGRANCE
  // =====================================================

  {
    templateCode: 'ROOM-FRESHENER-PREMIUM',
    sellingPrice: Math.round(base * 1.05),
    costPrice: Math.round(base * 0.42),
  },
];

export const roomFreshenerAssignments = (
  base: number,
): MockVariantAssignmentSeed[] => [
  {
    templateCode: 'ROOM-FRESHENER',
    sellingPrice: Math.round(base * 0.8),
    costPrice: Math.round(base * 0.32),
  },
];