import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { CreateCategoryInput } from "../types/domain";

export const createCategory = onCall(async (request) => {
  const data = request.data as CreateCategoryInput;

  if (!data?.name || data.name.trim().length === 0) {
    throw new HttpsError("invalid-argument", "name is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const categoryRef = db.collection(`tenants/${actor.tenantId}/categories`).doc();
  await categoryRef.set({
    tenantId: actor.tenantId,
    name: data.name.trim(),
    code: data.code?.trim() || null,
    active: data.active ?? true,
    createdAt: serverTimestamp()
  });

  return { ok: true, categoryId: categoryRef.id };
});
