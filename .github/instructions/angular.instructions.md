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

Component file structure:

- For large components, use separate files: `.ts` + `.html` + `.scss`.
- Avoid inline template/styles for components with non-trivial layout or styling.
- Reserve inline template/styles for very small components only.

Avoid:

- generic CRUD scaffolding
- unnecessary UI frameworks
- complex state management when local/component state is sufficient

Business UI should optimize information density and task speed, not decoration.

Use together with:

- `architecture.instructions.md`
- `inventory.instructions.md`
- `ui.instructions.md`