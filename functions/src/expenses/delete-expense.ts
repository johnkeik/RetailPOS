import { HttpsError, onCall } from "firebase-functions/v2/https";

import { db, serverTimestamp } from "../common/firestore";
import { DeleteExpenseInput } from "../types/domain";
import { changedByFields, resolveExpenseActor } from "./expense-actor";

// Expenses are never removed: a delete marks the record VOIDED so it drops out
// of totals but stays visible to the owner.
export const deleteExpense = onCall(async (request) => {
  const data = request.data as DeleteExpenseInput;

  if (!data?.expenseId) {
    throw new HttpsError("invalid-argument", "expenseId is required.");
  }

  const actor = await resolveExpenseActor(request.auth, data.tenantId, data.employeeId);

  const expenseRef = db.doc(`tenants/${actor.tenantId}/expenses/${data.expenseId}`);
  await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(expenseRef);
    if (!snapshot.exists) {
      throw new HttpsError("not-found", "Το έξοδο δεν βρέθηκε.");
    }
    if (snapshot.data()?.["status"] === "VOIDED") return;
    tx.update(expenseRef, {
      status: "VOIDED",
      voidedAt: serverTimestamp(),
      ...changedByFields("voided", actor)
    });
  });

  return { ok: true };
});
