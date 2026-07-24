# Firebase Architecture


## Services Used


## Firebase Authentication


Purpose:

User login.


Users:

- Owner
- Employees



---

## Firestore


Main database.


Collections:


products

variants

inventory

orders

stockMovements



---

## Cloud Functions


Business logic layer.


Used for:


createOrder()

receiveStock()

adjustStock()



---

# Why Cloud Functions?


The client should not directly modify critical data.


Example:


Bad:


Flutter:

inventory.quantity -= 1



Good:


Flutter:

createOrder()



Function:

1. Check stock

2. Create order

3. Create movement

4. Update inventory



---

# Firebase Emulator


Development must use:


Authentication Emulator

Firestore Emulator

Functions Emulator



Never test inventory logic directly on production.



---

# Performance Rules


Avoid:

Reading all stock movements to calculate stock.



Use:

inventory collection for current stock.



---

# Cost Awareness


Firestore reads matter.


Avoid:

- loading entire product catalog repeatedly
- unnecessary realtime listeners
- querying large collections



Use:

- pagination
- filters
- indexes