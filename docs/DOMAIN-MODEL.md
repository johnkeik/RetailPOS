# DOMAIN MODEL

## Purpose

This document defines the MVP business entities for Perfume POS and their Firestore representation.

Design goals:
- Keep the model simple for MVP.
- Enforce tenant isolation on every business document.
- Keep inventory movement-based.
- Avoid ERP-level complexity and unnecessary fields.

## Firestore Tenant Strategy

Canonical strategy for MVP SaaS:
- Use tenant-scoped subcollections for all business entities.
- Require `tenantId` on every business document.
- Enforce tenant boundaries in Firestore rules and Cloud Functions.

Collections:
- `tenants`
- `tenants/{tenantId}/employees`
- `tenants/{tenantId}/brands`
- `tenants/{tenantId}/categories`
- `tenants/{tenantId}/products`
- `tenants/{tenantId}/variants`
- `tenants/{tenantId}/inventory`
- `tenants/{tenantId}/stockMovements`
- `tenants/{tenantId}/orders`

Tenant boundary rules:
- Read/write is allowed only when authenticated user tenant matches path `tenantId`.
- Cross-tenant queries are forbidden.
- All mutation functions validate `tenantId` ownership server-side.

---

## 1) Tenant

### Purpose
Represents one business account (one perfume store organization) in the SaaS.

### Firestore collection
`tenants`

### Fields
- `name` (string): business name.
- `status` (string): `ACTIVE` or `INACTIVE`.
- `createdAt` (timestamp): creation time.
- `updatedAt` (timestamp): last update time.

### Required fields
- `name`
- `status`
- `createdAt`

### Optional fields
- `updatedAt`

### Relationships
- One tenant owns many employees, products, variants, inventory rows, stock movements, orders, brands, and categories.

### Example document JSON
```json
{
  "name": "Store 001",
  "status": "ACTIVE",
  "createdAt": "2026-07-24T00:00:00Z",
  "updatedAt": "2026-07-24T00:00:00Z"
}
```

---

## 2) Employee

### Purpose
Represents a POS operator (store worker) who creates orders.

### Firestore collection
`tenants/{tenantId}/employees`

### Fields
- `tenantId` (string): owning tenant.
- `name` (string): display name.
- `employeeCode` (string): POS login code or PIN-like code for identification.
- `active` (boolean): whether employee can use POS.
- `createdAt` (timestamp): creation time.
- `updatedAt` (timestamp): last update time.

### Required fields
- `tenantId`
- `name`
- `employeeCode`
- `active`
- `createdAt`

### Optional fields
- `updatedAt`

### Relationships
- Many employees belong to one tenant.
- One employee creates many orders.
- `orders.employeeId` references `tenants/{tenantId}/employees/{employeeId}`.

### Example document JSON
```json
{
  "tenantId": "store001",
  "name": "Maria",
  "employeeCode": "123",
  "active": true,
  "createdAt": "2026-07-24T00:00:00Z",
  "updatedAt": "2026-07-24T00:00:00Z"
}
```

---

## 3) Brand

### Purpose
Groups products by fragrance brand (for filtering and organization).

### Firestore collection
`tenants/{tenantId}/brands`

### Fields
- `tenantId` (string): owning tenant.
- `name` (string): brand name.
- `code` (string): optional stable key for integrations/import.
- `active` (boolean): whether selectable in product forms.
- `createdAt` (timestamp): creation time.

### Required fields
- `tenantId`
- `name`
- `active`
- `createdAt`

### Optional fields
- `code`

### Relationships
- One brand is referenced by many products.
- `products.brandId` references `tenants/{tenantId}/brands/{brandId}`.

### Example document JSON
```json
{
  "tenantId": "store001",
  "name": "Armani",
  "code": "armani",
  "active": true,
  "createdAt": "2026-07-24T00:00:00Z"
}
```

---

## 4) Category

### Purpose
Classifies products into business categories (e.g., designer, niche).

### Firestore collection
`tenants/{tenantId}/categories`

### Fields
- `tenantId` (string): owning tenant.
- `name` (string): category label.
- `code` (string): optional stable key for filtering/import.
- `active` (boolean): whether selectable in product forms.
- `createdAt` (timestamp): creation time.

### Required fields
- `tenantId`
- `name`
- `active`
- `createdAt`

### Optional fields
- `code`

