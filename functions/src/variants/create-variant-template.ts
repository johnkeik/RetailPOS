import {HttpsError, onCall} from "firebase-functions/v2/https";

import {assertRole, resolveActorContext} from "../common/auth";
import {db, serverTimestamp} from "../common/firestore";
import {CreateVariantTemplateInput} from "../types/domain";

export const createVariantTemplate = onCall(async (request) => {
  const data = request.data as CreateVariantTemplateInput;

  if (!data?.name || !data?.unit || !data?.packagingType || data.sellingPrice == null) {
    throw new HttpsError("invalid-argument", "name, unit, packagingType, and sellingPrice are required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const now = serverTimestamp();
  const templateRef = db.collection(`tenants/${actor.tenantId}/variantTemplates`).doc();

  const payload: Record<string, unknown> = {
    tenantId: actor.tenantId,
    name: data.name.trim(),
    code: data.code?.trim() || null,
    unit: data.unit,
    packagingType: data.packagingType,
    sellingPrice: Number(data.sellingPrice),
    active: data.active ?? true,
    createdAt: now,
    updatedAt: now,
  };

  if (data.size != null) payload.size = Number(data.size);
  if (data.costPrice != null) payload.costPrice = Number(data.costPrice);

  await templateRef.set(payload);
  return {ok: true, templateId: templateRef.id};
});
