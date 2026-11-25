# Architecture and data model

Source-derived review: 8 November 2026. This reference describes checked-in implementation, not verified live infrastructure or database contents. For access policy see [SECURITY.md](SECURITY.md); setup and releases are in [OPERATIONS.md](OPERATIONS.md).

## Components and boundaries

| Component | Responsibilities and source |
| --- | --- |
| Angular 20 dashboard | Firebase email/password sign-in; OWNER catalog, stock, staff, promotions, history, expense and report views; separate EMPLOYEE receiving screen. `apps/admin-dashboard/src/app/app.routes.ts`, `core/auth/`, `features/` |
| Flutter cashier | Manager-approved device activation, server-verified employee-code session, direct catalog/history reads, cart/pricing preview, sale/cancel/expense calls, post-sale label jobs. `apps/pos_client/lib/features/pos/` |
| Firebase callable backend | TypeScript/Node 22, Admin SDK mutations, `maxInstances: 10`; exports in `functions/src/index.ts`, actor resolution in `functions/src/common/auth.ts` |
| Firestore | Tenant collections plus global user profiles; configured `(default)` database in `eur3`. `firebase.json`, `functions/src/common/firestore.ts` |
| Hosting | Angular browser build with SPA rewrites. `firebase.json`, `apps/admin-dashboard/angular.json` |
| Local print adapter | .NET 8 HTTP API at localhost:5050, serialized DYMO jobs. `print-service/MiniPOS.PrintService/Program.cs`, `Services/PrintCoordinator.cs` |

Clients read Firestore directly; all client writes are denied. Business mutations use Cloud Functions, whose Admin SDK bypasses Firestore rules and therefore needs separate authorization. POS reads and sale/cancel/expense calls require an active registered device and current server-verified employee session; OWNER access and receiving-only dashboard accounts retain separate permissions.

POS activation resolves the tenant from the signed-in manager’s `users/{uid}` profile. The tenant is stored with the device credential and validated again when resuming; it is not selected by a build flag. Windows sends callable HTTP requests in a JSON `data` envelope with a Firebase ID token in the authorization header; other native platforms use the Functions SDK. The HTTP endpoint assumes `us-central1`; `functions/src/index.ts` sets no global region override. Database location does not establish every processing location. See `apps/pos_client/lib/core/firebase/firebase_config.dart` and `features/pos/data/cloud_functions_pos_order_repository.dart`.

## Firestore paths

All business paths below are relative to `tenants/{tenantId}/`; `users/{uid}` is global. IDs reference documents within the same tenant by convention. Firestore is schemaless: declared types do not validate records or enforce relationships.

| Path | Purpose and primary writer |
| --- | --- |
| `products/{id}` | Catalog identity, packaging and template-price assignments; `functions/src/products/` |
| `variantTemplates/{id}` | Reusable size/price/recipe and special-bottle configuration; `functions/src/variants/` |
| `consumables/{id}` | Bottles, pumps and other shared packaging; `functions/src/consumables/` |
| `brands/{id}`, `categories/{id}` | Catalog references; corresponding `functions/src/` modules |
| `employees/{id}` | Name, plain employee code and active state; `functions/src/employees/` |
| `employeeAccounts/{employeeId}` | Private employee-to-Auth UID/email link; `create-employee-account.ts` |
| `inventory/{id}` | Current unit/component quantity; stock and order handlers |
| `stockMovements/{id}` | Signed changes, reasons and order/actor attribution; stock and order handlers |
| `orders/{id}` | Embedded items, totals, promotion snapshots and sale/cancellation state; `functions/src/orders/` |
| `orderEvents/{id}` | Separate cancellation audit event; `functions/src/orders/cancel-order.ts` |
| `expenses/{id}` | Amount, payment-method label, description and employee; `functions/src/expenses/` |
| `promotions/{id}` | Offer rule, eligible/gift templates and date window; `functions/src/promotions/` |
| `settings/promotionRules` | Revision lock changed by offer save/delete and read by checkout |
| `private/security` | Salted manager PIN hash and lockout metadata; `functions/src/security/set-manager-pin.ts` |
| `users/{uid}` (global) | One tenant, OWNER/EMPLOYEE role, active state and optional employee link; bootstrap/account provisioning |

Backend inputs are in `functions/src/types/domain.ts`; admin shapes are in `apps/admin-dashboard/src/app/core/types/domain.models.ts`. These differ: writers add fields not present in every admin type, and legacy records may omit newer fields. A tenant name/status/timestamps type exists, but current actor resolution does not read tenant status. No signup, subscription or multi-tenant membership entity is implemented.

## Catalog and recipes

A **product** is the staff-recognized identity: `tenantId`, `productCode`, `name`, `brandId`, `categoryId`, `productType`, `packagingCategory`, `ingredients`, optional `gender`, `active`, and timestamps. Declared enums are PERFUME/OTHER, BULK/PACKAGED and M/F/UNISEX. `ingredients` feeds labels as free text; it is not a verified regulatory specification.

