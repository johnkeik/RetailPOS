import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db } from "../common/firestore";
import { ToggleEmployeeActiveInput } from "../types/domain";

export const toggleEmployeeActive = onCall(async (request) => {
  const data = request.data as ToggleEmployeeActiveInput;

  if (!data?.employeeId) {
    throw new HttpsError("invalid-argument", "employeeId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const employeeRef = db.doc(`tenants/${actor.tenantId}/employees/${data.employeeId}`);
  const employeeSnapshot = await employeeRef.get();
  if (!employeeSnapshot.exists) {
    throw new HttpsError("not-found", "Ο υπάλληλος δεν βρέθηκε.");
  }

  const accountSnapshot = await db.doc(`tenants/${actor.tenantId}/employeeAccounts/${data.employeeId}`).get();
  const authUid = accountSnapshot.data()?.["authUid"] as string | undefined;
  if (authUid) {
    await getAuth().updateUser(authUid, { disabled: !data.active });
  }

  const batch = db.batch();
  batch.update(employeeRef, { active: Boolean(data.active) });
  if (authUid) {
    batch.update(db.doc(`users/${authUid}`), { active: Boolean(data.active) });
  }
  await batch.commit();

  return { ok: true };
});
