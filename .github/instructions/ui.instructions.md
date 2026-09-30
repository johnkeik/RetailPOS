---
applyTo: "**/*.dart,**/*.html,**/*.scss"
---

# UI Design Rules

This is business software. Favor speed, clarity, and low training overhead.

Global UI defaults:

- clear hierarchy and predictable interactions
- high information legibility
- restrained motion and color usage

Avoid:

- decorative UI that slows tasks
- unnecessary animation
- visual complexity without functional value

Localization:

- Target audience is Greek. All user-facing literals (labels, buttons, messages, placeholders, statuses) must be in Greek.
- Code identifiers (variables, types, keys) stay in English; only user-visible text is Greek.

POS UI emphasis:

- large touch targets
- fast search and quick checkout
- minimal navigation steps

Admin UI emphasis:

- dense but readable tables
- strong filters/search
- key operational metrics visible by default

Use together with:

- `angular.instructions.md`
- `flutter.instructions.md`