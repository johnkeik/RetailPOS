import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, validateTenantScope } from "../common/auth";
import {resolvePosActor} from "../pos/device-auth";
import { db, inventoryDocId, serverTimestamp } from "../common/firestore";
import { calculatePromotions, Promotion } from "../promotions/promotion-pricing";
import { BULK_INVENTORY_SENTINEL, CreateOrderInput } from "../types/domain";

type ManualDiscount =
  { percentage: number; details: string } |
  { fixedAmount: number; details: string };

// Keep in parity with ManualDiscount.amountCentsOf in the POS: a percentage rounds
// half-up to the cent; a fixed amount never exceeds the total.
function manualDiscountCents(totalCents: number, discount: ManualDiscount): number {
  if ("percentage" in discount) {
    return Math.floor((totalCents * discount.percentage + 50) / 100);
  }
  return Math.min(Math.round(discount.fixedAmount * 100), totalCents);
}

// The standard bottle is the first recipe consumable; the special bottle replaces only that one.
function usesSpecialBottle(
  useSpecialBottle: boolean,
  template: FirebaseFirestore.DocumentData | undefined,
  recipeIndex: number
): boolean {
  return (
    useSpecialBottle &&
    recipeIndex === 0 &&
    Boolean(template?.hasSpecialBottle) &&
    Boolean(template?.specialBottleConsumableId)
  );
}

