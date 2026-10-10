import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertManagerPin } from "../common/manager-pin";
import { assertRole, resolveActorContext, validateTenantScope } from "../common/auth";
import { db, inventoryDocId, serverTimestamp } from "../common/firestore";
import { CancelOrderInput } from "../types/domain";

type SaleMovement = {
  id: string;
  productId: string;
  variantId: string;
  quantityDelta: number;
  isBulkVolume?: boolean;
};

export const cancelOrder = onCall(async (request) => {
  const data = request.data as CancelOrderInput;
  if (!data?.orderId || !data.employeeId || !/^\d{6}$/.test(data.managerPin ?? "")) {
    throw new HttpsError("invalid-argument", "Λείπουν στοιχεία ακύρωσης ή ο κωδικός manager δεν είναι έγκυρος.");
  }
  const reason = (data.reason ?? "").trim();
  if (!reason || reason.length > 200) {
    throw new HttpsError("invalid-argument", "Συμπληρώστε αιτία ακύρωσης έως 200 χαρακτήρες.");
  }

  validateTenantScope(data.tenantId);
  const actor = request.auth?.uid
    ? await resolveActorContext(request.auth, data.tenantId)
    : { uid: `pos:${data.employeeId}`, tenantId: data.tenantId, role: "EMPLOYEE" as const };
  assertRole(actor, ["OWNER", "EMPLOYEE"]);
  const tenantId = actor.tenantId;
  await assertManagerPin(tenantId, data.managerPin);

  const orderRef = db.doc(`tenants/${tenantId}/orders/${data.orderId}`);
  const employeeRef = db.doc(`tenants/${tenantId}/employees/${data.employeeId}`);
  const movementQuery = db.collection(`tenants/${tenantId}/stockMovements`)
    .where("orderId", "==", data.orderId);

  await db.runTransaction(async (tx) => {
    const [orderSnapshot, employeeSnapshot] = await Promise.all([
      tx.get(orderRef),
      tx.get(employeeRef)
    ]);
    if (!orderSnapshot.exists) {
      throw new HttpsError("not-found", "Η παραγγελία δεν βρέθηκε.");
    }
    if (!employeeSnapshot.exists || employeeSnapshot.data()?.["active"] === false) {
      throw new HttpsError("permission-denied", "Ο υπάλληλος δεν είναι ενεργός στο κατάστημα.");
    }

    const order = orderSnapshot.data() as { status?: string };
    if (order.status !== "COMPLETED") {
      throw new HttpsError("failed-precondition", "Η παραγγελία δεν είναι ολοκληρωμένη ή έχει ήδη ακυρωθεί.");
    }

    const movementSnapshot = await tx.get(movementQuery);
    const saleDocuments = movementSnapshot.docs.filter(
      (document) => document.data()["type"] === "SALE"
    );
    if (saleDocuments.length === 0) {
      throw new HttpsError("failed-precondition", "Δεν βρέθηκαν κινήσεις αποθέματος για την παραγγελία.");
    }
    if (saleDocuments.length > 240) {
      throw new HttpsError("resource-exhausted", "Η παραγγελία έχει πολλές κινήσεις για ασφαλή ακύρωση.");
    }

    const movements: SaleMovement[] = saleDocuments.map((document) => {
      const movement = document.data();
      if (!movement["productId"] || !movement["variantId"] || Number(movement["quantityDelta"]) >= 0) {
        throw new HttpsError("failed-precondition", "Βρέθηκε μη έγκυρη κίνηση πώλησης.");
      }
      return {
        id: document.id,
        productId: movement["productId"] as string,
        variantId: movement["variantId"] as string,
        quantityDelta: Number(movement["quantityDelta"]),
        isBulkVolume: movement["isBulkVolume"] === true
      };
    });

    const inventoryDeltas = new Map<string, { productId: string; variantId: string; quantity: number }>();
    for (const movement of movements) {
      const inventoryId = inventoryDocId(movement.productId, movement.variantId);
      const entry = inventoryDeltas.get(inventoryId) ?? {
        productId: movement.productId,
        variantId: movement.variantId,
        quantity: 0
      };
      entry.quantity -= movement.quantityDelta;
      inventoryDeltas.set(inventoryId, entry);
    }

    const inventorySnapshots = new Map<string, FirebaseFirestore.DocumentSnapshot>();
    await Promise.all([...inventoryDeltas.keys()].map(async (inventoryId) => {
      inventorySnapshots.set(
        inventoryId,
        await tx.get(db.doc(`tenants/${tenantId}/inventory/${inventoryId}`))
      );
    }));

    const now = serverTimestamp();
    for (const [inventoryId, delta] of inventoryDeltas) {
      const snapshot = inventorySnapshots.get(inventoryId)!;
      const current = snapshot.exists ? Number(snapshot.data()?.["quantity"] ?? 0) : 0;
      tx.set(db.doc(`tenants/${tenantId}/inventory/${inventoryId}`), {
        tenantId,
        productId: delta.productId,
        variantId: delta.variantId,
        variantTemplateId: delta.variantId,
        quantity: current + delta.quantity,
        updatedAt: now
      }, { merge: true });
    }

    for (const movement of movements) {
      const returnRef = db.collection(`tenants/${tenantId}/stockMovements`).doc();
      tx.set(returnRef, {
        tenantId,
        productId: movement.productId,
        variantId: movement.variantId,
        variantTemplateId: movement.variantId,
        type: "RETURN",
        quantityDelta: -movement.quantityDelta,
        isBulkVolume: movement.isBulkVolume,
        orderId: data.orderId,
        reversesMovementId: movement.id,
        reason: `Ακύρωση παραγγελίας: ${reason}`,
        performedByEmployeeId: data.employeeId,
        approvedByUserId: actor.uid,
        approvedBy: "MANAGER_PIN",
        createdAt: now
      });
    }

    tx.update(orderRef, {
      status: "CANCELLED",
      cancelledAt: now,
      cancelledByEmployeeId: data.employeeId,
      cancellationApprovedBy: actor.uid,
      cancellationReason: reason
    });
  });

  return { ok: true };
});