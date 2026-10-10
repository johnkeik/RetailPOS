# Admin Dashboard and Functions Deployment

This repository is configured for the Firebase project `pos-inventorysaas`.
Deployment is manual; no command in this guide has been run against Firebase.

## Before the first deployment

1. Confirm the target project in the Firebase Console is `pos-inventorysaas` and
   has Authentication, Firestore, Functions, and Hosting enabled.
2. Confirm the project is on the Firebase Blaze plan; deployed Cloud Functions
   require billing to be enabled.
3. Sign in to the Firebase CLI and select the project explicitly:

   ```sh
   firebase login
   firebase projects:list
   ```

4. Create the first owner in Firebase Authentication. Then authenticate the
   Firebase Admin SDK with Application Default Credentials and create its tenant
   profile:

   ```sh
   gcloud auth application-default login
   cd functions
   npm run bootstrap:admin -- owner@example.com store001 pos-inventorysaas
   ```

   The bootstrap script links an existing Auth user to one active OWNER profile.
   It refuses to overwrite an existing profile and does not create passwords.

## Build and test locally

From the repository root:

```sh
cd functions && npm run lint && npm run build
cd ../apps/admin-dashboard && npm test -- --watch=false --browsers=ChromeHeadless && npm run build
```

The production Angular build uses the registered Firebase Web App config and
does not connect to emulators. `ng serve` continues to use the emulator config.

## Deploy

From the repository root, deploy Firestore rules/indexes and Functions first:

```sh
firebase deploy --only firestore:rules,firestore:indexes,functions --project pos-inventorysaas
```

Then deploy Hosting. Its `predeploy` hook builds the Admin dashboard and Hosting
rewrites application routes to `index.html`:

```sh
firebase deploy --only hosting --project pos-inventorysaas
```

If deploying everything together after validating the project and rules:

```sh
firebase deploy --only firestore:rules,firestore:indexes,functions,hosting --project pos-inventorysaas
```

## Verify after deployment

- Add the Hosting domain to Firebase Authentication's authorized domains.
- Sign in with the provisioned owner and confirm the tenant is loaded from
  `users/{uid}`.
- Confirm direct client writes are denied and Functions mutations still work.
- Verify the POS store-read policy before sharing the app. The current POS uses
  a built-in tenant ID without Firebase Auth, so operational reads for
  `storeNNN` tenants (including employee codes) are public to anyone who knows
  that tenant ID. Do not use this policy where those records must be confidential.