import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { ToggleProductActiveInput } from "../types/domain";

export const toggleProductActive = onCall(async (request) => {
  const data = request.data as ToggleProductActiveInput;

  if (!data?.productId) {
    throw new HttpsError("invalid-argument", "productId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const productRef = db.doc(`tenants/${actor.tenantId}/products/${data.productId}`);
  await productRef.update({
    active: Boolean(data.active),
    updatedAt: serverTimestamp()
  });

  return { ok: true };
});
