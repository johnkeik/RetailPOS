import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { AdjustStockInput } from "../types/domain";
import { applyStockMutation } from "./shared";

export const adjustStock = onCall(async (request) => {
  const data = request.data as AdjustStockInput;

  if (!data || Number(data.quantityDelta) === 0) {
    throw new HttpsError("invalid-argument", "quantityDelta must be non-zero.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  await applyStockMutation({
    tenantId: actor.tenantId,
    productId: data.productId,
    variantTemplateId: data.variantTemplateId,
    quantityDelta: Number(data.quantityDelta),
    movementType: "ADJUSTMENT",
    reason: data.reason,
    performedByEmployeeId: data.performedByEmployeeId ?? actor.uid
  });

  return { ok: true };
});
