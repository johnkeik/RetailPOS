# Coding rules

These are engineering expectations. Existing implementation gaps are documented in [Architecture](ARCHITECTURE.md) and [Security](SECURITY.md).

- Prefer direct changes to existing models/services over speculative abstractions.
- Keep business-critical mutations in Cloud Functions. UI guards and TypeScript types do not authorize or validate server requests.
- Resolve tenant membership and permitted actions server-side; validate IDs, references, enums, finite numbers and bounds. Do not trust client actor IDs, prices or totals.
- Update inventory snapshots and append corresponding movements in one transaction. Preserve order/movement history and use snapshots for routine balance reads.
- Prefer deactivation for catalog/staff records with history. Hard deletion requires complete reference/balance checks and a transactional integrity strategy.
- Use emulators and synthetic fixtures for verification. Do not seed or inspect live customer data for tests.
- Use existing lower-camel-case collection names (`variantTemplates`, `stockMovements`, `employeeAccounts`, `orderEvents`) and callable naming from `functions/src/index.ts`.
- Keep documentation tied to current readers, writers and configuration. Separate implemented behavior, desired changes and unverified cloud state.

## Verification

Run checks appropriate to the change; commands are in [Operations](OPERATIONS.md#checks). Unit/mock tests do not establish deployed Firestore rules, cloud recovery or physical printer behavior. The dated [review evidence](SAAS_READINESS.md#verification) records what actually ran.
