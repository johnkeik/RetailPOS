export type FirestoreTimestampLike = Date | string;

export type TenantStatus = 'ACTIVE' | 'INACTIVE';
export type ProductGender = 'M' | 'F' | 'UNISEX';
export type ProductType = 'PERFUME' | 'OTHER';
export type PackagingType = 'BULK' | 'PACKAGED';
export type PackagingCategory = 'BULK' | 'PACKAGED';
export type StockMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'ADJUSTMENT'
  | 'RETURN'
  | 'LOSS';
export type OrderStatus = 'COMPLETED' | 'CANCELLED';
export type PaymentMethod = 'CARD' | 'CASH';

// Firestore: tenants/{tenantId}
export type Tenant = {
  name: string;
  status: TenantStatus;
  createdAt: FirestoreTimestampLike;
  updatedAt?: FirestoreTimestampLike;
};

// Firestore: tenants/{tenantId}/employees/{employeeId}
export type Employee = {
  tenantId: string;
  name: string;
  employeeCode: string;
  active: boolean;
  createdAt: FirestoreTimestampLike;
  updatedAt?: FirestoreTimestampLike;
};

// Firestore: tenants/{tenantId}/brands/{brandId}
export type Brand = {
  tenantId: string;
  name: string;
  code?: string;
  active: boolean;
  createdAt: FirestoreTimestampLike;
};

// Firestore: tenants/{tenantId}/categories/{categoryId}
export type Category = {
  tenantId: string;
  name: string;
  code?: string;
  active: boolean;
  createdAt: FirestoreTimestampLike;
};

// Per-product pricing for an assigned variant template
export type ProductVariantAssignment = {
  sellingPrice: number;
  costPrice?: number;
};

// Firestore: tenants/{tenantId}/consumables/{consumableId}
export type Consumable = {
  id?: string;
  tenantId: string;
  name: string;
  code?: string;
  unit: string;
  costPrice?: number;
  active: boolean;
  createdAt: FirestoreTimestampLike;
  updatedAt?: FirestoreTimestampLike;
};

// Recipe consumable specification for a variant
export type VariantRecipeConsumable = {
  consumableId: string;
  quantity: number;
};

// Firestore: tenants/{tenantId}/products/{productId}
export type Product = {
  tenantId: string;
  productCode: string;
  name: string;
  brandId: string;
  gender?: ProductGender;
  categoryId: string;
  productType: ProductType;
  packagingCategory: PackagingCategory;
  ingredients?: string;
  // templateId → per-product pricing
  variantAssignments?: Record<string, ProductVariantAssignment>;
  variantOrder?: string[];
  isPremium?: boolean;
  active: boolean;
  createdAt: FirestoreTimestampLike;
  updatedAt?: FirestoreTimestampLike;
};

// A consumable part linked to a BULK variant template (legacy reference)
export type ConsumablePart = {
  variantTemplateId: string;
  quantity: number; // units consumed per sale/use
};

// Firestore: tenants/{tenantId}/variantTemplates/{templateId}
export type VariantTemplate = {
  tenantId: string;
  name: string;
  code?: string;
  size?: number;
  unit: string;
  packagingType: PackagingType;
  costPrice?: number;
  sellingPrice: number;
  perfumeMl?: number;
  essenceMl?: number;
  recipeConsumables?: VariantRecipeConsumable[];
  consumableParts?: ConsumablePart[];
  hasSpecialBottle?: boolean;
  specialBottleConsumableId?: string;
  specialBottleExtraPrice?: number;
  active: boolean;
  createdAt: FirestoreTimestampLike;
  updatedAt?: FirestoreTimestampLike;
};

// Firestore: tenants/{tenantId}/variants/{variantId}
export type Variant = {
  tenantId: string;
  productId: string;
  variantTemplateId?: string;
  variantTemplateName?: string;
  sku?: string;
  size?: number;
  unit: string;
  packagingType: PackagingType;
  isPremium?: boolean;
  costPrice?: number;
  sellingPrice: number;
  active: boolean;
  createdAt: FirestoreTimestampLike;
  updatedAt?: FirestoreTimestampLike;
};

// Firestore: tenants/{tenantId}/inventory/{inventoryId}
export type InventorySnapshot = {
  tenantId: string;
  productId: string;
  variantId: string;
  quantity: number;
  updatedAt: FirestoreTimestampLike;
};

// Firestore: tenants/{tenantId}/stockMovements/{movementId}
export type StockMovement = {
  tenantId: string;
  variantId: string;
  productId: string;
  type: StockMovementType;
  quantityDelta: number;
  reason?: string;
  orderId?: string;
  performedByEmployeeId?: string;
  createdAt: FirestoreTimestampLike;
};

export type OrderItem = {
  variantId: string;
  variantTemplateId?: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  useSpecialBottle?: boolean;
};

// Firestore: tenants/{tenantId}/orders/{orderId}
export type Order = {
  tenantId: string;
  employeeId: string;
  status: OrderStatus;
  paymentMethod?: PaymentMethod;
  subtotal?: number;
  discountTotal?: number;
  total: number;
  items: OrderItem[];
  createdAt: FirestoreTimestampLike;
};