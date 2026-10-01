import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { CreateConsumableInput } from "../types/domain";

export const createConsumable = onCall(async (request) => {
  const data = request.data as CreateConsumableInput;

  if (!data?.name?.trim()) {
    throw new HttpsError("invalid-argument", "Name is required for consumable.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const now = serverTimestamp();
  const consumableRef = db.collection(`tenants/${actor.tenantId}/consumables`).doc();

  const payload: Record<string, unknown> = {
    tenantId: actor.tenantId,
    name: data.name.trim(),
    code: data.code?.trim() || null,
    unit: data.unit?.trim() || "τεμ.",
    costPrice: data.costPrice != null ? Number(data.costPrice) : null,
    active: data.active ?? true,
    createdAt: now,
    updatedAt: now
  };

  await consumableRef.set(payload);
  return { ok: true, consumableId: consumableRef.id };
});
