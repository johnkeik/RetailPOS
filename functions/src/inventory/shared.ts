import { HttpsError } from "firebase-functions/v2/https";

import { db, inventoryDocId, serverTimestamp } from "../common/firestore";
import { StockMutationInput } from "../types/domain";
import { validateTenantScope } from "../common/auth";

export async function applyStockMutation(input: StockMutationInput): Promise<void> {
  validateTenantScope(input.tenantId);
  if (!input.productId || !input.variantTemplateId) {
    throw new HttpsError("invalid-argument", "productId and variantTemplateId are required.");
  }
  if (input.quantityDelta === 0) {
    throw new HttpsError("invalid-argument", "quantityDelta must be non-zero.");
  }

  const now = serverTimestamp();
  const inventoryRef = db.doc(
    `tenants/${input.tenantId}/inventory/${inventoryDocId(input.productId, input.variantTemplateId)}`
  );
  const movementRef = db.collection(`tenants/${input.tenantId}/stockMovements`).doc();

  await db.runTransaction(async (tx) => {
    const inventorySnap = await tx.get(inventoryRef);
    const currentQty = inventorySnap.exists ? Number(inventorySnap.data()?.quantity ?? 0) : 0;
    const nextQty = currentQty + input.quantityDelta;

    if (nextQty < 0) {
      throw new HttpsError("failed-precondition", "Insufficient stock.");
    }

    tx.set(
      inventoryRef,
      {
        tenantId: input.tenantId,
        productId: input.productId,
        variantId: input.variantTemplateId,
        variantTemplateId: input.variantTemplateId,
        quantity: nextQty,
        updatedAt: now
      },
      { merge: true }
    );

    tx.set(movementRef, {
      tenantId: input.tenantId,
      productId: input.productId,
      variantId: input.variantTemplateId,
      variantTemplateId: input.variantTemplateId,
      type: input.movementType,
      quantityDelta: input.quantityDelta,
      reason: input.reason ?? null,
      orderId: input.orderId ?? null,
      performedByEmployeeId: input.performedByEmployeeId ?? null,
      createdAt: now
    });
  });
}
