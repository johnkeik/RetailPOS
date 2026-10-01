import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { UpdateConsumableInput } from "../types/domain";

export const updateConsumable = onCall(async (request) => {
  const data = request.data as UpdateConsumableInput;

  if (!data?.consumableId || !data?.name?.trim()) {
    throw new HttpsError("invalid-argument", "consumableId and name are required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const consumableRef = db.doc(`tenants/${actor.tenantId}/consumables/${data.consumableId}`);
  const payload: Record<string, unknown> = {
    name: data.name.trim(),
    code: data.code?.trim() || null,
    unit: data.unit?.trim() || "τεμ.",
    costPrice: data.costPrice != null ? Number(data.costPrice) : null,
    active: Boolean(data.active),
    updatedAt: serverTimestamp()
  };

  await consumableRef.update(payload);
  return { ok: true };
});
