---
applyTo: "**/*.dart,**/*.html,**/*.scss"
---

# UI Design Rules

This is business software. Favor speed, clarity, and low training overhead.

Global UI defaults:

- clear hierarchy and predictable interactions
- high information legibility
- restrained motion and color usage
- **Strict Responsiveness**: Every screen must adapt seamlessly across desktop, tablet, and mobile (down to 360px width) without horizontal window overflow or broken layouts.

Avoid:

- decorative UI that slows tasks
- unnecessary animation
- visual complexity without functional value
- horizontal page scrolling caused by unconstrained grids or tables

Localization:

- Target audience is Greek. All user-facing literals (labels, buttons, messages, placeholders, statuses) must be in Greek.
- Code identifiers (variables, types, keys) stay in English; only user-visible text is Greek.

Responsive & Layout Invariants:

- **CSS Grid Safety**: Always use `minmax(0, 1fr)` or set `min-width: 0` on grid children and flex items to prevent wide content (like tables) from blowing out the grid container.
- **Table Containment**: Every data table must live in a dedicated `.table-wrap` scroll container (`overflow-x: auto; width: 100%; -webkit-overflow-scrolling: touch;`). Tables should have an appropriate `min-width` so columns stay readable and scroll horizontally inside their container, never causing page-level overflow.
- **Fluid & Collapsible Grids**: Form grids (`.double-grid`, filter rows, summary cards, action grids) must collapse gracefully:
  - Multi-column forms collapse to 1 column on screens $\le 640\text{px}$.
  - Summary cards use `repeat(auto-fit, minmax(180px, 1fr))`.
  - Filter bars stack vertically on smaller viewports ($\le 768\text{px}$).
- **Drawers & Modals**: Slide-over drawers must take `width: 100% !important; max-width: 100vw !important;` on mobile devices ($\le 600\text{px}$), with scrollable content bodies and pinned headers/footers.
- **Navigation**: Sidebar collapses into a horizontally scrollable or hamburger touch-bar on tablets and mobile devices ($\le 900\text{px}$).

POS UI emphasis:

- large touch targets
- fast search and quick checkout
- minimal navigation steps

Admin UI emphasis:

- dense but readable tables
- strong filters/search
- key operational metrics visible by default
- full usability on tablets and mobile screens for on-the-floor managers

Use together with:

- `angular.instructions.md`
- `flutter.instructions.md`