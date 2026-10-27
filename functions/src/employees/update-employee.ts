import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { UpdateEmployeeInput } from "../types/domain";

export const updateEmployee = onCall(async (request) => {
  const data = request.data as UpdateEmployeeInput;

  if (!data?.employeeId || !data?.name || data.name.trim().length === 0) {
    throw new HttpsError("invalid-argument", "employeeId and name are required.");
  }
  if (!data?.employeeCode || data.employeeCode.trim().length === 0) {
    throw new HttpsError("invalid-argument", "employeeCode is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const employeesRef = db.collection(`tenants/${actor.tenantId}/employees`);
  const duplicate = await employeesRef.where("employeeCode", "==", data.employeeCode.trim()).limit(1).get();
  if (!duplicate.empty && duplicate.docs[0].id !== data.employeeId) {
    throw new HttpsError("already-exists", "employeeCode already in use.");
  }

  const employeeRef = db.doc(`tenants/${actor.tenantId}/employees/${data.employeeId}`);
  const employeeSnapshot = await employeeRef.get();
  if (!employeeSnapshot.exists) {
    throw new HttpsError("not-found", "Ο υπάλληλος δεν βρέθηκε.");
  }

  const accountRef = db.doc(`tenants/${actor.tenantId}/employeeAccounts/${data.employeeId}`);
  const accountSnapshot = await accountRef.get();
  const authUid = accountSnapshot.data()?.["authUid"] as string | undefined;
  const active = Boolean(data.active);
  if (authUid) {
    await getAuth().updateUser(authUid, { displayName: data.name.trim(), disabled: !active });
  }

  const batch = db.batch();
  batch.update(employeeRef, {
    name: data.name.trim(),
    employeeCode: data.employeeCode.trim(),
    active,
    updatedAt: serverTimestamp()
  });
  if (authUid) {
    batch.update(db.doc(`users/${authUid}`), { active });
  }
  await batch.commit();

  return { ok: true };
});