### Relationships
- One category is referenced by many products.
- `products.categoryId` references `tenants/{tenantId}/categories/{categoryId}`.

### Example document JSON
```json
{
  "tenantId": "store001",
  "name": "Designer",
  "code": "designer",
  "active": true,
  "createdAt": "2026-07-24T00:00:00Z"
}
```

---

## 5) Product

### Purpose
Represents the base perfume identity. This is what staff recognizes as the product family.

### Firestore collection
`tenants/{tenantId}/products`

### Fields
- `tenantId` (string): owning tenant.
- `productCode` (string): employee-facing catalog code.
- `name` (string): product name.
- `brandId` (string): reference to brand.
- `gender` (string): `M`, `F`, `UNISEX`.
- `categoryId` (string): reference to category.
- `productType` (string): `PERFUME` or `OTHER`.
- `isPremium` (boolean): premium product flag if needed.
- `active` (boolean): whether product is sellable.
- `createdAt` (timestamp): creation time.
- `updatedAt` (timestamp): last update time.

### Required fields
- `tenantId`
- `productCode`
- `name`
- `brandId`
- `categoryId`
- `productType`
- `active`
- `createdAt`

### Optional fields
- `gender`
- `isPremium`
- `updatedAt`

### Relationships
- Many products belong to one tenant.
- One product has many variants.
- `variants.productId` references `tenants/{tenantId}/products/{productId}`.

### Example document JSON
```json
{
  "tenantId": "store001",
  "productCode": "1001978",
  "name": "Armani Code",
  "brandId": "brand_armani",
  "gender": "M",
  "categoryId": "cat_designer",
  "productType": "PERFUME",
  "isPremium": false,
  "active": true,
  "createdAt": "2026-07-24T00:00:00Z",
  "updatedAt": "2026-07-24T00:00:00Z"
}
```

---

## 6) Product Variant

### Purpose
Represents sellable versions of a product (size, packaging, price/cost differences).

### Firestore collection
`tenants/{tenantId}/variants`

### Fields
- `tenantId` (string): owning tenant.
- `productId` (string): parent product reference.
- `sku` (string): optional internal variant code.
- `size` (number): quantity (e.g., 50, 100, 150).
- `unit` (string): usually `ml`.
- `packagingType` (string): `BULK` or `PACKAGED`.
- `isPremium` (boolean): premium variant flag if needed.
- `costPrice` (number): unit cost.
- `sellingPrice` (number): unit sale price.
- `active` (boolean): whether variant is sellable.
- `createdAt` (timestamp): creation time.
- `updatedAt` (timestamp): last update time.

### Required fields
- `tenantId`
- `productId`
- `size`
- `unit`
- `packagingType`
- `costPrice`
- `sellingPrice`
- `active`
- `createdAt`

### Optional fields
- `sku`
- `isPremium`
- `updatedAt`

### Relationships
- Many variants belong to one product.
- One variant has one inventory snapshot row.
- One variant has many stock movements.
- One variant can appear in many order items.

### Example document JSON
```json
{
  "tenantId": "store001",
  "productId": "prod_armani_code",
  "sku": "ARM-CODE-100ML",
  "size": 100,
  "unit": "ml",
  "packagingType": "PACKAGED",
  "isPremium": false,
  "costPrice": 10,
  "sellingPrice": 25,
  "active": true,
  "createdAt": "2026-07-24T00:00:00Z",
  "updatedAt": "2026-07-24T00:00:00Z"
}
```

---

## 7) Inventory

### Purpose
Stores current stock snapshot per variant for fast reads.

### Firestore collection
`tenants/{tenantId}/inventory`

### Fields
- `tenantId` (string): owning tenant.
- `productId` (string): parent product reference.
- `variantId` (string): variant reference.
- `quantity` (number): current on-hand stock.
- `updatedAt` (timestamp): last stock change time.

### Required fields
- `tenantId`
- `productId`
- `variantId`
- `quantity`
- `updatedAt`

### Optional fields
- none

### Relationships
- One inventory row belongs to one variant.
- Updated only together with a stock movement in the same transaction.

### Example document JSON
```json
{
  "tenantId": "store001",
  "productId": "prod_armani_code",
  "variantId": "var_arm_code_100ml",
  "quantity": 25,
  "updatedAt": "2026-07-24T00:00:00Z"
}
```

