import {HttpsError, onCall} from "firebase-functions/v2/https";
import {assertRole, resolveActorContext} from "../common/auth";
import {db, serverTimestamp} from "../common/firestore";
import {CreateBrandInput} from "../types/domain";

export const createBrand = onCall(async (request) => {
  const data = request.data as CreateBrandInput;

  if (!data?.name || data.name.trim().length === 0) {
    throw new HttpsError("invalid-argument", "name is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const brandRef = db.collection(`tenants/${actor.tenantId}/brands`).doc();
  await brandRef.set({
    tenantId: actor.tenantId,
    name: data.name.trim(),
    code: data.code?.trim() || null,
    active: data.active ?? true,
    createdAt: serverTimestamp()
  });

  return {ok: true, brandId: brandRef.id};
});
