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
- products
- variants
- inventory
- orders
- stockMovements


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