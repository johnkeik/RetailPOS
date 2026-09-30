import { PackagingCategory, ProductGender } from '../../../core/types/domain.models';

type MockBrandSeed = {
  code: string;
  name: string;
};

type MockCategorySeed = {
  code: string;
  name: string;
};

type MockVariantTemplateSeed = {
  code: string;
  name: string;
  size: number;
  unit: 'ml';
  packagingType: 'BULK' | 'PACKAGED';
  sellingPrice: number;
  costPrice: number;
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
  variantAssignments: MockVariantAssignmentSeed[];
};

const bulkAssignments = (base: number): MockVariantAssignmentSeed[] => [
  { templateCode: 'BULK-50', sellingPrice: base, costPrice: Math.round(base * 0.45) },
  { templateCode: 'BULK-100', sellingPrice: Math.round(base * 1.7), costPrice: Math.round(base * 0.76) },
  { templateCode: 'BULK-150', sellingPrice: Math.round(base * 2.25), costPrice: Math.round(base * 1.0) },
];

const premiumAssignments = (base: number): MockVariantAssignmentSeed[] => [
  { templateCode: 'PREM-50', sellingPrice: base, costPrice: Math.round(base * 0.52) },
  { templateCode: 'PREM-100', sellingPrice: Math.round(base * 1.82), costPrice: Math.round(base * 0.95) },
  { templateCode: 'PREM-150', sellingPrice: Math.round(base * 2.45), costPrice: Math.round(base * 1.28) },
];

const packagedAssignments = (base: number): MockVariantAssignmentSeed[] => [
  { templateCode: 'PACK-30', sellingPrice: Math.round(base * 0.78), costPrice: Math.round(base * 0.37) },
  { templateCode: 'PACK-50', sellingPrice: base, costPrice: Math.round(base * 0.46) },
  { templateCode: 'PACK-100', sellingPrice: Math.round(base * 1.75), costPrice: Math.round(base * 0.81) },
  { templateCode: 'PACK-150', sellingPrice: Math.round(base * 2.35), costPrice: Math.round(base * 1.08) },
];

// Hybrid is now normalised to BULK — a product cannot mix packaging categories
const hybridAssignments = (base: number): MockVariantAssignmentSeed[] => bulkAssignments(base);

