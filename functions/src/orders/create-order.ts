import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext, validateTenantScope } from "../common/auth";
import { db, inventoryDocId, serverTimestamp } from "../common/firestore";
import { BULK_INVENTORY_SENTINEL, CreateOrderInput } from "../types/domain";

export const createOrder = onCall(async (request) => {
  const data = request.data as CreateOrderInput;

  validateTenantScope(data?.tenantId);
  if (!data.employeeId || !Array.isArray(data.items) || data.items.length === 0) {
    throw new HttpsError("invalid-argument", "employeeId and at least one item are required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER", "EMPLOYEE"]);

  const cleanedItems = data.items.map((item) => ({
    productId: item.productId,
    variantTemplateId: item.variantTemplateId,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice)
  }));

  if (
    cleanedItems.some(
      (item) =>
        !item.productId ||
        !item.variantTemplateId ||
        item.quantity <= 0 ||
        item.unitPrice < 0
    )
  ) {
    throw new HttpsError("invalid-argument", "Invalid order items payload.");
  }

  const orderRef = db.collection(`tenants/${actor.tenantId}/orders`).doc();
  const now = serverTimestamp();

  await db.runTransaction(async (tx) => {
    // --- Batch-read products and variant templates ---
    const uniqueProductIds = [...new Set(cleanedItems.map((i) => i.productId))];
    const uniqueTemplateIds = [...new Set(cleanedItems.map((i) => i.variantTemplateId))];

    const productSnaps = await Promise.all(
      uniqueProductIds.map((id) => tx.get(db.doc(`tenants/${actor.tenantId}/products/${id}`)))
    );
    const templateSnaps = await Promise.all(
      uniqueTemplateIds.map((id) => tx.get(db.doc(`tenants/${actor.tenantId}/variantTemplates/${id}`)))
    );

    const productMap = new Map(productSnaps.map((s) => [s.id, s.data()]));
    const templateMap = new Map(templateSnaps.map((s) => [s.id, s.data()]));

    // --- Resolve inventory doc IDs and compute deltas ---
    // BULK products: one inventory doc per product (bulk pool, quantity = ml)
    // PACKAGED products: one inventory doc per product+variant (quantity = units)
    const inventoryDeltas = new Map<string, number>(); // docId → net delta

    for (const item of cleanedItems) {
      const product = productMap.get(item.productId);
      const isBulk = product?.packagingCategory === "BULK";

      let deduction: number;
      let docId: string;

      if (isBulk) {
        const template = templateMap.get(item.variantTemplateId);
        const sizeInMl = Number(template?.size ?? 0);
        if (sizeInMl <= 0) {
          throw new HttpsError("invalid-argument", `Variant template has no size configured.`);
        }
        deduction = item.quantity * sizeInMl; // deduct volume (ml)
        docId = inventoryDocId(item.productId, BULK_INVENTORY_SENTINEL);
      } else {
        deduction = item.quantity; // deduct units
        docId = inventoryDocId(item.productId, item.variantTemplateId);
      }

      inventoryDeltas.set(docId, (inventoryDeltas.get(docId) ?? 0) - deduction);
    }

    // --- Read unique inventory docs ---
    const inventorySnapMap = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    await Promise.all(
      [...inventoryDeltas.keys()].map(async (docId) => {
        const snap = await tx.get(db.doc(`tenants/${actor.tenantId}/inventory/${docId}`));
        inventorySnapMap.set(docId, snap);
      })
    );

    // --- Validate sufficient stock ---
    for (const [docId, delta] of inventoryDeltas) {
      const snap = inventorySnapMap.get(docId)!;
      const current = snap.exists ? Number(snap.data()?.quantity ?? 0) : 0;
      if (current + delta < 0) {
        throw new HttpsError("failed-precondition", "Insufficient stock.");
      }
    }

    // --- Apply inventory updates ---
    for (const [docId, delta] of inventoryDeltas) {
      const snap = inventorySnapMap.get(docId)!;
      const current = snap.exists ? Number(snap.data()?.quantity ?? 0) : 0;
      const [productId, vtId] = docId.split("__");
      tx.set(
        db.doc(`tenants/${actor.tenantId}/inventory/${docId}`),
        {
          tenantId: actor.tenantId,
          productId,
          variantId: vtId,
          variantTemplateId: vtId,
          quantity: current + delta,
          updatedAt: now
        },
        { merge: true }
      );
    }

    // --- Create stock movement records per order item ---
    let total = 0;
    for (const item of cleanedItems) {
      const product = productMap.get(item.productId);
      const isBulk = product?.packagingCategory === "BULK";
      const sizeInMl = isBulk ? Number(templateMap.get(item.variantTemplateId)?.size ?? 0) : 1;
      const quantityDelta = isBulk ? -(item.quantity * sizeInMl) : -item.quantity;

      const movementRef = db.collection(`tenants/${actor.tenantId}/stockMovements`).doc();
      tx.set(movementRef, {
        tenantId: actor.tenantId,
        productId: item.productId,
        variantId: item.variantTemplateId,
        variantTemplateId: item.variantTemplateId,
        type: "SALE",
        quantityDelta,
        isBulkVolume: isBulk,
        orderId: orderRef.id,
        reason: "Order sale",
        performedByEmployeeId: data.employeeId,
        createdAt: now
      });

      total += item.quantity * item.unitPrice;
    }

    // --- Create order document ---
    tx.set(orderRef, {
      tenantId: actor.tenantId,
      employeeId: data.employeeId,
      status: "COMPLETED",
      subtotal: total,
      discountTotal: 0,
      total,
      items: cleanedItems.map((item) => ({
        productCode: String(productMap.get(item.productId)?.productCode ?? ""),
        productName: String(productMap.get(item.productId)?.name ?? ""),
        productId: item.productId,
        variantId: item.variantTemplateId,
        variantTemplateId: item.variantTemplateId,
        variantCode: String(templateMap.get(item.variantTemplateId)?.code ?? item.variantTemplateId),
        variantLabel: String(templateMap.get(item.variantTemplateId)?.name ?? ""),
        isBulk: productMap.get(item.productId)?.packagingCategory === "BULK",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.quantity * item.unitPrice
      })),
      createdAt: now
    });
  });

  return { ok: true, orderId: orderRef.id };
});
