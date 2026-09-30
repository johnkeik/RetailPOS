import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db } from "../common/firestore";
import { ToggleBrandActiveInput } from "../types/domain";

export const toggleBrandActive = onCall(async (request) => {
  const data = request.data as ToggleBrandActiveInput;

  if (!data?.brandId) {
    throw new HttpsError("invalid-argument", "brandId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const brandRef = db.doc(`tenants/${actor.tenantId}/brands/${data.brandId}`);
  await brandRef.update({ active: Boolean(data.active) });

  return { ok: true };
});