export const createOrder = onCall(async (request) => {
  const data = request.data as CreateOrderInput;

  validateTenantScope(data?.tenantId);
  if (!data.employeeId || !Array.isArray(data.items) || data.items.length === 0) {
    throw new HttpsError("invalid-argument", "employeeId and at least one item are required.");
  }
  if (data.paymentMethod !== undefined && !["CARD", "CASH"].includes(data.paymentMethod)) {
    throw new HttpsError("invalid-argument", "Invalid payment method.");
  }

  const actor = await resolvePosActor(request.auth, data.tenantId, data.employeeId);
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
        !Number.isSafeInteger(item.quantity) || item.quantity <= 0 ||
        !Number.isFinite(item.unitPrice) || item.unitPrice < 0
    )
  ) {
    throw new HttpsError("invalid-argument", "Invalid order items payload.");
  }

  if (cleanedItems.length > 100 || cleanedItems.reduce((sum, item) => sum + item.quantity, 0) > 1000) {
    throw new HttpsError("invalid-argument", "Η παραγγελία υπερβαίνει το όριο των 100 γραμμών ή 1.000 τεμαχίων.");
  }
  if (data.expectedTotal !== undefined && (!Number.isFinite(data.expectedTotal) || data.expectedTotal < 0)) {
    throw new HttpsError("invalid-argument", "Μη έγκυρο αναμενόμενο σύνολο.");
  }
  const rawDiscount = data.manualDiscount;
  let manualDiscount: ManualDiscount | undefined;
  if (rawDiscount !== undefined && rawDiscount !== null) {
    const details = typeof rawDiscount.details === "string" ? rawDiscount.details.trim() : "";
    const hasPercentage = rawDiscount.percentage !== undefined;
    const hasFixedAmount = rawDiscount.fixedAmount !== undefined;
    const percentage = Number(rawDiscount.percentage);
    const fixedCents = Math.round(Number(rawDiscount.fixedAmount) * 100);
    const validValue = hasPercentage !== hasFixedAmount && (hasPercentage ?
      Number.isInteger(percentage) && percentage >= 1 && percentage <= 100 :
      Number.isFinite(fixedCents) && fixedCents >= 1);
    if (!validValue || details.length === 0 || details.length > 80) {
      throw new HttpsError("invalid-argument", "Μη έγκυρη έκπτωση παραγγελίας.");
    }
    if (data.expectedTotal === undefined) {
      throw new HttpsError("invalid-argument", "Η έκπτωση απαιτεί αναμενόμενο σύνολο.");
    }
    manualDiscount = hasPercentage ?
      { percentage, details } :
      { fixedAmount: fixedCents / 100, details };
  }
  let chargedTotal = 0;
  const orderRef = db.collection(`tenants/${actor.tenantId}/orders`).doc();
  const now = serverTimestamp();

  await db.runTransaction(async (tx) => {
    const employeeRef = db.doc(`tenants/${actor.tenantId}/employees/${data.employeeId}`);
    // --- Batch-read products and variant templates ---
    const uniqueProductIds = [...new Set(cleanedItems.map((i) => i.productId))];
    const uniqueTemplateIds = [...new Set(cleanedItems.map((i) => i.variantTemplateId))];

    const [employeeSnap, productSnaps, templateSnaps, promotionSnaps] = await Promise.all([
      tx.get(employeeRef),
      Promise.all(uniqueProductIds.map((id) => tx.get(db.doc(`tenants/${actor.tenantId}/products/${id}`)))),
      Promise.all(uniqueTemplateIds.map((id) => tx.get(db.doc(`tenants/${actor.tenantId}/variantTemplates/${id}`)))),
      tx.get(db.collection(`tenants/${actor.tenantId}/promotions`).where("active", "==", true)),
      tx.get(db.doc(`tenants/${actor.tenantId}/settings/promotionRules`))
    ]);
    if (!employeeSnap.exists || employeeSnap.data()?.["active"] === false) {
      throw new HttpsError("permission-denied", "Ο υπάλληλος δεν βρέθηκε ή είναι ανενεργός.");
    }

    const productMap = new Map(productSnaps.map((s) => [s.id, s.data()]));
    const templateMap = new Map(templateSnaps.map((s) => [s.id, s.data()]));

    for (const item of cleanedItems) {
      const product = productMap.get(item.productId);
      const template = templateMap.get(item.variantTemplateId);
      const assignment = product?.variantAssignments?.[item.variantTemplateId];
      if (!product || product.active === false || !template || template.active === false || !assignment) {
        throw new HttpsError("failed-precondition", "Προϊόν ή παραλλαγή μη διαθέσιμα. Ανανεώστε τον κατάλογο.");
      }
      if (item.useSpecialBottle && (!template.hasSpecialBottle || !template.specialBottleConsumableId)) {
        throw new HttpsError("failed-precondition", "Το ειδικό μπουκάλι δεν είναι διαθέσιμο.");
      }
      const basePrice = Number(assignment.sellingPrice ?? template.sellingPrice);
      const extraPrice = item.useSpecialBottle ? Number(template.specialBottleExtraPrice ?? 0) : 0;
      if (!Number.isFinite(basePrice) || basePrice < 0 || !Number.isFinite(extraPrice) || extraPrice < 0) {
        throw new HttpsError("failed-precondition", "Μη έγκυρη τιμή καταλόγου.");
      }
      const unitCents = Math.round((basePrice + extraPrice) * 100);
      if (!Number.isSafeInteger(unitCents)) {
        throw new HttpsError("failed-precondition", "Μη έγκυρη τιμή καταλόγου.");
      }
      const unitPrice = unitCents / 100;
      if (Math.round(item.unitPrice * 100) !== unitCents) {
        throw new HttpsError("failed-precondition",
          "Οι τιμές άλλαξαν. Ανανεώστε τον κατάλογο και ελέγξτε την παραγγελία.");
      }
      item.unitPrice = unitPrice;
    }
    if (!Number.isSafeInteger(cleanedItems.reduce((sum, item) =>
      sum + Math.round(item.unitPrice * 100) * item.quantity, 0))) {
      throw new HttpsError("invalid-argument", "Το σύνολο υπερβαίνει το επιτρεπόμενο όριο.");
    }
    const promotions = promotionSnaps.docs.map((snapshot) =>
      ({ ...snapshot.data(), id: snapshot.id } as Promotion));
    let pricing;
    try {
      pricing = calculatePromotions(cleanedItems, promotions);
    } catch {
      throw new HttpsError("failed-precondition",
        "Δεν ήταν δυνατός ο υπολογισμός προσφορών. Ανανεώστε τον κατάλογο.");
    }
    const promotionTotalCents = Math.round(pricing.total * 100);
    const manualCents = manualDiscount ?
      manualDiscountCents(promotionTotalCents, manualDiscount) : 0;
    const totalCents = promotionTotalCents - manualCents;
    if ((pricing.discountTotal > 0 && data.expectedTotal === undefined) ||
        (data.expectedTotal !== undefined &&
          Math.round(data.expectedTotal * 100) !== totalCents)) {
      throw new HttpsError("failed-precondition",
        "Το σύνολο ή οι προσφορές άλλαξαν. Ανανεώστε τον κατάλογο και ελέγξτε το τελικό ποσό.");
    }
    chargedTotal = totalCents / 100;

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
    const inventoryDeltas = new Map<string, number>();
    const addInventoryDelta = (docId: string, delta: number) => {
      inventoryDeltas.set(docId, (inventoryDeltas.get(docId) ?? 0) + delta);
    };

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
            addInventoryDelta(docId, -deduction);
          }
          if (essenceMl > 0) {
            const docId = inventoryDocId(item.productId, "essence");
            const deduction = item.quantity * essenceMl;
            addInventoryDelta(docId, -deduction);
          }

          if (Array.isArray(template?.recipeConsumables)) {
            for (const [rcIndex, rc] of template.recipeConsumables.entries()) {
              let cId = rc.consumableId;
              if (usesSpecialBottle(item.useSpecialBottle, template, rcIndex)) {
                cId = template.specialBottleConsumableId;
              }
              const cQty = Number(rc.quantity) || 1;
              const docId = inventoryDocId(cId, "consumable");
              const deduction = item.quantity * cQty;
              addInventoryDelta(docId, -deduction);
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
          addInventoryDelta(docId, -deduction);
        }
      } else {
        const deduction = item.quantity; // deduct units
        const docId = inventoryDocId(item.productId, item.variantTemplateId);
        addInventoryDelta(docId, -deduction);
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

    // Orders are never blocked by stock: inventory is deducted and may go negative.

    // --- Apply inventory updates ---
    for (const [docId, delta] of inventoryDeltas) {
      const snap = inventorySnapMap.get(docId);
      if (!snap) {
        throw new HttpsError("internal", "Δεν ήταν δυνατή η ανάγνωση του αποθέματος.");
      }
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
            for (const [rcIndex, rc] of template.recipeConsumables.entries()) {
              let cId = rc.consumableId;
              let isSpecialBottle = false;
              if (usesSpecialBottle(item.useSpecialBottle, template, rcIndex)) {
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
                reason: isSpecialBottle ?
                  `Πώληση Special Μπουκαλιού (${item.quantity} × ${cQty} τεμ.)` :
                  `Πώληση Αναλωσίμου (${item.quantity} × ${cQty} τεμ.)`,
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
    }

    // --- Create order document ---
    tx.set(orderRef, {
      tenantId: actor.tenantId,
      employeeId: data.employeeId || actor.uid,
      status: "COMPLETED",
      ...(data.paymentMethod ? { paymentMethod: data.paymentMethod } : {}),
      subtotal: pricing.subtotal,
      discountTotal: (Math.round(pricing.discountTotal * 100) + manualCents) / 100,
      total: chargedTotal,
      appliedPromotions: pricing.appliedPromotions,
      ...(manualDiscount ? { manualDiscount: { ...manualDiscount, amount: manualCents / 100 } } : {}),
      employeeName: employeeSnap.data()?.name ?? "",
      items: cleanedItems.map((item, index) => ({
        productId: item.productId,
        variantId: item.variantTemplateId,
        variantTemplateId: item.variantTemplateId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        useSpecialBottle: item.useSpecialBottle,
        discountTotal: pricing.lineDiscounts[index],
        lineTotal: (Math.round(item.unitPrice * 100) * item.quantity -
          Math.round(pricing.lineDiscounts[index] * 100)) / 100
      })),
      createdAt: now
    });
  });

  return { ok: true, orderId: orderRef.id, total: chargedTotal };
});

