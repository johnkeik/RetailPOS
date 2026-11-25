# MiniPOS

Perfume-shop management and inventory organization assistant, with a staff sales-recording client and owner dashboard built with Flutter, Angular and Firebase. Supports bulk perfume recipes, packaged goods, promotions, inventory movements, expenses and sales reports. It accompanies the shop's separate payment and fiscal systems; card-terminal processing, payment refunds and fiscal-receipt issuance are outside the current intended scope. SaaS onboarding and billing are not yet implemented.

## Documentation

| Document | Purpose |
| --- | --- |
| [Architecture](docs/ARCHITECTURE.md) | Components, database schema, domain behavior and sale/stock flows |
| [Operations](docs/OPERATIONS.md) | Local setup, deployment, Windows packaging, updates and recovery |
| [Security](docs/SECURITY.md) | Current access rules, roles and security gaps |
| [SaaS readiness](docs/SAAS_READINESS.md) | Product handoff, priorities, demo, review evidence and owner questions |
| [Promotions](docs/PROMOTIONS.md) | Detailed offer and discount-allocation rules |
| [Coding rules](docs/CODING_RULES.md) | Engineering conventions and verification expectations |

## Repository and quick start

- [Angular dashboard](apps/admin-dashboard/README.md): owner administration and employee stock receiving.
- [Flutter POS](apps/pos_client/README.md): cashier client and mock-based tests.
- `functions/`: TypeScript callable backend, bootstrap script and tests.
- [Print service](print-service/README.md): local .NET/DYMO label adapter.
- `firebase.json`, `firestore.rules`, `firestore.indexes.json`: hosting, emulators and database policy.
- `scripts/`, `installer/`: Windows packaging; `test-fixtures/`: shared promotion samples.

Start with [local setup](docs/OPERATIONS.md#local-setup) to run Auth, Firestore and Functions emulators, bootstrap a synthetic owner, then launch the clients. Flutter requires an explicit `POS_USE_EMULATORS=true`; it otherwise uses the configured cloud project.

POS access now requires manager-approved PC activation and a server-verified employee session. Deploy the compatible client, functions and rules together; validate on the customer’s Windows PC before rollout. See [security](docs/SECURITY.md). Historical tutorials are preserved under [docs/archive/tutorial](docs/archive/tutorial/README.md).
