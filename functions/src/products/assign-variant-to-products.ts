import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { AssignVariantToProductsInput, ProductVariantAssignment } from "../types/domain";

const MAX_PRODUCTS_PER_REQUEST = 450;

export const assignVariantToProducts = onCall(async (request) => {
  const data = request.data as AssignVariantToProductsInput;
  if (
    !data?.variantTemplateId ||
    !Array.isArray(data.productIds) ||
    data.productIds.length === 0 ||
    data.productIds.some((id) => typeof id !== "string" || id.trim().length === 0)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "variantTemplateId and a non-empty productIds array are required."
    );
  }

  const productIds = [...new Set(data.productIds)];
  if (productIds.length > MAX_PRODUCTS_PER_REQUEST) {
    throw new HttpsError(
      "invalid-argument",
      `A maximum of ${MAX_PRODUCTS_PER_REQUEST} products can be updated at once.`
    );
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const templateRef = db.doc(
    `tenants/${actor.tenantId}/variantTemplates/${data.variantTemplateId}`
  );
  const templateSnapshot = await templateRef.get();
  const template = templateSnapshot.data();
  if (!templateSnapshot.exists || !template || template.active === false) {
    throw new HttpsError("not-found", "The active variant template was not found.");
  }

  const sellingPrice = template.sellingPrice;
  if (typeof sellingPrice !== "number" || !Number.isFinite(sellingPrice) || sellingPrice < 0) {
    throw new HttpsError("failed-precondition", "The variant template has no valid selling price.");
  }

  const productRefs = productIds.map((id) =>
    db.doc(`tenants/${actor.tenantId}/products/${id}`)
  );
  const productSnapshots = await db.getAll(...productRefs);
  const batch = db.batch();
  let assignedCount = 0;
  let alreadyAssignedCount = 0;
  let incompatibleCount = 0;
  let missingCount = 0;

  for (const productSnapshot of productSnapshots) {
    if (!productSnapshot.exists) {
      missingCount++;
      continue;
    }

    const product = productSnapshot.data() ?? {};
    if ((product.packagingCategory ?? "PACKAGED") !== template.packagingType) {
      incompatibleCount++;
      continue;
    }

    const rawAssignments = product.variantAssignments;
    const assignments =
      rawAssignments && typeof rawAssignments === "object" && !Array.isArray(rawAssignments) ?
        (rawAssignments as Record<string, ProductVariantAssignment>) :
        {};
    if (Object.prototype.hasOwnProperty.call(assignments, data.variantTemplateId)) {
      alreadyAssignedCount++;
      continue;
    }

    const nextAssignments = {
      ...assignments,
      [data.variantTemplateId]: { sellingPrice }
    };
    const update: Record<string, unknown> = {
      variantAssignments: nextAssignments,
      updatedAt: serverTimestamp()
    };

    if (Array.isArray(product.variantOrder)) {
      const existingOrder = [...new Set(
        product.variantOrder.filter(
          (id): id is string =>
            typeof id === "string" && Object.prototype.hasOwnProperty.call(assignments, id)
        )
      )];
      const missingOrderIds = Object.keys(assignments).filter((id) => !existingOrder.includes(id));
      update.variantOrder = [...existingOrder, ...missingOrderIds, data.variantTemplateId];
    }

    batch.update(productSnapshot.ref, update);
    assignedCount++;
  }

  if (assignedCount > 0) {
    await batch.commit();
  }

  return { assignedCount, alreadyAssignedCount, incompatibleCount, missingCount };
});
