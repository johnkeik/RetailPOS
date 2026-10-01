import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { ToggleConsumableActiveInput } from "../types/domain";

export const toggleConsumableActive = onCall(async (request) => {
  const data = request.data as ToggleConsumableActiveInput;

  if (!data?.consumableId) {
    throw new HttpsError("invalid-argument", "consumableId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const consumableRef = db.doc(`tenants/${actor.tenantId}/consumables/${data.consumableId}`);
  await consumableRef.update({
    active: Boolean(data.active),
    updatedAt: serverTimestamp()
  });

  return { ok: true };
});
