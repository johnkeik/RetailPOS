---
applyTo: "**/*"
---

# Architecture Rules

System flow:

- Flutter POS -> Cloud Functions -> Firestore
- Angular Admin -> Cloud Functions -> Firestore

Hard constraints:

- Business-critical rules run in Cloud Functions.
- Firestore is source of truth.
- Clients should not directly perform critical inventory/order mutations.

Feature design default:

- Extend existing models before adding new collections/services/abstractions.
- Add new architecture only for a current business need, not hypothetical scale.

Use together with:

- `inventory.instructions.md` for stock invariants.
- `minimal-engineering.instructions.md` for simplicity defaults.