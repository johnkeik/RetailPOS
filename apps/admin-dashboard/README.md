# Angular dashboard

Angular 20 owner administration and receiving-only employee screen. Routes: `src/app/app.routes.ts`; identity/permissions: `src/app/core/auth/`.

From this directory:

```sh
npm ci
npm start
npm test -- --watch=false --browsers=ChromeHeadless
npm run build
```

`npm start` selects development Firebase/emulator configuration; `npm run build` defaults to production. Verify the destination before using sample seed tools. Owner provisioning and full setup are in [Operations](../../docs/OPERATIONS.md#local-setup); deployments in [Operations](../../docs/OPERATIONS.md#deployment).

See [Architecture](../../docs/ARCHITECTURE.md), [Security](../../docs/SECURITY.md), and the dated [review evidence](../../docs/SAAS_READINESS.md#verification) for behavior and test limitations.
