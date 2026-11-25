# SaaS readiness handoff

Source review: 8 November 2026. For product, pilot and marketing decisions; implemented features are not proof of customer adoption or market fit.

**Current product scope:** MiniPOS is a shop management and inventory organization assistant for perfume shops. It helps staff organize stock, track recipe/material consumption, record sales activity and expenses, and review internal reports. It accompanies the shop's separate payment and fiscal systems. Card-terminal integration, payment processing/refunds and fiscal-receipt issuance are outside the current intended scope; they are not SaaS rollout requirements. “POS”, “checkout” and “sale” below describe the internal recording workflow.

The strongest apparent differentiator is **recipe-aware perfume inventory**: selling bottle sizes while consuming perfume/base, essence and packaging. The 8 November review identified cashier identity and confidential store access as the first rollout blocker. A manager-approved PC activation and employee-session implementation was added on 12 November; it still requires coordinated deployment and validation on the customer PC. A second shop currently requires **assisted setup and coordinated releases**.

## 1. What the product does today

### Cashiers

- Open a store-specific POS, enter an employee code, search products by code/name, browse categories, choose a size/variant and optional special bottle, and adjust cart quantities. The touch interface includes on-screen keyboards. After manager-approved PC activation, employee codes are verified server-side and bound to a Firebase-authenticated device/employee session. The app returns to employee login after restart.
- Preview automatic promotions, select CASH/CARD, and submit a sale. The backend rechecks current catalog prices, offer rules, expected total, active employee/product/template and stock. It writes the order, inventory balances and SALE movements atomically; free units consume stock too.
- View today's history (50 orders by default), reprint an order or individual item's labels, cancel a full sale and record an expense. Cancellation restores recorded stock consumption once and preserves the original sale with RETURN movements and an audit event.

Sources: `apps/pos_client/lib/features/pos/presentation/`, `data/firestore_pos_catalog_repository.dart`, `data/cloud_functions_pos_order_repository.dart`; `functions/src/orders/{create-order,cancel-order}.ts`; `functions/src/expenses/create-expense.ts`.

**Intentional scope boundary:** CASH/CARD is a staff-entered label for internal reporting; it does not verify payment. The shop handles card-terminal capture, settlement, refunds and fiscal receipts through separate systems. MiniPOS prints code/ingredients labels and cancels internal sale records with stock restoration. Those actions do not charge/refund money or issue/cancel a fiscal receipt. VAT calculation, accounting integration and partial-return workflows are not implemented; they are not prerequisites for the current management-assistant scope. Sources: `functions/src/types/domain.ts`, `functions/src/orders/create-order.ts`, `print-service/MiniPOS.PrintService/Program.cs`.

### Owners and receiving staff

The Angular dashboard manages brands, categories, products, templates/recipes, per-product prices, consumables, bulk template assignment/price updates, employees, stock receiving/adjustment/loss, movement history, promotions and expenses. Sales reports group cash/card sales and expenses by day/employee and support print/CSV export; dashboard summaries show sales and low stock. These are implemented reports, not verified accounting reconciliation.

Owners can provision email-based EMPLOYEE accounts with receiving-only dashboard access. Those accounts can submit PURCHASE movements, not owner management or authenticated POS sales. Cashier codes and dashboard accounts are separate identity paths.

Sources: `apps/admin-dashboard/src/app/app.routes.ts`, `src/app/features/`; `functions/src/employees/create-employee-account.ts`, `inventory/record-stock-movements.ts`, `products/assign-variant-to-products.ts`, `common/auth.ts`.

### Perfume specialization and shop assumptions

