import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { UpdateProductInput } from "../types/domain";

export const updateProduct = onCall(async (request) => {
  const data = request.data as UpdateProductInput;

  if (
    !data?.productId ||
    !data?.productCode ||
    !data?.name ||
    !data?.brandId ||
    !data?.categoryId ||
    !data?.productType
  ) {
    throw new HttpsError(
      "invalid-argument",
      "productId, productCode, name, brandId, categoryId, and productType are required."
    );
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const productRef = db.doc(`tenants/${actor.tenantId}/products/${data.productId}`);
  const payload: Record<string, unknown> = {
    productCode: data.productCode.trim(),
    name: data.name.trim(),
    brandId: data.brandId,
    categoryId: data.categoryId,
    productType: data.productType,
    packagingCategory: data.packagingCategory ?? "PACKAGED",
    ingredients: (data.ingredients ?? "").trim(),
    variantAssignments: data.variantAssignments ?? {},
    variantOrder: data.variantOrder ?? Object.keys(data.variantAssignments ?? {}),
    active: Boolean(data.active),
    updatedAt: serverTimestamp()
  };

  payload.gender = data.gender ?? null;

  await productRef.update(payload);
  return { ok: true };
});
