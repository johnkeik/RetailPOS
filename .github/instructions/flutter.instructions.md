---
applyTo: "**/*.dart"
---

# Flutter POS Rules

Target: production POS for store employees.

Priorities:

1. Reliability
2. Speed
3. Low-friction UX

Optimize for:

- touch input
- minimal taps/clicks
- fast product lookup
- obvious primary actions

Prefer:

- feature-oriented structure
- reusable widgets
- simple state and models

Avoid:

- unnecessary dependencies
- heavy state architecture for simple flows
- business logic inside widgets

Use together with:

- `architecture.instructions.md`
- `inventory.instructions.md`
- `ui.instructions.md`