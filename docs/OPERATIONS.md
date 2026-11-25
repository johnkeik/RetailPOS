# Operations

Source-derived review: 8 November 2026. This is the setup and release reference for the checked-in software. Live projects, authorized domains, billing, deployed versions, backups and hardware were not inspected. Test execution results are recorded in [SAAS_READINESS.md](SAAS_READINESS.md).

## Tools and destination selection

Use the dependency lockfiles in `functions/` and `apps/admin-dashboard/`; install Flutter dependencies in `apps/pos_client/`. The backend manifest declares Node 22. Windows packaging explicitly checks Flutter 3.24.5 and .NET 8 and requires Inno Setup.

| Surface | Destination selector | Default or limitation |
| --- | --- | --- |
| Angular | `apps/admin-dashboard/angular.json` and `src/app/core/firebase/firebase.config*.ts` | `npm start` uses development config/emulators; production build uses base config |
| Flutter | `apps/pos_client/lib/core/firebase/firebase_config.dart` | Compiled project options; `POS_USE_EMULATORS` defaults false; activation derives the tenant from the manager’s server-managed profile |
| Windows callable HTTP | `apps/pos_client/lib/features/pos/data/cloud_functions_pos_order_repository.dart` | Compiled project, hardcoded `us-central1`; local endpoint only when emulator flag is true |
| Backend/bootstrap | Runtime/Admin SDK credentials, project ID and emulator endpoint variables | Ad-hoc scripts need their own explicit environment |
| Firebase CLI | Explicit `--project` and root `.firebaserc` aliases | CLI target selection does not rewrite either client's compiled config |

`firebase.json` configures Firestore `(default)` in `eur3`, Auth emulator 9099, Firestore 8080, Functions 5001 and the emulator UI. Database location does not establish the location of every service. No dedicated Angular staging build or staging provisioning automation is checked in.

## Local setup

1. Run `npm ci` in both `functions/` and `apps/admin-dashboard/`, and `flutter pub get` in `apps/pos_client/`. Build the backend with `npm run build` in `functions/`.
2. From repo root start the full emulator set. Replace the project value with the same configured project ID used by both local clients:

   ```sh
   POS_PROJECT_ID="replace-with-configured-project-id"
   firebase emulators:start --only auth,firestore,functions --project "$POS_PROJECT_ID"
   ```

   The backend's `npm run serve` starts only Functions; it does not supply Auth/Firestore emulators.
3. Create a fictional owner in the Auth Emulator UI. In a separate terminal, from `functions/`, set the same project value and bootstrap with **both** Admin SDK emulator endpoints:

   ```sh
   POS_PROJECT_ID="replace-with-configured-project-id"
   FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 \
   FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 \
   npm run bootstrap:admin -- demo-owner@example.invalid store002 "$POS_PROJECT_ID"
   ```

   If `GCLOUD_PROJECT` or `GOOGLE_CLOUD_PROJECT` is set, it must agree with the positional project ID. The script resolves an existing Auth email, creates one active OWNER profile, accepts an existing matching active OWNER, and refuses a conflicting profile. It creates neither passwords nor a tenant root document. Source: `functions/scripts/bootstrap-admin-user.js`.
4. Run `npm start` in `apps/admin-dashboard/`, confirm the development config connects to localhost, and sign in as the fictional owner. Create a synthetic employee, minimal catalog and opening stock through the dashboard.
5. From `apps/pos_client/` run a supported desktop target with explicit settings:

   ```sh
   flutter run -d macos --dart-define=POS_USE_EMULATORS=true
   ```

   Substitute a locally available desktop target as needed; platform scaffolding does not certify platform support.
6. Submit a synthetic checkout and cancellation and reconcile stock/movements. The sample scenario is in [SAAS_READINESS.md](SAAS_READINESS.md).

Dashboard sample seeds operate on the selected destination; do not run them against the original shop. `seedMockOrders` is emulator-only, requires an empty order collection, and creates historical orders without stock movements. Use actual synthetic checkout for stock/cancellation verification. The emulator actor resolver grants unauthenticated OWNER access for development; it does not prove production authorization. See [SECURITY.md](SECURITY.md).

## Checks

Run these from the stated directories. Commands are not claims of a passing result; consult the dated verification evidence in the SaaS handoff.

| Directory | Commands |
| --- | --- |
| `functions/` | `npm run lint`; `npm test` (includes TypeScript build) |
| `apps/admin-dashboard/` | `npm test -- --watch=false --browsers=ChromeHeadless`; `npm run build` |
| `apps/pos_client/` | `flutter analyze`; `flutter test` |
| `print-service/` | `dotnet test MiniPOS.PrintService.Tests` |

