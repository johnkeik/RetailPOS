import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db } from "../common/firestore";
import { UpdateBrandInput } from "../types/domain";

export const updateBrand = onCall(async (request) => {
  const data = request.data as UpdateBrandInput;

  if (!data?.brandId || !data?.name || data.name.trim().length === 0) {
    throw new HttpsError("invalid-argument", "brandId and name are required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const brandRef = db.doc(`tenants/${actor.tenantId}/brands/${data.brandId}`);
  await brandRef.update({
    name: data.name.trim(),
    code: data.code?.trim() || null,
    active: Boolean(data.active)
  });

  return { ok: true };
});
