import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { ReceiveStockInput } from "../types/domain";
import { applyStockMutation } from "./shared";

export const receiveStock = onCall(async (request) => {
  const data = request.data as ReceiveStockInput;

  if (!data || Number(data.quantity) <= 0) {
    throw new HttpsError("invalid-argument", "quantity must be greater than zero.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  await applyStockMutation({
    tenantId: actor.tenantId,
    productId: data.productId,
    variantTemplateId: data.variantTemplateId,
    quantityDelta: Number(data.quantity),
    movementType: "PURCHASE",
    reason: data.reason,
    performedByEmployeeId: data.performedByEmployeeId ?? actor.uid
  });

  return { ok: true };
});
