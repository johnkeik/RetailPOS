# Αντίγραφα ασφαλείας, ανάκτηση και ειδοποιήσεις κόστους

Τα `orders`, `stockMovements` και `expenses` είναι οικονομικά δεδομένα. Οι κανόνες του project λένε ότι τα `stockMovements` δεν διαγράφονται ποτέ, αλλά αυτό δεν προστατεύει από λάθος διαγραφή, κακό script ή προβλήματα της πλατφόρμας.

Οι εντολές εδώ δεν έχουν τρέξει πάνω στο project. Έλεγξε τις τρέχουσες επιλογές και τιμές στην επίσημη τεκμηρίωση της Firestore πριν τις εφαρμόσεις, γιατί τα όρια και η χρέωση αλλάζουν.

Η βάση είναι η `(default)` στην τοποθεσία `eur3` (βλ. `firebase.json`).

## 1. Point-in-time recovery (PITR)

Επιτρέπει ανάκτηση της βάσης σε οποιαδήποτε στιγμή μέσα στο παράθυρο διατήρησης (7 ημέρες). Έχει επιπλέον κόστος αποθήκευσης.

```sh
gcloud firestore databases update --database='(default)' \
  --enable-pitr --project=<project-id>
```

Χρήσιμο για λάθη των τελευταίων ημερών, π.χ. μαζική διαγραφή ή λάθος script.

## 2. Προγραμματισμένα backups

Τα scheduled backups κρατούν στιγμιότυπα για μεγαλύτερο διάστημα από το PITR.

```sh
# Ημερήσιο, διατήρηση 7 ημερών
gcloud firestore backups schedules create --database='(default)' \
  --recurrence=daily --retention=7d --project=<project-id>

# Εβδομαδιαίο, διατήρηση 8 εβδομάδων (π.χ. για μηνιαία αναφορά στη λογίστρια)
gcloud firestore backups schedules create --database='(default)' \
  --recurrence=weekly --day-of-week=SUNDAY --retention=8w --project=<project-id>
```

Λίστα με τα υπάρχοντα:

```sh
gcloud firestore backups schedules list --database='(default)' --project=<project-id>
gcloud firestore backups list --project=<project-id>
```

## 3. Ανάκτηση

**Μην επαναφέρεις ποτέ πάνω στην `(default)` βάση.** Η επαναφορά γίνεται σε **νέα** βάση, ελέγχεις τα δεδομένα, και μετά αντιγράφεις ό,τι χρειάζεται.

```sh
gcloud firestore databases restore \
  --source-backup=projects/<project-id>/locations/eur3/backups/<backup-id> \
  --destination-database=restore-test \
  --project=<project-id>
```

Βήματα:

1. Επαναφορά σε βάση με όνομα π.χ. `restore-test`.
2. Έλεγχος των δεδομένων στο Firebase Console (επιλογή βάσης).
3. Αντιγραφή των εγγραφών που χάθηκαν (export/import ή script) στην παραγωγική βάση.
4. Διαγραφή της προσωρινής βάσης, για να μη χρεώνεται.

### Δοκιμή ανάκτησης

Μια φορά πριν χρειαστεί, κάνε δοκιμαστική επαναφορά σε staging και βεβαιώσου ότι ξέρεις τη διαδικασία. Ένα backup που δεν έχει δοκιμαστεί δεν είναι εγγύηση.

## 4. Χειροκίνητο export (πριν από επικίνδυνες αλλαγές)

Πριν από migration ή μαζική αλλαγή δεδομένων:

```sh
gcloud firestore export gs://<bucket>/export-$(date +%F) --project=<project-id>
```

Το bucket πρέπει να υπάρχει και να έχει τα σωστά δικαιώματα.

## 5. Ειδοποίηση κόστους (budget alert)

Δεν υπάρχει σκληρό όριο: το budget alert απλώς ειδοποιεί. Ένα λάθος που διαβάζει εκατομμύρια έγγραφα ή ένα loop σε function φαίνεται πρώτα στον λογαριασμό.

1. Google Cloud Console, Billing, Budgets & alerts, Create budget.
2. Επίλεξε το billing account και το project.
3. Όρισε μηνιαίο ποσό (π.χ. 10–20 EUR, αρκετά πάνω από το αναμενόμενο κόστος).
4. Πρόσθεσε κανόνες ειδοποίησης στο 50%, 90% και 100%.
5. Πρόσθεσε το email σου στους παραλήπτες.

Δες επίσης τις αναγνώσεις Firestore στο Usage tab του Firebase Console μετά από κάθε αλλαγή που αγγίζει πολλά έγγραφα.

## 6. Checklist

- [ ] PITR ενεργό στην παραγωγική βάση.
- [ ] Ημερήσιο scheduled backup και εβδομαδιαίο με μεγαλύτερη διατήρηση.
- [ ] Έγινε τουλάχιστον μία δοκιμαστική επαναφορά σε ξεχωριστή βάση.
- [ ] Budget alert με παραλήπτη που διαβάζεται πραγματικά.
- [ ] Υπάρχει export πριν από κάθε migration.
