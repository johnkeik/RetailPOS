# Inventory


## Purpose

Inventory management keeps track of the available quantity of every product variant.

The system uses two concepts:

1. Inventory balance (current stock)
2. Stock movements (history)


---

# Inventory Balance


The current stock is stored directly for fast access.


Example:


inventory


{
 productId:"dior-sauvage",

tenants/{tenantId}/inventory


 quantity:25,

 updatedAt:timestamp
}


tenants/{tenantId}/inventory for current stock.
The POS reads this collection when displaying available products.


The inventory balance is updated whenever stock changes.


---

# Stock Movements


Every stock change creates an immutable movement record.


Stock movements are the audit history of inventory.


Example:


Initial Purchase:

+50


Sale:

-2


Adjustment:

-1



Movements:


PURCHASE +50

SALE -2

ADJUSTMENT -1



Current quantity:

47



---

# Important Rule


Never change inventory without creating a stock movement.


Every stock change must have a reason.


Valid movement types:


PURCHASE

SALE

ADJUSTMENT

RETURN

LOSS



---

# Stock Update Flow


Stock changes happen through backend logic.


Example Sale:


POS

↓

createOrder Cloud Function

↓

1. Validate stock availability

2. Create order

3. Create SALE movement

4. Update inventory quantity



---

# Why store both?


We do not calculate stock by reading all movements every time.


The reason:

- faster reads
- lower Firestore cost
- better POS performance



Stock movements are kept for:

- auditing
- reports
- debugging
- historical analysis



Inventory balance is used for:

- POS availability
- current stock screens
- reorder checks



---

# Data consistency


Inventory updates must use Firestore transactions.


Example:


Current stock:

10


Two employees sell at the same time.


The backend transaction guarantees that stock cannot become incorrect.



---

# Future reporting


Reports should use stock movements.


Examples:


Monthly sales:

Read SALE movements for the month.


Inventory value:

Read current inventory + product costs.


Reorder suggestions:

Analyze historical SALE movements.