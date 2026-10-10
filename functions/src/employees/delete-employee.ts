import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db } from "../common/firestore";
import { DeleteEmployeeInput } from "../types/domain";

export const deleteEmployee = onCall(async (request) => {
  const data = request.data as DeleteEmployeeInput;

  if (!data?.employeeId) {
    throw new HttpsError("invalid-argument", "employeeId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  // Safety check: ensure no orders are tied to this employee
  const ordersSnap = await db
    .collection(`tenants/${actor.tenantId}/orders`)
    .where("employeeId", "==", data.employeeId)
    .limit(1)
    .get();

  if (!ordersSnap.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Ο υπάλληλος έχει καταγεγραμμένες πωλήσεις στο σύστημα. Χρησιμοποιήστε την απενεργοποίηση."
    );
  }

  const employeeRef = db.doc(`tenants/${actor.tenantId}/employees/${data.employeeId}`);
  await employeeRef.delete();

  return { ok: true };
});
