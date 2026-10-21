# Περιβάλλοντα (staging / production)

Σήμερα υπάρχει μόνο το project `pos-inventorysaas` (βλ. `.firebaserc`). Κάθε δοκιμή γίνεται πάνω σε πραγματικά δεδομένα. Ο στόχος είναι ένα δεύτερο, ξεχωριστό project για δοκιμές.

Οι εντολές εγκατάστασης του παραγωγικού project περιγράφονται στο [ADMIN-DEPLOYMENT.md](ADMIN-DEPLOYMENT.md). Εδώ περιγράφεται μόνο ό,τι προστίθεται για το staging.

## 1. Δημιουργία του staging project

1. Δημιούργησε νέο Firebase project (π.χ. `pos-inventorysaas-staging`) στο Firebase Console ή με `firebase projects:create`.
2. Ενεργοποίησε Authentication, Firestore (ίδια τοποθεσία με την παραγωγή, `eur3`), Functions και Hosting.
3. Το project πρέπει να είναι σε Blaze plan για να ανεβούν οι functions.
4. Φτιάξε ένα Web App στο project και κράτα το config (`apiKey`, `appId` κ.λπ.).

## 2. Aliases στο Firebase CLI

```sh
firebase use --add            # επέλεξε το staging project, alias: staging
firebase use --add            # επέλεξε το production project, alias: production
firebase use staging          # ενεργό project για τις επόμενες εντολές
```

Το `.firebaserc` θα έχει τότε κάτι σαν:

```json
{
  "projects": {
    "default": "pos-inventorysaas",
    "production": "pos-inventorysaas",
    "staging": "pos-inventorysaas-staging"
  }
}
```

Μην βασίζεσαι στο ενεργό alias: δώσε πάντα ρητά `--project staging` ή `--project production` σε κάθε `deploy`.

## 3. Ρυθμίσεις που πρέπει να δείχνουν στο staging

- **Admin dashboard:** το Firebase config του Angular είναι γραμμένο στο `src/app/core/firebase/firebase.config.ts` (production) και `firebase.config.development.ts` (emulators). Πρόσθεσε αρχείο config για το staging και αντίστοιχη `staging` configuration στο `angular.json` με `fileReplacements`, όπως ήδη γίνεται για το production.
- **POS client (Flutter):** το `PosFirebaseConfig.options` πρέπει να δείχνει στο staging project. Το `tenantId` δίνεται ήδη ανά εγκατάσταση με `--dart-define=POS_TENANT_ID=...`.
- **Bootstrap ιδιοκτήτη:** στο staging χρειάζεται δικός του OWNER, με `npm run bootstrap:admin -- <email> <tenantId> <staging-project-id>` (βλ. ADMIN-DEPLOYMENT.md).

Τα δεδομένα δεν μεταφέρονται αυτόματα από την παραγωγή. Για δοκιμές χρησιμοποίησε τα mock seed buttons του dashboard ή δικά σου δεδομένα. Μην αντιγράφεις πραγματικά δεδομένα πελατών στο staging.

## 4. Διαδικασία deploy

Πάντα με αυτή τη σειρά και **στο ίδιο project**, γιατί οι functions, τα rules και το dashboard εξαρτώνται μεταξύ τους:

1. **Rules, indexes και functions**

   ```sh
   firebase deploy --only firestore:rules,firestore:indexes,functions --project staging
   ```

2. **Hosting (admin dashboard)**

   ```sh
   firebase deploy --only hosting --project staging
   ```

3. **POS client:** νέο build του Flutter app και εγκατάσταση στο μηχάνημα.

Επανέλαβε με `--project production` μόνο αφού ελέγξεις το staging.

### Γιατί μαζί

Όταν προστέθηκε η συλλογή `expenses`, οι functions ανέβηκαν αλλά τα rules όχι. Η σελίδα εξόδων του dashboard δεν έδειχνε τίποτα, γιατί το production rule δεν επέτρεπε ανάγνωση της νέας συλλογής. Κάθε αλλαγή που αγγίζει νέα συλλογή ή πεδίο χρειάζεται deploy και των τριών: rules, functions, dashboard.

## 5. Checklist πριν από deploy στην παραγωγή

- [ ] `cd functions && npm run lint && npm run build` περνάει.
- [ ] `cd apps/admin-dashboard && npm run build` περνάει.
- [ ] `cd apps/pos_client && flutter analyze` δεν έχει σφάλματα.
- [ ] Αν προστέθηκε συλλογή: ενημερώθηκε το `firestore.rules`.
- [ ] Αν προστέθηκε ερώτημα με πολλά πεδία ή range: ενημερώθηκε το `firestore.indexes.json`.
- [ ] Δοκιμάστηκε το σενάριο στο staging (POS και dashboard).
- [ ] Αποφασίστηκε πώς γίνεται rollback (βλ. παρακάτω).

## 6. Rollback

- **Functions:** κάνε checkout του προηγούμενου commit και ξανά deploy των functions.
- **Rules:** στο Firebase Console, Firestore, Rules, υπάρχει ιστορικό εκδόσεων. Μπορείς να επαναφέρεις προηγούμενη έκδοση.
- **Hosting:** στο Firebase Console, Hosting, ιστορικό releases, επιλογή προηγούμενου release.
- **Δεδομένα:** βλ. [BACKUP-RECOVERY.md](BACKUP-RECOVERY.md).
