import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { hashManagerPin, managerPinRef, newManagerPinSalt } from "../common/manager-pin";
import { serverTimestamp } from "../common/firestore";
import { SetManagerPinInput } from "../types/domain";

export const setManagerPin = onCall(async (request) => {
  const data = request.data as SetManagerPinInput;
  if (!/^\d{6}$/.test(data?.pin ?? "")) {
    throw new HttpsError("invalid-argument", "Ο κωδικός manager πρέπει να έχει 6 ψηφία.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const salt = newManagerPinSalt();
  await managerPinRef(actor.tenantId).set({
    tenantId: actor.tenantId,
    pinSalt: salt,
    pinHash: hashManagerPin(data.pin, salt),
    failedAttempts: 0,
    lockedUntil: null,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid
  });

  return { ok: true };
});