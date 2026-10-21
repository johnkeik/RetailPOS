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

export type RecordableStockMovementType = Extract<
  StockMovementType,
  "PURCHASE" | "ADJUSTMENT" | "LOSS"
>;

// quantity is positive, except for ADJUSTMENT where the sign is the direction.
export type StockMovementLineInput = {
  productId: string;
  variantTemplateId: string;
  quantity: number;
};

export type RecordStockMovementsInput = {
  tenantId: string;
  type: RecordableStockMovementType;
  reason?: string;
  performedByEmployeeId?: string;
  lines: StockMovementLineInput[];
};

export type OrderItemInput = {
  productId: string;
  variantTemplateId: string;
  quantity: number;
  unitPrice: number;
  useSpecialBottle?: boolean;
};

export type PaymentMethod = "CARD" | "CASH";

export type CreateOrderInput = {
  tenantId: string;
  employeeId: string;
  items: OrderItemInput[];
  paymentMethod?: PaymentMethod;
};

export type CreateExpenseInput = {
  tenantId: string;
  employeeId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description: string;
};

export type UpdateExpenseInput = {
  tenantId: string;
  expenseId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  description: string;
};

export type DeleteExpenseInput = {
  tenantId: string;
  expenseId: string;
};

export type SetManagerPinInput = {
  tenantId: string;
  pin: string;
};

export type CancelOrderInput = {
  tenantId: string;
  employeeId: string;
  orderId: string;
};

export type SeedMockOrdersInput = {
  tenantId: string;
  orders: Array<{
    employeeId: string;
    subtotal: number;
    discountTotal: number;
    total: number;
    createdAt: string;
    items: Array<{
      productId: string;
      variantId: string;
      variantTemplateId: string;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }>;
  }>;
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

export type DeleteBrandInput = {
  tenantId: string;
  brandId: string;
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

export type DeleteCategoryInput = {
  tenantId: string;
  categoryId: string;
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

export type DeleteEmployeeInput = {
  tenantId: string;
  employeeId: string;
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
  ingredients?: string;
  variantAssignments?: Record<string, ProductVariantAssignment>;
  variantOrder?: string[];
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
  ingredients?: string;
  variantAssignments?: Record<string, ProductVariantAssignment>;
  variantOrder?: string[];
  active: boolean;
};

export type AssignVariantToProductsInput = {
  operation?: "ADD" | "UPDATE_PRICE";
  tenantId: string;
  productIds: string[];
  variantTemplateId: string;
};

export type ToggleProductActiveInput = {
  tenantId: string;
  productId: string;
  active: boolean;
};

export type DeleteProductInput = {
  tenantId: string;
  productId: string;
};

export type PackagingType = "BULK" | "PACKAGED";
export type PackagingCategory = "BULK" | "PACKAGED";

export const BULK_INVENTORY_SENTINEL = "bulk";

export type ConsumablePart = {
  variantTemplateId: string;
  quantity: number;
};

// Recipe consumable specification for a variant
export type VariantRecipeConsumable = {
  consumableId: string;
  quantity: number;
};

// Consumable entity
export type Consumable = {
  id: string;
  tenantId: string;
  name: string;
  code?: string;
  unit: string;
  costPrice?: number;
  active: boolean;
  createdAt: unknown;
  updatedAt?: unknown;
};

export type CreateConsumableInput = {
  tenantId: string;
  name: string;
  code?: string;
  unit?: string;
  costPrice?: number;
  active?: boolean;
};

export type UpdateConsumableInput = {
  tenantId: string;
  consumableId: string;
  name: string;
  code?: string;
  unit?: string;
  costPrice?: number;
  active: boolean;
};

export type ToggleConsumableActiveInput = {
  tenantId: string;
  consumableId: string;
  active: boolean;
};

export type DeleteConsumableInput = {
  tenantId: string;
  consumableId: string;
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
  perfumeMl?: number;
  essenceMl?: number;
  recipeConsumables?: VariantRecipeConsumable[];
  consumableParts?: ConsumablePart[];
  hasSpecialBottle?: boolean;
  specialBottleConsumableId?: string;
  specialBottleExtraPrice?: number;
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
  perfumeMl?: number;
  essenceMl?: number;
  recipeConsumables?: VariantRecipeConsumable[];
  consumableParts?: ConsumablePart[];
  hasSpecialBottle?: boolean;
  specialBottleConsumableId?: string;
  specialBottleExtraPrice?: number;
  active: boolean;
};

export type ToggleVariantTemplateActiveInput = {
  tenantId: string;
  templateId: string;
  active: boolean;
};

export type DeleteVariantTemplateInput = {
  tenantId: string;
  templateId: string;
};
