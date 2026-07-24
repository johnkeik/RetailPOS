---
applyTo: "**/*.ts,**/*.html,**/*.scss"
---

# Angular Admin Rules

Target: operational admin workflows for products, variants, inventory, receiving, and order history.

Priorities:

- productivity
- clarity
- maintainability

Prefer:

- typed models and DTOs
- simple, explicit services
- reusable, domain-focused components

Avoid:

- generic CRUD scaffolding
- unnecessary UI frameworks
- complex state management when local/component state is sufficient

Business UI should optimize information density and task speed, not decoration.

Use together with:

- `architecture.instructions.md`
- `inventory.instructions.md`
- `ui.instructions.md`