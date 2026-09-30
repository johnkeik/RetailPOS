---
name: add-business-feature
description: 'Scaffold a new MVP business feature end-to-end across Firestore data model, Cloud Function, and Angular admin / Flutter POS UI, following this repo''s architecture, inventory, and minimal-engineering rules. Use when the user says "add a new feature", "νέο feature", "θέλω να προσθέσω λειτουργία", "scaffold a mutation", or asks to wire a new collection/mutation from client to Firestore.'
---

# Add Business Feature

Repeatable checklist for adding a new business capability (e.g. a new mutation, a new
tenant-scoped collection, a new admin screen) without violating the repo's hard
architecture rules.

## When to Use
- A new Firestore-backed mutation is needed (create/update/toggle-active/etc.).
- A new admin-dashboard screen needs to read/write tenant data.
- A new POS flow needs to trigger a Cloud Function.

## Before Writing Code

1. Read the relevant instruction files first (do not skip):
   - `.github/instructions/architecture.instructions.md`
   - `.github/instructions/inventory.instructions.md` (if the feature touches stock)
   - `.github/instructions/minimal-engineering.instructions.md`
   - `.github/instructions/firebase.instructions.md`
   - `.github/instructions/angular.instructions.md` or `.github/instructions/flutter.instructions.md` (whichever client)
   - `.github/instructions/ui.instructions.md`
2. Ask: can an **existing** collection/service/component be extended instead of adding a
   new one? Only add new structure for a current, concrete need.
3. Check `docs/DOMAIN-MODEL.md` and `docs/MVP_SCOPE.md` to confirm the feature is in MVP scope.

## Implementation Order (mirrors existing modules, e.g. `functions/src/brands/*`, `functions/src/inventory/*`)

1. **Types** — extend `functions/src/types/domain.ts` (and the admin-dashboard mirror in
   `apps/admin-dashboard/src/app/core/types/domain.models.ts`) rather than inventing parallel types.
2. **Cloud Function** (source of truth for business logic):
   - Validate tenant scope (`validateTenantScope`) and role (`assertRole`) — see `functions/src/common/auth.ts`.
   - Business-critical writes MUST run here, never directly from clients.
   - If the feature touches stock: follow the mandatory sale sequence in
     `inventory.instructions.md` (validate → create order/doc → create movement → update snapshot),
     inside a Firestore transaction.
   - Export the function from `functions/src/index.ts`.
3. **Admin UI** (Angular, if applicable):
   - Add a `*.service.ts` reading from `tenants/{tenantId}/...` collections, following the
     pattern in `apps/admin-dashboard/src/app/features/*/**.service.ts`.
   - Add a page component + template; all user-facing literals (labels, buttons, messages,
     errors) must be **in Greek** per `ui.instructions.md`.
   - Wire actions through a thin `*-actions.service.ts` that calls the Cloud Function
     (see `stock-actions.service.ts` for the pattern) — do not mutate Firestore directly from UI.
4. **POS UI** (Flutter, if applicable): follow `flutter.instructions.md` and keep client logic
   to UX orchestration only.
5. **Security rules**: update `firestore.rules` to keep clients from bypassing the Cloud
   Function for this mutation; verify tenant isolation (`tenantId` field checks).

## Verification Checklist
- [ ] No client writes business-critical fields directly to Firestore.
- [ ] Every stock mutation creates a movement (if inventory-related).
- [ ] All new Firestore reads/writes are scoped by `tenantId`.
- [ ] All new user-facing strings are Greek.
- [ ] No new abstraction (repository/factory/manager) was added without a concrete current need.
- [ ] Emulator run / `npm run build` in `functions` and `apps/admin-dashboard` succeed.

## After Implementation
Consider running the `/ponytail-review` or the `architecture-reviewer` agent on the diff to
catch over-engineering or architecture-rule violations before committing.
