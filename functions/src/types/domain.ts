export type StockMovementType =
  | "PURCHASE"
  | "SALE"
  | "ADJUSTMENT"
  | "RETURN"
  | "LOSS";

export type ProductGender = "M" | "F" | "UNISEX";
export type ProductType = "PERFUME" | "OTHER";

export type AppUserRole = "OWNER" | "EMPLOYEE";

export type ActorContext = {
  uid: string;
  tenantId: string;
  role: AppUserRole;
};

export type StockMutationInput = {
  tenantId: string;
  productId: string;
  variantTemplateId: string;
  quantityDelta: number;
  movementType: StockMovementType;
  reason?: string;
  orderId?: string;
  performedByEmployeeId?: string;
};

export type ReceiveStockInput = {
  tenantId: string;
  productId: string;
  variantTemplateId: string;
  quantity: number;
  reason?: string;
  performedByEmployeeId?: string;
};

export type AdjustStockInput = {
  tenantId: string;
  productId: string;
  variantTemplateId: string;
  quantityDelta: number;
  reason?: string;
  performedByEmployeeId?: string;
};

export type OrderItemInput = {
  productId: string;
  variantTemplateId: string;
  quantity: number;
  unitPrice: number;
};

export type CreateOrderInput = {
  tenantId: string;
  employeeId: string;
  items: OrderItemInput[];
};

export type CreateBrandInput = {
  tenantId: string;
  name: string;
  code?: string;
  active?: boolean;
};

export type UpdateBrandInput = {
  tenantId: string;
  brandId: string;
  name: string;
  code?: string;
  active: boolean;
};

export type ToggleBrandActiveInput = {
  tenantId: string;
  brandId: string;
  active: boolean;
};

export type CreateEmployeeInput = {
  tenantId: string;
  name: string;
  employeeCode: string;
  active?: boolean;
};

export type UpdateEmployeeInput = {
  tenantId: string;
  employeeId: string;
  name: string;
  employeeCode: string;
  active: boolean;
};

export type ToggleEmployeeActiveInput = {
  tenantId: string;
  employeeId: string;
  active: boolean;
};

export type CreateCategoryInput = {
  tenantId: string;
  name: string;
  code?: string;
  active?: boolean;
};

export type UpdateCategoryInput = {
  tenantId: string;
  categoryId: string;
  name: string;
  code?: string;
  active: boolean;
};

export type ToggleCategoryActiveInput = {
  tenantId: string;
  categoryId: string;
  active: boolean;
};

export type ProductVariantAssignment = {
  sellingPrice: number;
  costPrice?: number;
};

export type CreateProductInput = {
  tenantId: string;
  productCode: string;
  name: string;
  brandId: string;
  categoryId: string;
  productType: ProductType;
  packagingCategory: PackagingCategory;
  gender?: ProductGender;
  variantAssignments?: Record<string, ProductVariantAssignment>;
  active?: boolean;
};

export type UpdateProductInput = {
  tenantId: string;
  productId: string;
  productCode: string;
  name: string;
  brandId: string;
  categoryId: string;
  productType: ProductType;
  packagingCategory: PackagingCategory;
  gender?: ProductGender;
  variantAssignments?: Record<string, ProductVariantAssignment>;
  active: boolean;
};

export type ToggleProductActiveInput = {
  tenantId: string;
  productId: string;
  active: boolean;
};

export type PackagingType = "BULK" | "PACKAGED";
export type PackagingCategory = "BULK" | "PACKAGED";

export const BULK_INVENTORY_SENTINEL = "bulk";

export type ConsumablePart = {
  variantTemplateId: string;
  quantity: number;
};

export type CreateVariantTemplateInput = {
  tenantId: string;
  name: string;
  code?: string;
  size?: number;
  unit: string;
  packagingType: PackagingType;
  costPrice?: number;
  sellingPrice: number;
  consumableParts?: ConsumablePart[];
  active?: boolean;
};

export type UpdateVariantTemplateInput = {
  tenantId: string;
  templateId: string;
  name: string;
  code?: string;
  size?: number;
  unit: string;
  packagingType: PackagingType;
  costPrice?: number;
  sellingPrice: number;
  consumableParts?: ConsumablePart[];
  active: boolean;
};

export type ToggleVariantTemplateActiveInput = {
  tenantId: string;
  templateId: string;
  active: boolean;
};
