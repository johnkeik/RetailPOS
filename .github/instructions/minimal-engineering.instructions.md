---
applyTo: "**/*"
---

# Minimal Engineering Rules

Default style:

- choose the smallest solution that satisfies current requirements
- optimize for clarity, reliability, and maintenance cost

Avoid by default:

- speculative abstractions
- generic frameworks for simple flows
- extra architectural layers without current need

Do not add patterns like repository/factory/manager/provider/service unless there is a concrete, current problem they solve.

Decision test before adding structure:

- What current business problem does this solve?
- Can existing code be extended instead?
- Is there a simpler implementation with equal correctness?

Use together with:

- `architecture.instructions.md` for boundaries.
- `inventory.instructions.md` for non-negotiable business invariants.