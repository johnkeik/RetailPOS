import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { CreateProductInput } from "../types/domain";

export const createProduct = onCall(async (request) => {
  const data = request.data as CreateProductInput;

  if (
    !data?.productCode ||
    !data?.name ||
    !data?.brandId ||
    !data?.categoryId ||
    !data?.productType
  ) {
    throw new HttpsError(
      "invalid-argument",
      "productCode, name, brandId, categoryId, and productType are required."
    );
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const now = serverTimestamp();
  const productRef = db.collection(`tenants/${actor.tenantId}/products`).doc();

  const payload: Record<string, unknown> = {
    tenantId: actor.tenantId,
    productCode: data.productCode.trim(),
    name: data.name.trim(),
    brandId: data.brandId,
    categoryId: data.categoryId,
    productType: data.productType,
    packagingCategory: data.packagingCategory ?? "PACKAGED",
    variantAssignments: data.variantAssignments ?? {},
    active: data.active ?? true,
    createdAt: now,
    updatedAt: now
  };

  if (data.gender) {
    payload.gender = data.gender;
  }

  await productRef.set(payload);
  return { ok: true, productId: productRef.id };
});
