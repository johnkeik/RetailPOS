import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db } from "../common/firestore";
import { ToggleCategoryActiveInput } from "../types/domain";

export const toggleCategoryActive = onCall(async (request) => {
  const data = request.data as ToggleCategoryActiveInput;

  if (!data?.categoryId) {
    throw new HttpsError("invalid-argument", "categoryId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const categoryRef = db.doc(`tenants/${actor.tenantId}/categories/${data.categoryId}`);
  await categoryRef.update({ active: Boolean(data.active) });

  return { ok: true };
});
