# Retail POS Copilot Context

## Product

Multi-tenant perfume retail POS + admin system.

Stack:

- Flutter POS
- Angular Admin
- Firebase (Auth, Firestore, Cloud Functions, Emulator Suite)

## MVP Boundary

Only build what is needed for MVP unless explicitly requested:

1. Product management
2. Variant management
3. Stock receiving
4. Sales
5. Inventory tracking

## Architecture Contract

Flow:

- Clients (Flutter/Angular) -> Cloud Functions -> Firestore

Rules:

- Business-critical logic must run in Cloud Functions.
- Firestore is the source of truth.
- Client code should orchestrate UX, not enforce business rules.

## Inventory Contract

Inventory has two mandatory models:

1. Snapshot (`inventory`) for current quantity.
2. Immutable history (`stockMovements`) for audit/reporting.

Never:

- change stock without creating a movement
- delete stock movement history
- recompute current stock by scanning all movements

## Tenant Isolation

Every business document is tenant-scoped.

Mandatory field:

- `tenantId`

Never allow cross-tenant reads or writes.

## Engineering Style

Prefer:

- simple and direct solutions
- extending existing models before adding new abstractions
- low read-cost and transaction-safe backend operations

Avoid:

- speculative abstractions
- unnecessary frameworks or layers
- features outside MVP scope

## Instruction Map

Use these files as specialized rules:

- `.github/instructions/architecture.instructions.md`: system boundaries
- `.github/instructions/inventory.instructions.md`: stock invariants
- `.github/instructions/minimal-engineering.instructions.md`: anti-bloat defaults
- `.github/instructions/firebase.instructions.md`: backend/data implementation rules
- `.github/instructions/angular.instructions.md`: admin UI/app patterns
- `.github/instructions/flutter.instructions.md`: POS app patterns
- `.github/instructions/ui.instructions.md`: UX constraints for business software