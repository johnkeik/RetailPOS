import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db } from "../common/firestore";
import { DeleteExpenseInput } from "../types/domain";

export const deleteExpense = onCall(async (request) => {
  const data = request.data as DeleteExpenseInput;

  if (!data?.expenseId) {
    throw new HttpsError("invalid-argument", "expenseId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  await db.doc(`tenants/${actor.tenantId}/expenses/${data.expenseId}`).delete();
  return { ok: true };
});
