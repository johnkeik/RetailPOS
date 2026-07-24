# Development TODO

## Phase 0 - Project Setup

Manual tasks:

- Create Firebase project
- Configure Firebase Authentication
- Configure Firestore
- Configure Cloud Functions
- Create Flutter POS project
- Create Angular Admin project
- Configure environments
- Configure Git repository


---

# Phase 1 - Database Foundation


## Firestore Structure

Create collections:

- tenants
- users
- tenants/{tenantId}/employees
- tenants/{tenantId}/brands
- tenants/{tenantId}/categories
- tenants/{tenantId}/products
- tenants/{tenantId}/variants
- tenants/{tenantId}/inventory
- tenants/{tenantId}/orders
- tenants/{tenantId}/stockMovements


Tasks:

- Define Firestore models
- Define document structures
- Create indexes
- Create security rules


---

# Phase 2 - Product Management (Admin)


## Product Catalog


Features:

- Product list
- Product search
- Create product
- Edit product
- Activate/deactivate product


Product fields:

- productCode
- brand
- name
- gender
- productType
- categoryId
- active


---

## Product Import


Features:

- Import existing product catalog
- Map Excel/JSON data
- Validate duplicate product codes
- Create variants


Import requirements:

- Employee product codes must be preserved
- Internal Firestore IDs are not visible to users


---

# Phase 3 - Product Variants


Features:

- Create variants
- Manage sizes
- Manage prices


Examples:


Bulk perfume:

- 50ml
- 100ml
- 150ml


Packaged product:

- 50ml


Variant fields:

- size
- unit
- costPrice
- sellingPrice


---

# Phase 4 - Inventory Management (Admin)


## Current Stock


Features:

- View inventory
- Search products
- Filter low stock


Display:


Product

Variant

Quantity



---

## Receive Stock


Create stock receiving flow.


Example:


Dior Sauvage 100ml

Purchase:

+20



Actions:

1. Create stock movement

2. Update inventory quantity



Movement type:

PURCHASE


---

## Inventory Adjustment


Allow manual corrections.


Examples:

- Damaged product
- Wrong count
- Lost item


Actions:

1. Create adjustment movement

2. Update inventory quantity



Movement type:

ADJUSTMENT


---

# Phase 5 - Cloud Functions


## createOrder()


Responsibilities:


- Validate user
- Validate stock
- Create order
- Create SALE movement
- Update inventory


Requirements:

- Use Firestore transaction
- Prevent negative stock


---

## receiveStock()


Responsibilities:


- Validate input
- Create PURCHASE movement
- Update inventory


---

## adjustStock()


Responsibilities:


- Validate adjustment
- Create ADJUSTMENT movement
- Update inventory

---

# Admin Dashboard Execution Plan (No Code Yet)

Goal:

- Build the admin app in controlled steps.
- Start with domain/data models.
- Create one page at a time for easy review.
- Connect Firebase only after pages and models are stable.

## Step 1 - Define Admin Models First

Create and review model definitions before page implementation.

Model order:

1. Tenant
2. Employee
3. Brand
4. Category
5. Product
6. Variant
7. Inventory snapshot
8. Stock movement
9. Order (with embedded order items)

Model checklist for each entity:

- Confirm Firestore path under tenants/{tenantId}/...
- Confirm required vs optional fields
- Confirm relationship IDs
- Confirm tenant isolation field and rule assumptions
- Confirm minimal indexes needed later

Exit criteria:

- All entities are documented in DOMAIN-MODEL.md
- Team agrees field names and enums
- No UI or DB code starts before approval

## Step 2 - Build Admin Pages One At A Time

Implementation sequence (one page per review cycle):

1. Dashboard page (placeholder + navigation validation)
2. Brands page
3. Categories page
4. Products page
5. Variants page
6. Inventory page
7. Stock movements page
8. Sales history page

Rules for page-by-page delivery:

- One page per PR/commit batch
- Keep unrelated files unchanged
- Validate route + shell + basic layout each step
- Move to next page only after your approval

## Step 3 - Firebase Connection After Pages

Connection sequence:

1. Environment config wiring (dev/prod placeholders)
2. Firebase app initialization
3. Auth integration
4. Firestore read wiring for first approved page
5. Cloud Function call wiring for stock mutations
6. Error/loading states and access guard behavior

Important:

- Inventory mutations must go through Cloud Functions
- Never write inventory directly from client
- All reads/writes stay tenant-scoped

## Manual Tasks You Should Do For Firebase Project Connection

Do these manually in Firebase Console first:

1. Create Firebase project
2. Enable Authentication (Email/Password for admin users)
3. Create Firestore database (start in test mode only for local bootstrap)
4. Choose Firestore location/region
5. Register web app for admin dashboard and copy Firebase web config
6. Create first tenant owner user in Auth
7. Create users/{uid} profile doc with tenantId and role
8. Create tenants/{tenantId} root document
9. Enable Firebase Emulator Suite locally (Auth, Firestore, Functions)
10. Prepare initial Firestore security rules file with tenant path checks
11. Create required composite indexes after first query patterns are known

Manual tasks before enabling production access:

1. Replace permissive/test Firestore rules with strict tenant rules
2. Restrict all stock mutations to Cloud Functions
3. Validate cross-tenant denial cases
4. Validate no client path can update inventory without stock movement



---

# Phase 6 - Flutter POS


## Authentication


Features:

- Login
- Logout
- Remember session


---

## Product Search


Features:

- Search by productCode
- Search by name
- Search by brand


Example:


1001978


or


ARAMIS


---

## Cart


Features:

- Add product variant
- Change quantity
- Remove item
- Calculate total


---

## Complete Sale


Flow:


Cart

↓

Confirm order

↓

createOrder Cloud Function

↓

Show success


---

# Phase 7 - Admin Orders


Features:

- View orders
- Filter by date
- View order details


Display:


Date

Employee

Items

Total


---

# Phase 8 - Testing


## Inventory Tests


Test:

- Purchase increases stock
- Sale decreases stock
- Adjustment changes stock
- Cannot sell unavailable stock


---

## POS Tests


Test:

- Login
- Search product
- Create order
- Stock updates correctly


---

# Phase 9 - Deployment


Tasks:

- Deploy Firebase rules
- Deploy Cloud Functions
- Build Flutter application
- Deploy Angular application
- Configure production environment


---

# Future Ideas (Not MVP)


## Reports

- Best sellers
- Monthly sales
- Stock value
- Dead stock


## Inventory Intelligence

- Suggested orders
- Sales velocity
- Minimum stock alerts


## SaaS

- Subscription management
- Feature limits
- Multiple tenants
- Billing