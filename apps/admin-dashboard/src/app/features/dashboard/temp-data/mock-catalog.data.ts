import {
  PackagingCategory,
  ProductGender,
} from '../../../core/types/domain.models';
import { brands } from './brands.data';
import { consumables } from './consumables.data';
import { menCatalog } from './men-catalog.data';
import { priveCatalog } from './premium.data';
import { arabicCatalog, roomFragranceCatalog, unisexCatalog } from './unisex-arabic-rmf';
import { variants } from './variantTemplates.data';
import { womenCatalog } from './women-catalog.data';

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
  ingredients?: string;
  variantAssignments: MockVariantAssignmentSeed[];
};


export const mockCatalogData = {
  brands: <MockBrandSeed[]>brands,
  categories: <MockCategorySeed[]>[
    { code: 'MEN', name: 'Ανδρικά' },
    { code: 'WMN', name: 'Γυναικεία' },
    { code: 'UNX', name: 'Unisex' },
    { code: 'PRV', name: 'Prive' },
    { code: 'ARB', name: 'Αραβικά' },
    { code: 'RMF', name: 'Αρωματικά Χώρου' },
  ],
  consumables: <MockConsumableSeed[]>consumables,
  variantTemplates: <MockVariantTemplateSeed[]>variants,
  products: <MockProductSeed[]>[...menCatalog, ...womenCatalog, ...unisexCatalog, ...arabicCatalog, ...roomFragranceCatalog, ...priveCatalog],
};

export type {
  MockBrandSeed,
  MockCategorySeed,
  MockConsumableSeed,
  MockProductSeed,
  MockRecipeConsumableSeed,
  MockVariantAssignmentSeed,
  MockVariantTemplateSeed,
};