Backend tests use pure/in-memory data; print tests use a fake printer. Separately exercise actual rules, authenticated cross-store denial, concurrent tills, retry behavior and printer hardware before depending on them.

## Deployment

Create or independently verify an isolated staging project and synthetic dataset. Select its Firebase options in both clients and the matching CLI target. Confirm required Firebase Auth, Firestore, Functions and Hosting services, billing prerequisites and authorized domains externally. Current access gaps in [SECURITY.md](SECURITY.md) must be repaired before confidential independent-store onboarding.

For a cloud owner, create the Auth user in the intended project and configure the Admin SDK's credentials for that project. From `functions/`:

```sh
POS_PROJECT_ID="replace-with-target-project-id"
POS_TENANT_ID="replace-with-tenant-id"
npm run bootstrap:admin -- owner@example.invalid "$POS_TENANT_ID" "$POS_PROJECT_ID"
```

Use the real intended owner's email when provisioning; the example is synthetic. Bootstrap semantics are the same as local setup. Project aliases alone do not establish cloud state or provision tenant data.

After staging validation, from repo root deploy matching rules/indexes/functions first, then Hosting:

```sh
POS_PROJECT_ID="replace-with-target-project-id"
firebase deploy --only firestore:rules,firestore:indexes,functions --project "$POS_PROJECT_ID"
firebase deploy --only hosting --project "$POS_PROJECT_ID"
```

`firebase.json` runs backend lint/build before Functions deploy and Angular build before Hosting deploy. Hosting serves `apps/admin-dashboard/dist/admin-dashboard/browser` and rewrites SPA routes to `index.html`. `firestore.indexes.json` declares no composite indexes; validate query requirements for the target environment. No tracked CI release workflow was found.

## Windows packaging

On a prepared Windows machine, from repo root:

```powershell
.\scripts\build-installer-windows.ps1
```

Pass the intended tenant explicitly: both scripts otherwise default to the original shop. Override tool discovery with `-FlutterRoot`, `-DotnetRoot`, `-IsccPath` or matching `FLUTTER_ROOT`, `DOTNET_ROOT`, `ISCC_PATH` environment variables. Compatible desktop C++ build tools/SDK, Flutter desktop tooling, .NET 8 and Inno Setup must be installed. No SDK compatibility patch or build-machine provisioning is included in this repo.

`scripts/package-windows.ps1` restores Flutter packages, builds one client for the configured Firebase project, publishes the self-contained `win-x64` print adapter, bundles it beside the POS and recreates `MiniPOS-windows.zip`. It does not pass the emulator flag; select staging/cloud configuration deliberately. The wrapper checks the POS executable, print executable and label template before compiling `installer/MiniPOS.iss`.

Outputs are `installer/Output/MiniPOS-Setup.exe` and `MiniPOS-windows.zip`. Inno Setup installs into Program Files, requires admin privileges, creates shortcuts and offers launch. Installer version is fixed at `1.0.0`; app ID/output names are shared across tenant builds. Side-by-side tenant installations and automatic version tracking are not implemented.

Prepare DYMO Connect, compatible drivers and a suitable label roll separately. The bundled .NET adapter is not a driver installer. Its default config binds localhost:5050 and uses `Templates/label.dymo`; check configured text-object names and physical fit. `POS_PRINT_SERVICE_URL` can override the client's print destination at build time. The POS starts its bundled process if health checking finds no service, and stops only its own process on exit. There is no Windows Service registration or automatic updater.

Check a clean-PC installation, explicit project/tenant, cashier workflow, service health, printer discovery, Greek wrapping, label quantity/order, failed-print reprint and uninstall. SDK acceptance confirms submission, not physical output. Label printing follows saved checkout and failure does not reverse the sale. Adapter-specific API/template details remain in `print-service/README.md`.

## Updates, rollback and recovery

Coordinate rules, Functions, dashboard and installed POS versions. Discounted checkout requires an expected total, so older clients can be incompatible with newly activated offers. See [PROMOTIONS.md](PROMOTIONS.md). Record customer/device versions and validate rollback before rollout. No desktop auto-updater, versioned migration runner or schema-version registry was found. Reverting Hosting/Functions/rules does not reverse data writes.

No backup/PITR/budget provisioning, backup job or restore automation was found in `firebase.json`, `functions/src/index.ts` or tracked scripts. This does not prove backups are disabled; live cloud settings remain unknown. Before a pilot:

- Verify backup schedules/PITR, retention, cost alerts and a named operational owner.
- Agree acceptable data loss and recovery time; perform a synthetic restore drill into an isolated destination and reconcile balances, movements and orders.
- Design selective tenant export/recovery for the shared database; whole-database restore is not a safe substitute for restoring one store.
- Cover Firebase Auth, memberships, project/client configuration, releases and print templates as well as Firestore documents.
- Verify an export before a data migration and record the last successful recovery exercise.

Privileged mistakes and current catalog deletion can damage balances/history despite denied client writes. See [ARCHITECTURE.md](ARCHITECTURE.md). Choose current provider-supported recovery commands separately; this source review did not research or execute cloud recovery procedures.


## POS device activation and release

Added 12 November 2026. No production deployment is implied by these source changes.

1. Enable/verify Firebase Auth email/password and provision an active OWNER `users/{uid}` profile with the correct tenant membership. Receiving-only dashboard EMPLOYEE accounts cannot activate PCs. Use local Auth, Functions and Firestore emulators for synthetic tests; Flutter configures all three when `POS_USE_EMULATORS=true`.
2. Deploy and verify `activatePosDevice`, `resumePosDevice`, `startPosEmployeeSession` plus the updated sale/cancel/expense functions in staging. Production custom-token signing must work for the Functions service account: verify the Firebase Admin SDK signing configuration and IAM `signBlob` permission as applicable. No service-account key belongs in Flutter.
3. Build the compatible Windows client (Firebase Auth and secure-storage plugins are now included). Test secure credential persistence under the actual shop Windows user, restart, switch employee, denied invalid codes, receiving-only account denial and revocation. Secure storage is per OS user; another Windows login requires its own activation. Native desktop packaging and macOS keychain entitlements must be verified separately; widget tests do not establish native plugin behavior.
4. Schedule a coordinated client/functions/rules update while the shop is closed. Old clients stop working when public reads/unauthenticated mutations are removed. Do not deploy restrictive rules alone to a till still running the old client. Keep the till unavailable during the transition, then activate and smoke-test before reopening.
5. Manager opens the activation screen and signs in with existing dashboard credentials. No activation key is required. After activation, employee codes are verified on the server. Keep codes unique, numeric and at most 12 digits. Ten employee login attempts per device are permitted per 15-minute window. No automatic inactivity timeout or new manager-approval policy is added.
6. Revoke a lost/replaced PC by setting `tenants/{tenantId}/devices/{deviceUid}.active` to `false` using trusted administrative access. Device records include activating owner, name and activation time. Do not share or export device secrets. Reinstallation/lost local storage requires manager activation; revoke the old registration. Reactivation is available from the employee screen.
7. If rollback is required, keep sales recording stopped and coordinate the client/backend versions. Do not casually restore the old public access rules as a compatibility workaround.

Additional local verification from the repository root:

```sh
firebase emulators:exec --only firestore --project demo-pos-security 'node --test functions/test/integration/pos.rules.cjs'
firebase emulators:exec --only auth,firestore,functions --project demo-pos-security 'node --test functions/test/integration/pos-handshake.cjs'
```

Run `npm --prefix functions run build` before the handshake suite. Both integration scripts require local emulator hosts and synthetic data. The activation and expense forms accept physical keyboards and the shared on-screen keyboard; touch keys preserve field focus, and amount validation applies to both input methods.

Activation now resolves the tenant from the manager profile; the Windows packaging scripts no longer accept `-TenantId`. One installer supports shops in the configured Firebase project. PC credentials saved by the earlier tenant-specific prototype use a different storage key; activate those PCs once again after upgrading. Firebase project configuration remains part of the build.


### macOS activation prerequisites

Firebase Auth and secure storage require Keychain Sharing on the macOS Runner. Both Runner entitlement files include `keychain-access-groups`. Xcode requires a development signing certificate for that capability; ad-hoc `CODE_SIGN_IDENTITY = "-"` cannot build it. Open `apps/pos_client/macos/Runner.xcworkspace`, select Runner → Signing & Capabilities, choose the developer Team and enable automatic signing with Apple Development. An Apple account/certificate must be configured locally in Xcode; no Apple credentials belong in the repository. Windows builds are unaffected.

Activation failures now display and log a safe stage/code (manager sign-in, device registration, secure storage, or device sign-in). Passwords, device credentials and tokens are excluded from these diagnostics. A missing macOS signing identity blocks native verification; successful widget tests are not proof of native login.