export const mockCatalogData = {
  brands: <MockBrandSeed[]>[
    { code: 'AUR', name: 'Aurelia' },
    { code: 'NVX', name: 'Novex' },
    { code: 'SLN', name: 'Solenne' },
    { code: 'VLT', name: 'Velour' },
    { code: 'AZR', name: 'Azura' },
    { code: 'MRC', name: 'Monarch' },
    { code: 'ELY', name: 'Elysian' },
    { code: 'CRN', name: 'Cinder' },
    { code: 'ARB', name: 'Arbor' },
    { code: 'NCT', name: 'Noctis' },
  ],
  categories: <MockCategorySeed[]>[
    { code: 'MEN', name: 'Men Perfumes' },
    { code: 'WMN', name: 'Women Perfumes' },
    { code: 'UNX', name: 'Unisex Perfumes' },
    { code: 'SIG', name: 'Signature Collection' },
    { code: 'PRM', name: 'Premium Collection' },
  ],
  variantTemplates: <MockVariantTemplateSeed[]>[
    { code: 'Χυμα 30ml',  name: 'Bulk 50ml',      size: 50,  unit: 'ml', packagingType: 'BULK',     sellingPrice: 24, costPrice: 11 },
    { code: 'BULK-100', name: 'Bulk 100ml',     size: 100, unit: 'ml', packagingType: 'BULK',     sellingPrice: 41, costPrice: 19 },
    { code: 'BULK-150', name: 'Bulk 150ml',     size: 150, unit: 'ml', packagingType: 'BULK',     sellingPrice: 56, costPrice: 26 },
    { code: 'PREM-50',  name: 'Prem 50ml',      size: 50,  unit: 'ml', packagingType: 'BULK',     sellingPrice: 34, costPrice: 18 },
    { code: 'PREM-100', name: 'Prem 100ml',     size: 100, unit: 'ml', packagingType: 'BULK',     sellingPrice: 59, costPrice: 31 },
    { code: 'PREM-150', name: 'Prem 150ml',     size: 150, unit: 'ml', packagingType: 'BULK',     sellingPrice: 78, costPrice: 42 },
    { code: 'PACK-30',  name: 'Packaged 30ml',  size: 30,  unit: 'ml', packagingType: 'PACKAGED', sellingPrice: 22, costPrice: 10 },
    { code: 'PACK-50',  name: 'Packaged 50ml',  size: 50,  unit: 'ml', packagingType: 'PACKAGED', sellingPrice: 29, costPrice: 14 },
    { code: 'PACK-100', name: 'Packaged 100ml', size: 100, unit: 'ml', packagingType: 'PACKAGED', sellingPrice: 49, costPrice: 24 },
    { code: 'PACK-150', name: 'Packaged 150ml', size: 150, unit: 'ml', packagingType: 'PACKAGED', sellingPrice: 65, costPrice: 31 },
  ],
  products: <MockProductSeed[]>[
    { productCode: '310001', name: 'Aurelia Velvet Dawn',    brandCode: 'AUR', categoryCode: 'WMN', gender: 'F',      packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(32) },
    { productCode: '310002', name: 'Aurelia Citrus Veil',    brandCode: 'AUR', categoryCode: 'WMN', gender: 'F',      packagingCategory: 'BULK',     variantAssignments: hybridAssignments(29) },
    { productCode: '310003', name: 'Aurelia White Fig',      brandCode: 'AUR', categoryCode: 'UNX', gender: 'UNISEX', packagingCategory: 'BULK',     variantAssignments: bulkAssignments(26) },
    { productCode: '310004', name: 'Aurelia Rose Ember',     brandCode: 'AUR', categoryCode: 'PRM', gender: 'F',      packagingCategory: 'BULK',     variantAssignments: premiumAssignments(41) },
    { productCode: '310005', name: 'Aurelia Golden Iris',    brandCode: 'AUR', categoryCode: 'SIG', gender: 'F',      packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(36) },
    { productCode: '310006', name: 'Novex Iron Cedar',       brandCode: 'NVX', categoryCode: 'MEN', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: bulkAssignments(27) },
    { productCode: '310007', name: 'Novex Night Voltage',    brandCode: 'NVX', categoryCode: 'MEN', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: hybridAssignments(31) },
    { productCode: '310008', name: 'Novex Carbon Bloom',     brandCode: 'NVX', categoryCode: 'UNX', gender: 'UNISEX', packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(30) },
    { productCode: '310009', name: 'Novex Reserve Smoke',    brandCode: 'NVX', categoryCode: 'PRM', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: premiumAssignments(44) },
    { productCode: '310010', name: 'Novex Amber Transit',    brandCode: 'NVX', categoryCode: 'SIG', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: bulkAssignments(33) },
    { productCode: '310011', name: 'Solenne Petal Haze',     brandCode: 'SLN', categoryCode: 'WMN', gender: 'F',      packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(31) },
    { productCode: '310012', name: 'Solenne Sugar Neroli',   brandCode: 'SLN', categoryCode: 'WMN', gender: 'F',      packagingCategory: 'BULK',     variantAssignments: hybridAssignments(28) },
    { productCode: '310013', name: 'Solenne Linen Glow',     brandCode: 'SLN', categoryCode: 'UNX', gender: 'UNISEX', packagingCategory: 'BULK',     variantAssignments: bulkAssignments(24) },
    { productCode: '310014', name: 'Solenne Imperial Bloom', brandCode: 'SLN', categoryCode: 'PRM', gender: 'F',      packagingCategory: 'BULK',     variantAssignments: premiumAssignments(43) },
    { productCode: '310015', name: 'Solenne Cocoa Petals',   brandCode: 'SLN', categoryCode: 'SIG', gender: 'F',      packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(35) },
    { productCode: '310016', name: 'Velour Atlas Spice',     brandCode: 'VLT', categoryCode: 'MEN', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: bulkAssignments(29) },
    { productCode: '310017', name: 'Velour Driftwood Mint',  brandCode: 'VLT', categoryCode: 'MEN', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: hybridAssignments(34) },
    { productCode: '310018', name: 'Velour Salted Musk',     brandCode: 'VLT', categoryCode: 'UNX', gender: 'UNISEX', packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(33) },
    { productCode: '310019', name: 'Velour Grand Leather',   brandCode: 'VLT', categoryCode: 'PRM', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: premiumAssignments(47) },
    { productCode: '310020', name: 'Velour Saffron Trace',   brandCode: 'VLT', categoryCode: 'SIG', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: bulkAssignments(36) },
    { productCode: '310021', name: 'Azura Sea Magnolia',     brandCode: 'AZR', categoryCode: 'WMN', gender: 'F',      packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(30) },
    { productCode: '310022', name: 'Azura Blue Petal',       brandCode: 'AZR', categoryCode: 'WMN', gender: 'F',      packagingCategory: 'BULK',     variantAssignments: hybridAssignments(27) },
    { productCode: '310023', name: 'Azura Mineral Sky',      brandCode: 'AZR', categoryCode: 'UNX', gender: 'UNISEX', packagingCategory: 'BULK',     variantAssignments: bulkAssignments(25) },
    { productCode: '310024', name: 'Azura Royal Current',    brandCode: 'AZR', categoryCode: 'PRM', gender: 'UNISEX', packagingCategory: 'BULK',     variantAssignments: premiumAssignments(42) },
    { productCode: '310025', name: 'Azura Basil Shore',      brandCode: 'AZR', categoryCode: 'SIG', gender: 'UNISEX', packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(34) },
    { productCode: '310026', name: 'Monarch Ember Crown',    brandCode: 'MRC', categoryCode: 'MEN', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: bulkAssignments(30) },
    { productCode: '310027', name: 'Monarch Fig Regent',     brandCode: 'MRC', categoryCode: 'MEN', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: hybridAssignments(35) },
    { productCode: '310028', name: 'Monarch Pear Archive',   brandCode: 'MRC', categoryCode: 'UNX', gender: 'UNISEX', packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(32) },
    { productCode: '310029', name: 'Monarch Oud Reserve',    brandCode: 'MRC', categoryCode: 'PRM', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: premiumAssignments(49) },
    { productCode: '310030', name: 'Monarch Moss Ledger',    brandCode: 'MRC', categoryCode: 'SIG', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: bulkAssignments(37) },
    { productCode: '310031', name: 'Elysian Silk Orchard',   brandCode: 'ELY', categoryCode: 'WMN', gender: 'F',      packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(33) },
    { productCode: '310032', name: 'Elysian Honey Veil',     brandCode: 'ELY', categoryCode: 'WMN', gender: 'F',      packagingCategory: 'BULK',     variantAssignments: hybridAssignments(30) },
    { productCode: '310033', name: 'Elysian Glass Tea',      brandCode: 'ELY', categoryCode: 'UNX', gender: 'UNISEX', packagingCategory: 'BULK',     variantAssignments: bulkAssignments(28) },
    { productCode: '310034', name: 'Elysian Velvet Gold',    brandCode: 'ELY', categoryCode: 'PRM', gender: 'F',      packagingCategory: 'BULK',     variantAssignments: premiumAssignments(46) },
    { productCode: '310035', name: 'Elysian Cedar Pearl',    brandCode: 'ELY', categoryCode: 'SIG', gender: 'UNISEX', packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(36) },
    { productCode: '310036', name: 'Cinder Asphalt Bloom',   brandCode: 'CRN', categoryCode: 'MEN', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: bulkAssignments(28) },
    { productCode: '310037', name: 'Cinder Black Citrus',    brandCode: 'CRN', categoryCode: 'MEN', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: hybridAssignments(32) },
    { productCode: '310038', name: 'Cinder Soft Smoke',      brandCode: 'CRN', categoryCode: 'UNX', gender: 'UNISEX', packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(31) },
    { productCode: '310039', name: 'Cinder Platinum Ash',    brandCode: 'CRN', categoryCode: 'PRM', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: premiumAssignments(45) },
    { productCode: '310040', name: 'Cinder Fern Alloy',      brandCode: 'CRN', categoryCode: 'SIG', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: bulkAssignments(35) },
    { productCode: '310041', name: 'Arbor Cedar Milk',       brandCode: 'ARB', categoryCode: 'UNX', gender: 'UNISEX', packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(29) },
    { productCode: '310042', name: 'Arbor Pine Nectar',      brandCode: 'ARB', categoryCode: 'UNX', gender: 'UNISEX', packagingCategory: 'BULK',     variantAssignments: hybridAssignments(27) },
    { productCode: '310043', name: 'Arbor Green Resin',      brandCode: 'ARB', categoryCode: 'UNX', gender: 'UNISEX', packagingCategory: 'BULK',     variantAssignments: bulkAssignments(26) },
    { productCode: '310044', name: 'Arbor Antique Bark',     brandCode: 'ARB', categoryCode: 'PRM', gender: 'UNISEX', packagingCategory: 'BULK',     variantAssignments: premiumAssignments(43) },
    { productCode: '310045', name: 'Arbor Moss Lantern',     brandCode: 'ARB', categoryCode: 'SIG', gender: 'UNISEX', packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(34) },
    { productCode: '310046', name: 'Noctis Lunar Smoke',     brandCode: 'NCT', categoryCode: 'MEN', gender: 'M',      packagingCategory: 'BULK',     variantAssignments: bulkAssignments(31) },
    { productCode: '310047', name: 'Noctis Violet Circuit',  brandCode: 'NCT', categoryCode: 'WMN', gender: 'F',      packagingCategory: 'BULK',     variantAssignments: hybridAssignments(33) },
    { productCode: '310048', name: 'Noctis Quiet Static',    brandCode: 'NCT', categoryCode: 'UNX', gender: 'UNISEX', packagingCategory: 'PACKAGED', variantAssignments: packagedAssignments(30) },
    { productCode: '310049', name: 'Noctis Black Reserve',   brandCode: 'NCT', categoryCode: 'PRM', gender: 'UNISEX', packagingCategory: 'BULK',     variantAssignments: premiumAssignments(48) },
    { productCode: '310050', name: 'Noctis Silver Echo',     brandCode: 'NCT', categoryCode: 'SIG', gender: 'UNISEX', packagingCategory: 'BULK',     variantAssignments: bulkAssignments(38) },
  ],
};

export type { MockBrandSeed, MockCategorySeed, MockProductSeed, MockVariantAssignmentSeed, MockVariantTemplateSeed };