`variantAssignments` maps template IDs to `{sellingPrice, costPrice?}`; `variantOrder` optionally controls POS ordering. Writers default packaging to PACKAGED and assignments/order to empty or derived values. A sellable choice is an active product plus assigned active template. Separate `variants` documents are not prerequisites for current checkout. See `functions/src/products/{create-product,update-product,assign-variant-to-products}.ts` and `apps/pos_client/lib/features/pos/data/firestore_pos_catalog_repository.dart`.

A **variant template** stores name/code, optional size, unit, packaging type, selling price, optional cost, active state and timestamps. Bulk recipes use `perfumeMl`, `essenceMl` and `recipeConsumables: [{consumableId, quantity}]`. Template writers normalize consumable quantities to whole units of at least one. Special-bottle fields are `hasSpecialBottle`, `specialBottleConsumableId` and `specialBottleExtraPrice`; selection replaces only the **first** recipe consumable. Recipe order therefore has business meaning.

A **consumable** stores tenant, name/code, unit, optional cost, active state and timestamps. Brands/categories store tenant, name, optional code, active state and timestamps. Costs are stored but do not establish complete margin/accounting reporting. See `functions/src/variants/`, `consumables/`, `brands/` and `categories/`.

Sample `BULK-50` consumes 46 ml base + 4 ml essence + one bottle + one pump. This is sample configuration from `apps/admin-dashboard/src/app/features/dashboard/temp-data/variantTemplates.data.ts`, not a live-shop recipe. Bulk stock is shared across bottle sizes through the component pools below.

Legacy `Variant`, `isPremium` and `consumableParts` fields/types remain. Current product writers do not write `isPremium`, and checkout uses `recipeConsumables`, not `consumableParts`. Product packaging category determines checkout stock treatment; comprehensive product/template packaging compatibility validation is not established.

## Identity and ancillary records

Employees hold tenant, name, plain employee code, active state and timestamps. Code uniqueness uses a pre-write query, not a uniqueness transaction. The cashier keeps ID/name in widget state after direct code lookup; this is not a Firebase Auth token. Dashboard profiles and private employee-account links form a separate authenticated identity path. Auth changes and Firestore changes are separate operations, not one cross-service transaction. See `functions/src/employees/` and `apps/pos_client/lib/features/pos/presentation/employee_session_gate.dart`.

Promotions store name, eligible template IDs, CHEAPEST/GIFT_VARIANT kind, group size, discount percent, optional distinct gift template, repeat/active flags, nullable ISO UTC start/end, timestamps and updater. Start is inclusive; end exclusive. The revision document coordinates edits/deletion with checkout. Detailed allocation rules and examples are in [PROMOTIONS.md](PROMOTIONS.md).

Expenses store tenant, employee, rounded positive amount, CASH/CARD, description and creation timestamp; updates add an update timestamp. Owners can update/delete them; there is no immutable expense-edit ledger. See `functions/src/expenses/`.

## Inventory model

`functions/src/common/firestore.ts` creates IDs as `${productId}__${variantTemplateId}`. The separator and reserved component IDs are application conventions, not database constraints.

| Inventory ID | Quantity meaning |
| --- | --- |
| `productId__templateId` | Packaged units |
| `productId__perfume` | Bulk perfume/base ml |
| `productId__essence` | Bulk essence ml |
| `consumableId__consumable` | Shared packaging units; its `productId` field holds the consumable ID |
| `productId__bulk` | Legacy recipe-free single volume pool |

Snapshots store tenant, product/component ID, `variantId`, usually `variantTemplateId`, quantity and update timestamp. Movements store the same identity plus type, signed `quantityDelta`, reason, timestamp and optional order/actor references. Types are PURCHASE, SALE, ADJUSTMENT, RETURN and LOSS. Checkout adds `isBulkVolume`; cancellation adds `reversesMovementId` and `performedByUserId`.

Read current balances from snapshots rather than scanning movement history. Normal stock/order handlers update balances and movements in a transaction and check against negative resulting stock. Movement immutability is an application convention plus denied client writes, not protection against privileged Admin SDK deletion. Catalog deletion currently breaks the intended integrity contract; see the gaps below.

The dashboard's `recordStockMovements` accepts up to 50 lines. PURCHASE adds positive quantities; LOSS negates positive quantities; ADJUSTMENT accepts signed nonzero quantities. Adjustment/loss require a reason. It validates parent records, assigned packaged templates, BULK products for reserved volume pools and consumable IDs. Volume accepts fractional ml, other lines whole units; running balances round to three decimals and duplicate rows accumulate. Linked EMPLOYEE accounts can submit PURCHASE only, with attribution taken from their verified employee link.

