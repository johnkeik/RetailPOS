import { Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { SeedMockOrdersInput } from "../types/domain";

export const seedMockOrders = onCall(async (request) => {
  if (process.env.FUNCTIONS_EMULATOR !== "true") {
    throw new HttpsError("permission-denied", "Η δημιουργία δοκιμαστικών πωλήσεων είναι διαθέσιμη μόνο στον emulator.");
  }

  const data = request.data as SeedMockOrdersInput;
  if (!Array.isArray(data?.orders) || data.orders.length === 0 || data.orders.length > 100) {
    throw new HttpsError("invalid-argument", "Η λίστα δοκιμαστικών παραγγελιών δεν είναι έγκυρη.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  for (const order of data.orders) {
    if (
      !order.employeeId ||
      !Array.isArray(order.items) ||
      order.items.length === 0 ||
      !Number.isFinite(order.total) ||
      !Number.isFinite(Date.parse(order.createdAt)) ||
      order.items.some((item) => !item.productId || !item.variantTemplateId || item.quantity <= 0)
    ) {
      throw new HttpsError("invalid-argument", "Μία δοκιμαστική παραγγελία έχει μη έγκυρα στοιχεία.");
    }
  }

  const ordersRef = db.collection(`tenants/${actor.tenantId}/orders`);
  await db.runTransaction(async (tx) => {
    const existing = await tx.get(ordersRef.limit(1));
    if (!existing.empty) {
      throw new HttpsError("already-exists", "Το ιστορικό πωλήσεων έχει ήδη δεδομένα.");
    }

    const seededAt = serverTimestamp();
    for (const order of data.orders) {
      const orderRef = ordersRef.doc();
      tx.create(orderRef, {
        tenantId: actor.tenantId,
        employeeId: order.employeeId,
        status: "COMPLETED",
        subtotal: order.subtotal,
        discountTotal: order.discountTotal,
        total: order.total,
        items: order.items,
        createdAt: Timestamp.fromDate(new Date(order.createdAt)),
        seededAt
      });
    }
  });

  return { ok: true, count: data.orders.length };
});