### Stock calculation rule
- Current stock is read from `inventory.quantity`.
- `stockMovements` is audit/history, not the read path for current stock.
- Never recompute current stock by scanning all movements for routine reads.

---

## 8) Stock Movement

### Purpose
Immutable audit log for every stock change event.

### Firestore collection
`tenants/{tenantId}/stockMovements`

### Fields
- `tenantId` (string): owning tenant.
- `variantId` (string): impacted variant.
- `productId` (string): impacted product.
- `type` (string): `PURCHASE`, `SALE`, `ADJUSTMENT`, `RETURN`, `LOSS`.
- `quantityDelta` (number): signed quantity change, positive or negative.
- `reason` (string): human reason/details for adjustment or correction.
- `orderId` (string): present when movement comes from sale order.
- `performedByEmployeeId` (string): employee responsible (if applicable).
- `createdAt` (timestamp): movement creation time.

### Required fields
- `tenantId`
- `variantId`
- `productId`
- `type`
- `quantityDelta`
- `createdAt`

### Optional fields
- `reason`
- `orderId`
- `performedByEmployeeId`

### Relationships
- Many stock movements belong to one variant.
- Sale-related movement references one order.
- Must be written atomically with inventory update.

### Example document JSON
```json
{
  "tenantId": "store001",
  "variantId": "var_arm_code_100ml",
  "productId": "prod_armani_code",
  "type": "ADJUSTMENT",
  "quantityDelta": -1,
  "reason": "Damaged bottle",
  "performedByEmployeeId": "emp_maria",
  "createdAt": "2026-07-24T00:00:00Z"
}
```

### Invariants
- Every stock change creates a movement.
- Stock movements are never deleted.
- Inventory must not be updated without a corresponding movement.

---

## 9) Order

### Purpose
Represents one POS sale transaction.

### Firestore collection
`tenants/{tenantId}/orders`

### Fields
- `tenantId` (string): owning tenant.
- `employeeId` (string): employee who created the order.
- `status` (string): `COMPLETED` for MVP (extend later only when needed).
- `subtotal` (number): sum of item line totals before discounts/taxes.
- `discountTotal` (number): optional total discount.
- `total` (number): final order total.
- `items` (array): sold line items.
- `createdAt` (timestamp): order creation time.

`items[]` shape:
- `variantId` (string)
- `productId` (string)
- `quantity` (number)
- `unitPrice` (number)
- `lineTotal` (number)

### Required fields
- `tenantId`
- `employeeId`
- `status`
- `total`
- `items`
- `createdAt`

### Optional fields
- `subtotal`
- `discountTotal`

### Relationships
- Many orders belong to one tenant.
- One order is created by one employee.
- One order has many item rows (embedded for MVP simplicity).
- One order creation triggers SALE stock movements and inventory updates atomically.

### Example document JSON
```json
{
  "tenantId": "store001",
  "employeeId": "emp_maria",
  "status": "COMPLETED",
  "subtotal": 50,
  "discountTotal": 0,
  "total": 50,
  "items": [
    {
      "variantId": "var_arm_code_100ml",
      "productId": "prod_armani_code",
      "quantity": 2,
      "unitPrice": 25,
      "lineTotal": 50
    }
  ],
  "createdAt": "2026-07-24T00:00:00Z"
}
```

---

## Relationship Summary

- `tenants` 1 -> N `employees`
- `tenants` 1 -> N `brands`
- `tenants` 1 -> N `categories`
- `tenants` 1 -> N `products`
- `tenants/{tenantId}/products` 1 -> N `tenants/{tenantId}/variants`
- `tenants/{tenantId}/variants` 1 -> 1 `tenants/{tenantId}/inventory` (by active sellable variant)
- `tenants/{tenantId}/variants` 1 -> N `tenants/{tenantId}/stockMovements`
- `tenants/{tenantId}/employees` 1 -> N `tenants/{tenantId}/orders`
- `orders` 1 -> N `items` (embedded)

---

## Operational Rules

1. Tenant isolation
- Every query and write must include tenant scope.
- Every entity listed above contains `tenantId`.

2. Inventory integrity
- Inventory updates and stock movement writes happen in one transaction.
- Order creation, sale movement creation, and inventory update are atomic.

3. Simplicity constraints
- No customer, supplier, payment, loyalty, or accounting entities in MVP.
- No generic ERP field explosion.
- Add fields only when a current business requirement exists.