- Products separate staff-facing fragrance codes from reusable sellable templates and per-product prices. Fields include gender, PERFUME/OTHER, BULK/PACKAGED, ingredients and variant ordering. Bulk recipes deduct perfume/base ml, essence ml and shared consumables; packaged goods deduct units. A special bottle replaces the **first** recipe consumable and adds a surcharge. Legacy single-pool bulk stock is also supported. Sources: `functions/src/types/domain.ts`, `orders/create-order.ts`.
- Promotions support second-item half-price, three-for-two and a distinct gift variant after qualifying purchases. Overlapping offers allocate units without double-discounting. Sources: `functions/src/promotions/`, `test-fixtures/promotions.json`; details: [PROMOTIONS.md](PROMOTIONS.md).
- Greek UI, EUR formatting, computer-local dates and perfume category ordering are embedded in clients. Dashboard low-stock defaults are 0.5 L base, 0.05 L essence and 10 units. Inventory-page filters allow temporary threshold changes, but no persisted store settings were found. Sources: `apps/admin-dashboard/src/app/features/inventory/{inventory.service,inventory-page.component}.ts`, `sales-report/sales-report-page.component.ts`, `apps/pos_client/lib/features/pos/data/firestore_pos_catalog_repository.dart`.
- One tenant represents one store; dashboard profiles have one tenant/role, and POS activation derives its tenant from the manager’s server-managed membership. Windows builds are shared across shops within the configured Firebase project; several admin services still fall back to a sample store. Sources: `firestore.rules`, `scripts/build-installer-windows.ps1`, `apps/pos_client/lib/core/firebase/firebase_config.dart`, `apps/admin-dashboard/src/app/features/sales-history/sales-history.service.ts`.

No general customer catalog-import wizard, customer/supplier/loyalty modules, offline checkout queue, multi-branch membership, predictive purchasing or automatic desktop updater was found. Sample seed tools and native platform shells do not establish those capabilities.

## 2. How it runs

| Layer | Source evidence | Setup implication |
| --- | --- | --- |
| Cashier | Flutter/Dart with Firebase and HTTP; `apps/pos_client/pubspec.yaml` | Explicit Windows packaging; other platform scaffolding is not verified support. |
| Dashboard | Angular 20/Firebase JS SDK; `apps/admin-dashboard/package.json`, `angular.json` | Firebase Hosting; development selects emulator config, production retains base config. |
| Backend/data | TypeScript callable Functions, Node 22, Firebase Auth, Firestore `(default)` in `eur3`; `functions/package.json`, `functions/src/index.ts`, `firebase.json` | Shared cloud services; Windows callable endpoint assumes `us-central1`, separately from database location. |
| Printing | .NET 8 localhost API, DYMO Connect SDK/LabelWriter 550 adapter; `print-service/MiniPOS.PrintService/` | Windows printer/driver/roll/template preparation; API acceptance does not confirm physical printing. |
| Delivery | Firebase CLI, PowerShell, Inno Setup; `firebase.json`, `scripts/`, `installer/MiniPOS.iss` | Manual cloud deployment and shared desktop distribution within one Firebase project; no tracked CI workflow. |

External dependencies are Firebase/Google Cloud, Auth email setup and DYMO software/hardware. The repository does not establish live billing plan, enabled services, capacity, backup configuration or actual hardware status. No SaaS billing/payment provider integration was found.

Business records live under `tenants/{tenantId}`; `users/{uid}` holds authenticated membership. Products embed template assignments; orders embed item/promotion snapshots; inventory separates component/unit pools. No schema-version registry, versioned migration scripts or migration runner was found. Runtime legacy fallbacks are compatibility code, not a tested upgrade process. The checked-in index file declares no composite indexes. See [ARCHITECTURE.md](ARCHITECTURE.md) for the consolidated schema and flows.

### Setting up a second shop today

