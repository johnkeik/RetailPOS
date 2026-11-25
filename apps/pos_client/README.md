# Flutter cashier POS

Entry: `lib/main.dart`; composition: `lib/app/app.dart`. Cashier employee-code sessions are separate from Firebase-authenticated dashboard accounts. Windows sends callable HTTP requests; other native clients use the Functions SDK.

First follow [local setup](../../docs/OPERATIONS.md#local-setup) to start emulators and provision sample data. From this directory:

```sh
flutter pub get
flutter run -d macos --dart-define=POS_USE_EMULATORS=true
flutter test
flutter analyze
```

Substitute an available desktop target for `macos`. Firebase project options are compiled into `lib/core/firebase/firebase_config.dart`; emulator mode defaults to false. Shop identity is resolved server-side from the manager account during activation; no tenant build flag is needed.

For Windows delivery see [Operations](../../docs/OPERATIONS.md#windows-packaging). Printing follows saved checkout; a failed print does not reverse the sale. `POS_PRINT_SERVICE_URL` overrides the default local adapter URL, and items without ingredients are skipped. See the [print-service README](../../print-service/README.md).

See [Architecture](../../docs/ARCHITECTURE.md), [Security](../../docs/SECURITY.md), and dated [review evidence](../../docs/SAAS_READINESS.md#verification). Widget tests use mock repositories/HTTP; pricing tests use `../../test-fixtures/promotions.json`.


## PC activation

On first launch, the manager signs in with their dashboard OWNER credentials to register this PC for the shop assigned to that manager. There is no activation key. Flutter saves a separate device resume credential using OS-protected storage, not the manager password. Each restart returns to the server-verified numeric employee-code screen. An active device alone cannot read the catalog or record sales without an employee session.

Activation reuses the expense on-screen keyboard, including English, Greek, uppercase and symbols. Activation and expense fields also accept physical keyboard input. See [release/setup requirements](../../docs/OPERATIONS.md#pos-device-activation-and-release) before deploying; old unauthenticated clients are incompatible with the new rules/functions.

The macOS development target requires macOS 12 or newer. The Podfile applies that minimum to older dependency targets so they can build with the current Xcode SDK. Windows deployment is unaffected.
