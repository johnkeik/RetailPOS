import {HttpsError, onCall} from "firebase-functions/v2/https";

import {assertRole, resolveActorContext} from "../common/auth";
import {db, serverTimestamp} from "../common/firestore";
import {UpdateVariantTemplateInput} from "../types/domain";

export const updateVariantTemplate = onCall(async (request) => {
  const data = request.data as UpdateVariantTemplateInput;

  if (!data?.templateId || !data?.name || !data?.unit || !data?.packagingType || data.sellingPrice == null) {
    throw new HttpsError("invalid-argument", "templateId, name, unit, packagingType, and sellingPrice are required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const templateRef = db.doc(`tenants/${actor.tenantId}/variantTemplates/${data.templateId}`);
  const payload: Record<string, unknown> = {
    name: data.name.trim(),
    code: data.code?.trim() || null,
    unit: data.unit,
    packagingType: data.packagingType,
    sellingPrice: Number(data.sellingPrice),
    active: Boolean(data.active),
    size: data.size != null ? Number(data.size) : null,
    costPrice: data.costPrice != null ? Number(data.costPrice) : null,
    perfumeMl: data.perfumeMl != null ? Number(data.perfumeMl) : null,
    essenceMl: data.essenceMl != null ? Number(data.essenceMl) : null,
    recipeConsumables: Array.isArray(data.recipeConsumables) ?
      data.recipeConsumables.map((c) => ({
        consumableId: String(c.consumableId),
        quantity: Math.max(1, Math.floor(Number(c.quantity) || 1))
      })) :
      [],
    hasSpecialBottle: Boolean(data.hasSpecialBottle),
    specialBottleConsumableId: data.specialBottleConsumableId?.trim() || null,
    specialBottleExtraPrice: data.specialBottleExtraPrice != null ? Number(data.specialBottleExtraPrice) : null,
    consumableParts: Array.isArray(data.consumableParts) ? data.consumableParts : [],
    updatedAt: serverTimestamp()
  };

  await templateRef.update(payload);
  return {ok: true};
});