1. Choose cloud-project strategy and a unique tenant. Shared namespaces exist; provision the owner membership and activate each PC using its owner account. Use isolated test infrastructure before rollout.
2. Create an Auth owner and run the explicit-project bootstrap script; no signup wizard exists. It links an existing account to an OWNER profile. Source: `functions/scripts/bootstrap-admin-user.js`.
3. Configure the shop's catalog, recipes, prices, consumables, employees and opening stock through admin/functions. Mock seeds are examples, not a validated customer import pipeline.
4. Build one installer for the correct Firebase project (no tenant build flag), install the Windows bundle and prepare printer/driver/template. Packaging checks Flutter 3.24.5/.NET 8; no build-machine/SDK provisioning is included. Sources: `scripts/{build-installer-windows,package-windows}.ps1`, `installer/MiniPOS.iss`.
5. Deploy compatible rules/indexes/functions/dashboard/POS, then verify sales, reversal, reconciliation, staff permissions and recovery in an isolated synthetic environment. There is no dedicated Angular staging configuration or staging provisioning automation.

Commands and release/recovery procedures belong in [OPERATIONS.md](OPERATIONS.md). Flutter defaults to cloud operation unless `POS_USE_EMULATORS=true`; never run demo seeds against the original shop.

## 3. What must change for SaaS

| Area | Current gap and required next step |
| --- | --- |
| **Store isolation — rollout validation** | Checked-in rules now remove public operational reads and bind POS catalog/history reads to an active device and current employee session. Local emulator cases cover wrong-shop, unauthenticated, stale-session and revoked access. Deploy compatible rules/functions/POS together and validate the Windows installation. Tenant IDs are not secrets. Source: `firestore.rules`; [SECURITY.md](SECURITY.md). |
| **Cashier permissions — rollout validation** | Manager activation registers a revocable PC identity; server-verified numeric employee codes start bound sessions. Sale/cancel/expense handlers reject unauthenticated requests and mismatched or revoked sessions. No subscription key or automatic billing enforcement is implemented. Validate deployment and the real Windows PC before customer use. Sources: `functions/src/pos/device-auth.ts`, `functions/src/orders/`, `expenses/create-expense.ts`; [SECURITY.md](SECURITY.md). |
| Staff/approvals | OWNER and receiving-only EMPLOYEE accounts exist, but cashier identity is separate. Define owner/manager/cashier permissions, invitations/recovery and multi-store membership if needed. Cancellation does not call the available manager-PIN checker; decide policy and enforce it server-side. Sources: `functions/src/common/{auth,manager-pin}.ts`, `orders/cancel-order.ts`. |
| **Data integrity — before pilot** | Product/consumable deletion can remove nonzero inventory without movements; product/template/consumable history checks inspect only 50 orders. Repair deletion/reference checks, favor deactivation and strengthen uneven server validation of IDs, numeric values, recipes, packaging and code uniqueness. Sources: `functions/src/{products,variants,consumables}/`, `inventory/{receive-stock,adjust-stock,shared}.ts`. |
| Onboarding/settings | Manual owner/catalog/opening-stock setup, sample defaults and customer rollout need repeatable provisioning, validated import/reconciliation, device registration, training and persisted store settings. Tenant root status exists as a type but is not checked by actor resolution. |
| **Recovery — before pilot** | No backup/PITR/budget/restore provisioning is defined in tracked implementation; actual cloud status is unknown. Verify backups, perform a restore drill and agree recovery targets. Include tenant-selective restoration/export/deletion, Auth memberships, configuration and templates. Sources: `firebase.json`, `functions/src/index.ts`, `scripts/`; [OPERATIONS.md](OPERATIONS.md). |
| Updates/migrations | Establish staging, reproducible Windows builds, customer/device version tracking, compatibility checks, migrations and rollback. Discounted checkout requires expected totals and can reject older clients. Installer identity/output/version are shared across tenant builds. Sources: `functions/src/orders/create-order.ts`, `scripts/`, `installer/MiniPOS.iss`. |
| Subscription billing | No subscription state, webhooks, entitlement checks, trial/suspension or billing portal exists. Choose pricing unit, trial/cancellation/export policy and implement the agreed lifecycle. Manual invoicing could support a pilot but is not built-in SaaS billing. Sources: `functions/src/index.ts`, `apps/admin-dashboard/src/app/app.routes.ts`. |
| Reliability/cost/support | Add idempotent checkout and test ambiguous timeout/retry, concurrent tills, fractional quantities, large catalogs and transaction limits. New order IDs are generated per submission; some services read whole collections. Measure cloud cost and establish monitoring, alerts, support and employee-provisioning repair procedures. Sources: `functions/src/orders/create-order.ts`, `apps/admin-dashboard/src/app/features/sales-history/sales-history.service.ts`. |

