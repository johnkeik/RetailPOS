import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db } from "../common/firestore";
import { UpdateCategoryInput } from "../types/domain";

export const updateCategory = onCall(async (request) => {
  const data = request.data as UpdateCategoryInput;

  if (!data?.categoryId || !data?.name || data.name.trim().length === 0) {
    throw new HttpsError("invalid-argument", "categoryId and name are required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const categoryRef = db.doc(`tenants/${actor.tenantId}/categories/${data.categoryId}`);
  await categoryRef.update({
    name: data.name.trim(),
    code: data.code?.trim() || null,
    active: Boolean(data.active)
  });

  return { ok: true };
});
