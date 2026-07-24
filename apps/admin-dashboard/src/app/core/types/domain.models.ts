export type FirestoreTimestampLike = Date | string;

export type TenantStatus = 'ACTIVE' | 'INACTIVE';
export type ProductGender = 'M' | 'F' | 'UNISEX';
export type ProductType = 'PERFUME' | 'OTHER';
export type PackagingType = 'BULK' | 'PACKAGED';
export type StockMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'ADJUSTMENT'
  | 'RETURN'
  | 'LOSS';
export type OrderStatus = 'COMPLETED';

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

// Firestore: tenants/{tenantId}/products/{productId}
export type Product = {
  tenantId: string;
  productCode: string;
  name: string;
  brandId: string;
  gender?: ProductGender;
  categoryId: string;
  productType: ProductType;
  isPremium?: boolean;
  active: boolean;
  createdAt: FirestoreTimestampLike;
  updatedAt?: FirestoreTimestampLike;
};

// Firestore: tenants/{tenantId}/variants/{variantId}
export type Variant = {
  tenantId: string;
  productId: string;
  sku?: string;
  size: number;
  unit: string;
  packagingType: PackagingType;
  isPremium?: boolean;
  costPrice: number;
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
  productId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
};

// Firestore: tenants/{tenantId}/orders/{orderId}
export type Order = {
  tenantId: string;
  employeeId: string;
  status: OrderStatus;
  subtotal?: number;
  discountTotal?: number;
  total: number;
  items: OrderItem[];
  createdAt: FirestoreTimestampLike;
};