Priorities: **close access and integrity gaps → prove isolation/recovery and reliable checkout → assisted second-store pilot → repeatable onboarding/releases and agreed billing lifecycle**. Pilot priorities should focus on stock organization, recipe accuracy, internal records and staff workflows within the management-assistant scope. Payment processing and fiscal-receipt integration are outside that scope. This handoff does not implement the fixes.

## Verification

The 8 November review covered backend feature groups/shared logic/types, both clients' routes/auth/repositories/workflows, printing, deployment configuration/scripts, sample seeds/fixtures, platform manifests and tests. Conclusions came from source; old docs were material to correct. No live records, credentials, operational logs, database exports, deployment or seeding were used. Historical tutorials were not evidence; see [archive/tutorial/README.md](archive/tutorial/README.md).

| Check from that review | Actual result / limit |
| --- | --- |
| Backend `npm run lint`; `npm test` | Lint and TypeScript build passed; **67 tests passed, 0 failed/skipped**. Pure/in-memory tests, not deployed rules, real concurrent transactions or production Node 22 certification. |
| Angular `npm test -- --watch=false --browsers=ChromeHeadless` | Build exited 134 before test results; CLI reported Node 23.2.0. No browser pass claim. |
| Flutter `flutter test --no-pub` | SDK cache-lock filesystem permission prevented execution. |
| .NET `dotnet test MiniPOS.PrintService.Tests --no-restore` | Test assembly built; runner aborted on socket-bind permission denial. |
| Live cloud, recovery, Windows/clean-PC and physical DYMO | Not run. No hardware/deployment/recovery certification. |

