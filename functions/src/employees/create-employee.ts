import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { CreateEmployeeInput } from "../types/domain";

export const createEmployee = onCall(async (request) => {
  const data = request.data as CreateEmployeeInput;

  if (!data?.name || data.name.trim().length === 0) {
    throw new HttpsError("invalid-argument", "name is required.");
  }
  if (!data?.employeeCode || data.employeeCode.trim().length === 0) {
    throw new HttpsError("invalid-argument", "employeeCode is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const employeesRef = db.collection(`tenants/${actor.tenantId}/employees`);
  const existing = await employeesRef.where("employeeCode", "==", data.employeeCode.trim()).limit(1).get();
  if (!existing.empty) {
    throw new HttpsError("already-exists", "employeeCode already in use.");
  }

  const employeeRef = employeesRef.doc();
  await employeeRef.set({
    tenantId: actor.tenantId,
    name: data.name.trim(),
    employeeCode: data.employeeCode.trim(),
    active: data.active ?? true,
    createdAt: serverTimestamp()
  });

  return { ok: true, employeeId: employeeRef.id };
});
