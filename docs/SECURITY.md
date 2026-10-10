# Security Rules


## Main principle


Users can only access data belonging to their tenant.


Every query must be tenant scoped.



---

# Authentication


Firebase Authentication manages users.


User document:


users/{uid}
# Security Model

## Admin users

Firebase Authentication identifies the Admin account. Authorization comes from the
server-managed `users/{uid}` profile, not from the client:

```json
{
	"tenantId": "store001",
	"role": "OWNER",
	"active": true
}
```

The Admin client may read only its own profile. Cloud Functions validate the
profile, tenant, role, and active status for every business mutation. The dashboard
and all child routes require an active `OWNER` profile.

## First owner bootstrap

1. Create the owner's Firebase Authentication account in the Firebase Auth Console
	 (or Auth Emulator UI for local development).
2. From `functions/`, run:

	 ```sh
	 npm run bootstrap:admin -- owner@example.com store001 YOUR_FIREBASE_PROJECT_ID
	 ```

The command requires an explicit project ID, resolves an existing Auth account by
email, and creates `users/{uid}` as an active OWNER. It refuses to overwrite an
existing profile and does not create or handle passwords. It uses Application
Default Credentials for a live project; point Firebase Admin SDK to the Auth and
Firestore Emulator when bootstrapping local data.

## Roles

- `OWNER`: Admin dashboard access and management mutations.
- `EMPLOYEE`: POS sales and permitted employee operations; no Admin dashboard access.

## Firestore access

- Client writes are denied; business mutations go through Cloud Functions.
- Admin reads require an active OWNER profile for the requested tenant.
- The POS uses a built-in `tenantId` and directly reads that store's operational
	collections to validate employee codes and load the catalog. Those reads,
	including employee codes, are not authenticated. Do not treat `tenantId` as a
	secret or use this access model where store data must be confidential.
- Manager-approved cancellation runs in a Cloud Function and atomically writes
	RETURN movements, restores inventory, and marks the order cancelled. Movements
	are never deleted.