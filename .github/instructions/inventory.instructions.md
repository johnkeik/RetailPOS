---
applyTo: "**/*"
---

# Inventory Domain Rules

Inventory is the primary business domain.

Required data model:

1. `inventory` snapshot for current stock.
2. `stockMovements` immutable history.

Allowed movement types:

- PURCHASE
- SALE
- ADJUSTMENT
- RETURN
- LOSS

Hard invariants:

- Every stock change creates a movement.
- Never update `inventory` without movement creation.
- Never delete stock movements.
- Never compute current stock by scanning full movement history.

Required mutation sequence for sales:

1. Validate stock.
2. Create order.
3. Create SALE movement.
4. Update inventory snapshot.

Performance rule:

- Current stock reads use `inventory`.
- Reporting/history reads use `stockMovements`.

Use together with:

- `architecture.instructions.md` for layer boundaries.
- `firebase.instructions.md` for transaction/validation implementation.