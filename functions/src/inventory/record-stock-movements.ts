import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, inventoryDocId, serverTimestamp } from "../common/firestore";
import { RecordStockMovementsInput } from "../types/domain";

const MAX_LINES = 50;
const MOVEMENT_TYPES = ["PURCHASE", "ADJUSTMENT", "LOSS"];
const BULK_COMPONENTS = ["perfume", "essence"];

// Recipes can deduct fractional ml, so volume lines must be able to zero out such stock.
const roundQuantity = (value: number): number => Math.round(value * 1000) / 1000;

export const recordStockMovements = onCall(async (request) => {
  const data = request.data as RecordStockMovementsInput;

  if (!data || !MOVEMENT_TYPES.includes(data.type)) {
    throw new HttpsError("invalid-argument", "type must be PURCHASE, ADJUSTMENT or LOSS.");
  }
  if (!Array.isArray(data.lines) || data.lines.length === 0 || data.lines.length > MAX_LINES) {
    throw new HttpsError("invalid-argument", `lines must contain 1-${MAX_LINES} items.`);
  }

  const reason = data.reason?.trim() || null;
  if (data.type !== "PURCHASE" && !reason) {
    throw new HttpsError("invalid-argument", "reason is required for ADJUSTMENT and LOSS.");
  }

  const lines = data.lines.map((line) => {
    const quantity = Number(line?.quantity);
    const isVolume = BULK_COMPONENTS.includes(line?.variantTemplateId);
    const valid =
      line?.productId &&
      line?.variantTemplateId &&
      Number.isFinite(quantity) &&
      (isVolume || Number.isInteger(quantity)) &&
      quantity !== 0 &&
      (data.type === "ADJUSTMENT" || quantity > 0);
    if (!valid) {
      throw new HttpsError(
        "invalid-argument",
        "Each line needs productId, variantTemplateId and a non-zero quantity (whole units, except perfume/essence in ml)."
      );
    }
    return {
      productId: line.productId,
      variantTemplateId: line.variantTemplateId,
      quantityDelta: data.type === "LOSS" ? -quantity : quantity
    };
  });

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const tenantPath = `tenants/${actor.tenantId}`;
  const performedBy = data.performedByEmployeeId ?? actor.uid;
  const now = serverTimestamp();

  await db.runTransaction(async (tx) => {
    // Each line must reference an existing item of this tenant.
    const parentRefs = new Map<string, FirebaseFirestore.DocumentReference>();
    for (const line of lines) {
      const collectionName = line.variantTemplateId === "consumable" ? "consumables" : "products";
      const ref = db.doc(`${tenantPath}/${collectionName}/${line.productId}`);
      parentRefs.set(ref.path, ref);
    }
    const parentSnaps = new Map(
      (await tx.getAll(...parentRefs.values())).map((snap) => [snap.ref.path, snap])
    );

    for (const line of lines) {
      const isConsumable = line.variantTemplateId === "consumable";
      const parent = parentSnaps.get(
        `${tenantPath}/${isConsumable ? "consumables" : "products"}/${line.productId}`
      );
      const parentData = parent?.data();
      if (!parent?.exists || !parentData) {
        throw new HttpsError("not-found", `Item ${line.productId} was not found.`);
      }
      if (isConsumable) continue;

      const valid = BULK_COMPONENTS.includes(line.variantTemplateId)
        ? parentData.packagingCategory === "BULK"
        : Object.prototype.hasOwnProperty.call(
            parentData.variantAssignments ?? {},
            line.variantTemplateId
          );
      if (!valid) {
        throw new HttpsError(
          "failed-precondition",
          `Variant ${line.variantTemplateId} is not available for product ${line.productId}.`
        );
      }
    }

    const inventoryRefs = new Map<string, FirebaseFirestore.DocumentReference>();
    for (const line of lines) {
      const docId = inventoryDocId(line.productId, line.variantTemplateId);
      inventoryRefs.set(docId, db.doc(`${tenantPath}/inventory/${docId}`));
    }
    const quantities = new Map<string, number>();
    const inventorySnaps = await tx.getAll(...inventoryRefs.values());
    for (const snap of inventorySnaps) {
      quantities.set(snap.id, snap.exists ? Number(snap.data()?.quantity ?? 0) : 0);
    }

    // Lines may hit the same inventory row, so apply them in order against a running quantity.
    for (const line of lines) {
      const docId = inventoryDocId(line.productId, line.variantTemplateId);
      const next = roundQuantity((quantities.get(docId) ?? 0) + line.quantityDelta);
      if (next < 0) {
        throw new HttpsError("failed-precondition", "Insufficient stock.");
      }
      quantities.set(docId, next);

      tx.set(db.collection(`${tenantPath}/stockMovements`).doc(), {
        tenantId: actor.tenantId,
        productId: line.productId,
        variantId: line.variantTemplateId,
        variantTemplateId: line.variantTemplateId,
        type: data.type,
        quantityDelta: line.quantityDelta,
        reason,
        orderId: null,
        performedByEmployeeId: performedBy,
        createdAt: now
      });
    }

    for (const [docId, ref] of inventoryRefs) {
      const [productId, variantTemplateId] = docId.split("__");
      tx.set(
        ref,
        {
          tenantId: actor.tenantId,
          productId,
          variantId: variantTemplateId,
          variantTemplateId,
          quantity: quantities.get(docId),
          updatedAt: now
        },
        { merge: true }
      );
    }
  });

  return { ok: true, movementCount: lines.length };
});
