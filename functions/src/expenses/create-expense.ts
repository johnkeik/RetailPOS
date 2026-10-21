import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext, validateTenantScope } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { CreateExpenseInput } from "../types/domain";

export const createExpense = onCall(async (request) => {
  const data = request.data as CreateExpenseInput;

  const amount = Number(data?.amount);
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
  if (!data.employeeId) {
    throw new HttpsError("invalid-argument", "employeeId is required.");
  }

  validateTenantScope(data.tenantId);
  const actor = request.auth?.uid ?
    await resolveActorContext(request.auth, data.tenantId) :
    { uid: `pos:${data.employeeId}`, tenantId: data.tenantId, role: "EMPLOYEE" as const };
  assertRole(actor, ["OWNER", "EMPLOYEE"]);

  const employeeSnap = await db.doc(`tenants/${actor.tenantId}/employees/${data.employeeId}`).get();
  if (!employeeSnap.exists || employeeSnap.data()?.["active"] === false) {
    throw new HttpsError("permission-denied", "Ο υπάλληλος δεν είναι ενεργός στο κατάστημα.");
  }

  const expenseRef = db.collection(`tenants/${actor.tenantId}/expenses`).doc();
  await expenseRef.set({
    tenantId: actor.tenantId,
    employeeId: data.employeeId,
    amount: Math.round(amount * 100) / 100,
    paymentMethod: data.paymentMethod,
    description,
    createdAt: serverTimestamp()
  });

  return { ok: true, expenseId: expenseRef.id };
});
