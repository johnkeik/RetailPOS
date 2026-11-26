import { HttpsError, onCall } from "firebase-functions/v2/https";

import { db, serverTimestamp } from "../common/firestore";
import { UpdateExpenseInput } from "../types/domain";
import { changedByFields, resolveExpenseActor } from "./expense-actor";

export const updateExpense = onCall(async (request) => {
  const data = request.data as UpdateExpenseInput;

  const amount = Number(data?.amount);
  if (!data?.expenseId) {
    throw new HttpsError("invalid-argument", "expenseId is required.");
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
    throw new HttpsError("invalid-argument", "Μη έγκυρο ποσό εξόδου.");
  }
  if (data.paymentMethod !== "CARD" && data.paymentMethod !== "CASH") {
    throw new HttpsError("invalid-argument", "Μη έγκυρος τρόπος πληρωμής.");
  }
  const description = (data.description ?? "").trim();
  if (!description || description.length > 300) {
    throw new HttpsError("invalid-argument", "Συμπληρώστε περιγραφή έως 300 χαρακτήρες.");
  }

  const actor = await resolveExpenseActor(request.auth, data.tenantId, data.employeeId);

  const expenseRef = db.doc(`tenants/${actor.tenantId}/expenses/${data.expenseId}`);
  const snapshot = await expenseRef.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Το έξοδο δεν βρέθηκε.");
  }
  if (snapshot.data()?.["status"] === "VOIDED") {
    throw new HttpsError("failed-precondition", "Το έξοδο έχει ακυρωθεί.");
  }

  await expenseRef.update({
    amount: Math.round(amount * 100) / 100,
    paymentMethod: data.paymentMethod,
    description,
    updatedAt: serverTimestamp(),
    ...changedByFields("updated", actor)
  });

  return { ok: true };
});
