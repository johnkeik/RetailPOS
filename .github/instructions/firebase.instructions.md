---
applyTo: "**/*.ts,**/*.rules,**/*.json"
---

# Firebase Rules

Backend platform: Firebase Auth + Firestore + Cloud Functions + Emulators.

Firestore rules:

- design for low read cost and indexed queries
- enforce tenant isolation in schema and rules
- avoid broad scans and unnecessary data duplication

Cloud Functions rules:

- critical business mutations run server-side
- validate input and authorization on every mutation
- preserve invariants and consistency across documents

Transactions:

- use Firestore transactions for related writes (order + movement + inventory)
- inventory/order mutations must be atomic

Use together with:

- `architecture.instructions.md`
- `inventory.instructions.md`