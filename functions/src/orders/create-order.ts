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
    unitPrice: Number(item.unitPrice),
    useSpecialBottle: Boolean(item.useSpecialBottle)
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
    // BULK products:
    // If recipe (perfumeMl / essenceMl / recipeConsumables) is present:
    //   - perfumeMl * quantity from productId__perfume
    //   - essenceMl * quantity from productId__essence
    //   - consumableQty * quantity from consumableId__consumable
    // Otherwise fallback to legacy single bulk pool:
    //   - sizeInMl * quantity from productId__bulk
    // PACKAGED products:
    //   - 1 unit * quantity from productId__variantTemplateId
    const inventoryDeltas = new Map<string, number>(); // docId → net delta

    for (const item of cleanedItems) {
      const product = productMap.get(item.productId);
      const isBulk = product?.packagingCategory === "BULK";

      if (isBulk) {
        const template = templateMap.get(item.variantTemplateId);
        const hasRecipe =
          typeof template?.perfumeMl === "number" ||
          typeof template?.essenceMl === "number" ||
          (Array.isArray(template?.recipeConsumables) && template.recipeConsumables.length > 0);

        if (hasRecipe) {
          const perfumeMl = Number(template?.perfumeMl ?? 0);
          const essenceMl = Number(template?.essenceMl ?? 0);

          if (perfumeMl > 0) {
            const docId = inventoryDocId(item.productId, "perfume");
            const deduction = item.quantity * perfumeMl;
            inventoryDeltas.set(docId, (inventoryDeltas.get(docId) ?? 0) - deduction);
          }
          if (essenceMl > 0) {
            const docId = inventoryDocId(item.productId, "essence");
            const deduction = item.quantity * essenceMl;
            inventoryDeltas.set(docId, (inventoryDeltas.get(docId) ?? 0) - deduction);
          }

          if (Array.isArray(template?.recipeConsumables)) {
            for (const rc of template.recipeConsumables) {
              let cId = rc.consumableId;
              // If customer requested special bottle and template has a special bottle configured, swap bottle consumable
              if (item.useSpecialBottle && template?.hasSpecialBottle && template?.specialBottleConsumableId) {
                // Determine if this consumable is the standard bottle (e.g. name or if specialBottleConsumableId is configured)
                cId = template.specialBottleConsumableId;
              }
              const cQty = Number(rc.quantity) || 1;
              const docId = inventoryDocId(cId, "consumable");
              const deduction = item.quantity * cQty;
              inventoryDeltas.set(docId, (inventoryDeltas.get(docId) ?? 0) - deduction);
            }
          }
        } else {
          // Legacy bulk single pool
          const sizeInMl = Number(template?.size ?? 0);
          if (sizeInMl <= 0) {
            throw new HttpsError("invalid-argument", "Variant template has no size configured.");
          }
          const deduction = item.quantity * sizeInMl;
          const docId = inventoryDocId(item.productId, BULK_INVENTORY_SENTINEL);
          inventoryDeltas.set(docId, (inventoryDeltas.get(docId) ?? 0) - deduction);
        }
      } else {
        const deduction = item.quantity; // deduct units
        const docId = inventoryDocId(item.productId, item.variantTemplateId);
        inventoryDeltas.set(docId, (inventoryDeltas.get(docId) ?? 0) - deduction);
      }
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
        throw new HttpsError("failed-precondition", "Ανεπαρκές απόθεμα.");
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

    // --- Create stock movement records per order item and per deducted component ---
    let total = 0;
    for (const item of cleanedItems) {
      const product = productMap.get(item.productId);
      const isBulk = product?.packagingCategory === "BULK";
      const template = templateMap.get(item.variantTemplateId);

      if (isBulk) {
        const hasRecipe =
          typeof template?.perfumeMl === "number" ||
          typeof template?.essenceMl === "number" ||
          (Array.isArray(template?.recipeConsumables) && template.recipeConsumables.length > 0);

        if (hasRecipe) {
          const perfumeMl = Number(template?.perfumeMl ?? 0);
          const essenceMl = Number(template?.essenceMl ?? 0);

          if (perfumeMl > 0) {
            const mRef = db.collection(`tenants/${actor.tenantId}/stockMovements`).doc();
            tx.set(mRef, {
              tenantId: actor.tenantId,
              productId: item.productId,
              variantId: "perfume",
              variantTemplateId: "perfume",
              type: "SALE",
              quantityDelta: -(item.quantity * perfumeMl),
              isBulkVolume: true,
              orderId: orderRef.id,
              reason: `Πώληση (Άρωμα ${item.quantity} × ${perfumeMl}ml)`,
              performedByEmployeeId: data.employeeId || actor.uid,
              createdAt: now
            });
          }

          if (essenceMl > 0) {
            const mRef = db.collection(`tenants/${actor.tenantId}/stockMovements`).doc();
            tx.set(mRef, {
              tenantId: actor.tenantId,
              productId: item.productId,
              variantId: "essence",
              variantTemplateId: "essence",
              type: "SALE",
              quantityDelta: -(item.quantity * essenceMl),
              isBulkVolume: true,
              orderId: orderRef.id,
              reason: `Πώληση (Εσάνς ${item.quantity} × ${essenceMl}ml)`,
              performedByEmployeeId: data.employeeId || actor.uid,
              createdAt: now
            });
          }

          if (Array.isArray(template?.recipeConsumables)) {
            for (const rc of template.recipeConsumables) {
              let cId = rc.consumableId;
              let isSpecialBottle = false;
              if (item.useSpecialBottle && template?.hasSpecialBottle && template?.specialBottleConsumableId) {
                cId = template.specialBottleConsumableId;
                isSpecialBottle = true;
              }
              const cQty = Number(rc.quantity) || 1;
              const mRef = db.collection(`tenants/${actor.tenantId}/stockMovements`).doc();
              tx.set(mRef, {
                tenantId: actor.tenantId,
                productId: cId,
                variantId: "consumable",
                variantTemplateId: "consumable",
                type: "SALE",
                quantityDelta: -(item.quantity * cQty),
                isBulkVolume: false,
                orderId: orderRef.id,
                reason: isSpecialBottle
                  ? `Πώληση Special Μπουκαλιού (${item.quantity} × ${cQty} τεμ.)`
                  : `Πώληση Αναλωσίμου (${item.quantity} × ${cQty} τεμ.)`,
                performedByEmployeeId: data.employeeId || actor.uid,
                createdAt: now
              });
            }
          }
        } else {
          // Fallback legacy bulk
          const sizeInMl = Number(template?.size ?? 0);
          const quantityDelta = -(item.quantity * sizeInMl);
          const movementRef = db.collection(`tenants/${actor.tenantId}/stockMovements`).doc();
          tx.set(movementRef, {
            tenantId: actor.tenantId,
            productId: item.productId,
            variantId: item.variantTemplateId,
            variantTemplateId: item.variantTemplateId,
            type: "SALE",
            quantityDelta,
            isBulkVolume: true,
            orderId: orderRef.id,
            reason: "Πώληση",
            performedByEmployeeId: data.employeeId || actor.uid,
            createdAt: now
          });
        }
      } else {
        const movementRef = db.collection(`tenants/${actor.tenantId}/stockMovements`).doc();
        tx.set(movementRef, {
          tenantId: actor.tenantId,
          productId: item.productId,
          variantId: item.variantTemplateId,
          variantTemplateId: item.variantTemplateId,
          type: "SALE",
          quantityDelta: -item.quantity,
          isBulkVolume: false,
          orderId: orderRef.id,
          reason: "Πώληση",
          performedByEmployeeId: data.employeeId || actor.uid,
          createdAt: now
        });
      }

      total += item.quantity * item.unitPrice;
    }

    // --- Create order document ---
    tx.set(orderRef, {
      tenantId: actor.tenantId,
      employeeId: data.employeeId || actor.uid,
      status: "COMPLETED",
      subtotal: total,
      discountTotal: 0,
      total,
      items: cleanedItems.map((item) => ({
        productId: item.productId,
        variantId: item.variantTemplateId,
        variantTemplateId: item.variantTemplateId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        useSpecialBottle: item.useSpecialBottle,
        lineTotal: item.quantity * item.unitPrice
      })),
      createdAt: now
    });
  });

  return { ok: true, orderId: orderRef.id };
});