These are retained review results, not tests rerun during documentation cleanup. That review predated the 12 November device/session implementation and its local emulator rules suite. See [Security](SECURITY.md) for current behavior and [Operations](OPERATIONS.md#pos-device-activation-and-release) for release requirements.

## 4. What we can demo today

| Strong demo feature | Confidence |
| --- | --- |
| Recipe/packaged/special-bottle stock deductions; promotional free units | Implemented; backend cases passed in `functions/test/promotions-checkout.test.cjs`. |
| Offer allocation/gifts/overlaps, price-total rejection, historical discounts | Backend fixture/oracle tests passed: `functions/test/{promotion-pricing,promotions-checkout}.test.cjs`, `promotion-oracle.cjs`, `test-fixtures/promotions.json`. Dart parity tests exist but did not execute. |
| One-time cancellation/restoration; bulk price assignment; receiving-only permissions | Relevant backend tests passed: `functions/test/{cancel-order,assign-variant-to-products,employee-stock-receiving}.test.cjs`. Not a complete security suite. |
| Touch cart/history/reprinting/expenses; owner catalog/stock/reports/CSV | Implemented sources and selected mock widget/component tests exist; no completed UI suite or end-to-end demo in this review. |
| Serialized code/ingredients label jobs | Adapter and hardware-free tests exist in `print-service/`; no completed .NET suite or physical output verification. |

### 12 November access-control verification

The manager-approved device/employee-session changes passed backend lint/build and all **74 backend tests**, Flutter analysis and all **52 Flutter tests**, two actual local Firestore rules tests, and one full local Auth/Functions/Firestore HTTP handshake test. The handshake verifies activation, custom-token exchange, employee access, restart invalidation and device revocation using synthetic data. These checks do not certify production deployment, Windows credential persistence, installer behavior or physical printing. The 8 November results above remain historical.

### Prepared demo: three refill bottles, one free

This is a scenario to run with sample data, not an already executed end-to-end demonstration.

1. Connect both clients explicitly to local Auth/Firestore/Functions emulators. Use synthetic owner/cashier identities, `POS_USE_EMULATORS=true` and a synthetic owner whose profile belongs to `store002`; confirm destinations before seeding.
2. Reuse sample `BULK-50` from `apps/admin-dashboard/src/app/features/dashboard/temp-data/variantTemplates.data.ts`: EUR 12; 46 ml base + 4 ml essence + one bottle + one pump. Assign it to fictional “Demo Citrus”, code `DEMO-001`, at EUR 12. Create the cashier with a unique numeric code through owner tools, activate the POS with the synthetic owner credentials, then log in with the employee code.
3. Receive 1,000 ml base, 100 ml essence, 10 regular bottles and 10 pumps; configure a three-for-two offer for the template. The dashboard seed service provides example dependency ordering without requiring the full branded catalog.
4. Cashier selects three regular bottles: subtotal EUR 36, discount EUR 12, total EUR 24. Complete as CASH, explaining that this records method rather than moving money.
5. Show the sale/employee, report and movements. Expected remaining stock: **862 ml base, 88 ml essence, 7 bottles, 7 pumps**. The free bottle consumes materials.
6. Cancel once and show retained cancelled history, RETURN movements and restored opening stock. Explain current approval limitations. Show special-bottle pricing separately if useful; physical labels require checked Windows/DYMO hardware, and are not fiscal receipts.

Do not use historical seed orders to prove reconciliation: `functions/src/orders/seed-mock-orders.ts` is emulator-only, requires an empty orders collection, and writes no stock movements. Use a real synthetic checkout. History/reprinting also resolves some current catalog data because orders do not snapshot every product/recipe/ingredients field.

Present MiniPOS as a management and inventory assistant that accompanies the shop's separate payment and fiscal systems. Integrated card payments/refunds and fiscal-receipt issuance are outside the current intended scope. Do not advertise self-service signup, subscriptions, multi-branch switching, fiscal/accounting compliance, offline synchronization, predictive purchasing or automatic upgrades as working capabilities.

## 5. What we need from the owner

### Original-shop use and value

- Which workflows are used daily, by how many staff/tills and at what catalog/transaction volume? Which features are unused or incomplete?
- What did the shop use before? Which measurable problems improved: queues, recipe loss, packaging shortages, pricing, promotions, attribution or reconciliation? What before/after evidence can support a sales claim?
- Do recipes match real mixing/filling? How are testers, spills, customer-bottle refills, batch variation and physical counts handled?
- What happens when connectivity, checkout response or printing fails? Have duplicates or inventory discrepancies occurred?
- When should staff record a sale in MiniPOS, and how do they correct an internal record if the separately handled payment fails or a customer returns goods? Who approves cancellation/expenses, and should all materials always return to stock?
- How do staff use MiniPOS alongside the existing payment and fiscal systems? Which internal totals or stock records need comparison with external records, and who checks them?

### Target market and pilot

- Who comes first: refill perfume independents, packaged fragrance/cosmetics shops or chains? Which country/language, store size and hardware?
- Which recipes, product-code habits, consumables and offers do prospects share? Which differences require configuration or product changes?
- Who buys, which alternative would they replace, and what demand/willingness-to-pay evidence exists? Which benefit should lead the pitch?
- May we use the original shop's testimonial or anonymized results? Sample catalog presence does not establish redistribution rights or brand affiliation.
- Who is the next pilot, what must work on day one, who validates imported/opening stock, and what defines success?

### Commercial and operating commitments

- Is assisted setup acceptable? Who supplies hardware, trains staff and provides support? What downtime/data-loss commitments are realistic?
- Price per store/till/staff/usage? Setup/hardware/support fees? Are manual invoices acceptable initially, and what are trial/cancellation/export policies?
- Is shared infrastructure and one tenant per profile acceptable, or do owners need branches, stock transfers and scoped accountant/manager access?
- What must be retained/exported/deleted on departure, and who validates recovery, contracts and regional requirements for the management service? How will customer-facing material explain that payment processing and fiscal receipts remain with separate systems?
