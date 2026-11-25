# Implemented security model and gaps

Source-derived review: 8 November 2026; POS device/session implementation updated 12 November 2026. This describes checked-in rules and handlers, not deployed policy. No live users, security documents, PIN hashes or credentials were inspected.

## Authenticated dashboard

Firebase email/password identifies an account. `users/{uid}` supplies one tenant, OWNER/EMPLOYEE and active state; profiles are server-managed and clients can get only their own profile. `resolveActorContext` rejects missing profiles, mismatched tenants, unsupported roles and explicitly inactive users. For EMPLOYEE it also checks active employee state and the private account's Auth UID link. See `functions/src/common/auth.ts`, `apps/admin-dashboard/src/app/core/auth/`, and `firestore.rules`.

Owners can read the allowlisted tenant collections, manage catalog/staff/stock/promotions/expenses and set a manager PIN. Linked dashboard employees can read receiving catalog/inventory and submit PURCHASE movements through `recordStockMovements`; adjustments/losses are denied. Authenticated EMPLOYEE calls to sales, cancellation and expense creation are explicitly rejected. This dashboard account is distinct from the cashier code session.

Owner bootstrap resolves an existing Auth account and creates its OWNER profile; it requires explicit email, tenant and project arguments. It returns successfully for an existing matching active OWNER profile and refuses a conflicting profile. See `functions/scripts/bootstrap-admin-user.js`.

## Registered POS devices and employee sessions

Manager activation requires a fresh Firebase email/password login (within five minutes) and an active OWNER profile for the shop assigned to the manager. `activatePosDevice` creates a separate Firebase device UID and a server-managed `tenants/{tenantId}/devices/{deviceUid}` record. No license/activation key is required. The manager is signed out after registration; the till uses its own identity, without owner permissions.

Flutter stores a random 256-bit device resume credential using `flutter_secure_storage` (Windows Credential Manager for the selected Windows plugin). Firestore stores only its SHA-256 hash. `resumePosDevice` validates the credential and active device record, clears any previous employee session, and issues a Firebase custom token. The app resumes after restart but always returns to employee login. Losing local credentials requires manager activation again. A copied device credential can impersonate that device; secure storage reduces this risk but is not hardware attestation.

`startPosEmployeeSession` verifies the numeric employee code server-side, requires exactly one active matching employee and issues a token bound to that employee and a new session ID. Device login attempts are transactionally limited to ten per 15-minute window, including successful attempts; resuming cannot reset the limit. Existing codes remain in employee documents, owner-readable only; they are not downloaded by the till. Keep codes unique, numeric and no longer than 12 digits.

Firestore POS reads require a matching shop, active device, current employee/session claims and active employee. Only categories, orders, products, promotions and variant templates are readable by tills. Employees, device records, inventory and other operational collections are not exposed to device clients. No unauthenticated operational read grant remains. History uses saved employee names rather than downloading employee codes.

`createOrder`, `cancelOrder` and `createExpense` now reject unauthenticated calls. `resolvePosActor` checks the active device and exact employee/session binding; OWNER calls remain permitted and receiving-only dashboard EMPLOYEE accounts remain denied. Windows sends a Firebase ID token in the authorization header. These checks are required in handlers because Admin SDK operations bypass Firestore rules.

To revoke a PC, set its device record's `active` field to `false` through trusted administrative access. Subsequent protected server access and resume attempts fail. Switching employee invalidates the previous session. Revocation does not erase data already displayed or cached locally. There is no automatic inactivity timeout or subscription enforcement in this implementation, and no dashboard device-management screen yet. Cancellation and expense permissions remain available to authenticated cashiers; manager approval policy is unchanged.

Implementation: `functions/src/pos/device-auth.ts`, Flutter `features/pos/auth/pos_device_auth.dart`, `employee_session_gate.dart`, `pos_activation_page.dart`, and `firestore.rules`. This is checked-in behavior, not a claim that production has been updated. See [activation and release](OPERATIONS.md#pos-device-activation-and-release).

## Manager PIN and cancellation

`setManagerPin` is OWNER-only and stores a scrypt hash with random salt in a private document. `assertManagerPin` implements five failures followed by a 15-minute lockout, but no current cancellation handler invokes it. Cancellation UI asks for confirmation, not manager credentials. Do not claim manager-approved cancellation. Sources: `functions/src/common/manager-pin.ts`, `security/set-manager-pin.ts`, `orders/cancel-order.ts`, and `apps/pos_client/lib/features/pos/presentation/pos_order_history_dialog.dart`.

## Local development and remaining assurance

`resolveActorContext` grants an unauthenticated OWNER actor when `FUNCTIONS_EMULATOR=true`. This is a development bypass and means emulator success alone does not prove production authorization. Synthetic order seeding is separately emulator-only.

Backend unit tests use in-memory substitutes. `functions/test/integration/pos.rules.cjs` exercises actual local Firestore rules for public/wrong-shop reads, stale sessions, employee/device revocation and denied writes. `pos-handshake.cjs` exercises activation and employee token exchange over local emulator HTTP. These suites are not production or Windows-machine certification. Some handlers interpolate IDs with less validation than promotion handlers; do not assume universal input/path validation. No callable App Check enforcement was found.

The local print service binds localhost by checked-in configuration and has no API authentication. It should not be exposed to a store LAN without a designed access model. See `print-service/MiniPOS.PrintService/{Program.cs,appsettings.json}`.