Separate OWNER-only `receiveStock`/`adjustStock` exports still call `applyStockMutation`; their numeric/reference/reason validation is weaker. See `functions/src/inventory/`. Sale deductions and receiving do not use identical rounding behavior, so fractional recipes need reconciliation tests.

The owner inventory view defaults to 0.5 L base, 0.05 L essence and 10 units. Its page-local signals let users change filter thresholds without persisting store settings or changing dashboard defaults. These are low-stock indicators, not predictive reorder recommendations. See `apps/admin-dashboard/src/app/features/inventory/{inventory.service,inventory-page.component}.ts`.

## Checkout, history and cancellation

1. The employee gate identifies a cashier; the catalog repository loads categories, products, templates and promotions. It **does not load inventory** or provide verified live stock availability in the cashier catalog.
2. The cashier selects variant/bottle/quantity. Dart pricing previews offers and pending gifts; submission sends tenant, employee, items, CASH/CARD and expected total.
3. `functions/src/orders/create-order.ts` validates employee/activity, positive integer quantities, up to 100 lines/1,000 delivered units, catalog assignment/current prices and expected total. Discounted orders require expected total; stale/mismatched amounts are rejected.
4. In one transaction it reads promotions/revision and inventory, computes discounts and component deltas, rejects insufficient stock, then writes balances, SALE movements and a COMPLETED order. All delivered units, including gifts, consume materials.
5. After save, the POS sends labels to the local adapter. Blank-ingredients items are skipped. Print failure does not reverse the sale; history supports reprinting. SDK acceptance does not prove physical output.

The Flutter implementation is under `apps/pos_client/lib/features/pos/{presentation,data,models}/`. Windows callable HTTP has a 30-second timeout. Each checkout creates a new order ID; no idempotency key protects repeated submissions after an ambiguous network result.

Orders store employee ID/name, optional payment method, subtotal/discount/total, promotion snapshots, items and creation timestamp. Items store product/template IDs, quantity, catalog unit price, special-bottle flag, line discount and line total. They do not snapshot every name, code, ingredient or recipe field; history/reprinting partly resolves the current catalog.

The POS reads today's orders with computer-local day boundaries, descending creation time, limited to 50 by default. It hides legacy DELETED audit rows. Admin history uses a separate whole-collection query. See `apps/pos_client/lib/features/pos/data/cloud_functions_pos_order_repository.dart` and `apps/admin-dashboard/src/app/features/sales-history/sales-history.service.ts`.

`cancelOrder` requires a COMPLETED sale with recorded SALE movements (at most 240), restores their recorded consumption, appends RETURN movements and an `ORDER_CANCELLED` event, then marks the original CANCELLED with canceller/time. Repeat reversal fails; current writes do not create a second DELETED order. Cancellation does not check the manager PIN; see [SECURITY.md](SECURITY.md).

MiniPOS is a management and inventory assistant; checkout records internal sales activity and material consumption. CASH/CARD is a staff-entered reporting label and does not verify payment. Card-terminal capture/settlement, payment refunds and fiscal-receipt issuance belong to the shop's separate systems and are outside the current intended scope. Internal cancellation restores recorded stock; it does not refund money or cancel a fiscal receipt. Partial-return, VAT and accounting integrations are not implemented.

## POS device identity

`tenants/{tenantId}/devices/{deviceUid}` stores device status, hashed resume credential, activating owner and current employee/session binding. Flutter retains the resume credential in OS-protected storage; restarting resumes the device and invalidates its previous employee session. The numeric employee code is checked only by the backend. Device tokens cannot manage the owner dashboard or read employee codes. See [Security](SECURITY.md#registered-pos-devices-and-employee-sessions).

## Implementation gaps and compatibility

- **Unsafe hard deletion:** `functions/src/products/delete-product.ts` and `consumables/delete-consumable.ts` remove matching inventory without a zero-balance check or compensating movements. Their historical checks, and `variants/delete-variant-template.ts`, inspect only 50 orders; checks/deletions are not complete transactional reference protection. Prefer deactivation pending remediation.
- **Uneven validation:** product CRUD does not comprehensively enforce code uniqueness, enums, references or assignments; template CRUD coerces numbers without complete finite/nonnegative/reference validation. UI controls and TypeScript types are not server constraints. Checkout performs stronger active-catalog/price checks.
- **Unversioned schema:** no migration runner, versioned migration scripts or schema registry was found. Legacy fallbacks do not prove a migration ran. `firestore.indexes.json` declares empty `indexes`/`fieldOverrides`, not a verified cloud index inventory.
- **Read scale and service gaps:** several catalog/history services load whole collections. No subscription service, offline sale queue, automatic updater or tracked CI workflow was found. Setup/recovery procedures and external-state limits are in [OPERATIONS.md](OPERATIONS.md); prioritized product work and verification evidence are in [SAAS_READINESS.md](SAAS_READINESS.md).
