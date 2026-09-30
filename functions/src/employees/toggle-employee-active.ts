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
  await employeeRef.update({ active: Boolean(data.active) });

  return { ok: true };
});
