import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db } from "../common/firestore";
import { DeleteProductInput } from "../types/domain";

export const deleteProduct = onCall(async (request) => {
  const data = request.data as DeleteProductInput;

  if (!data?.productId) {
    throw new HttpsError("invalid-argument", "productId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  // Safety check: ensure no orders contain this product
  const ordersSnap = await db
    .collection(`tenants/${actor.tenantId}/orders`)
    .limit(50)
    .get();

  for (const doc of ordersSnap.docs) {
    const orderData = doc.data();
    const items = Array.isArray(orderData.items) ? orderData.items : [];
    if (items.some((it: { productId?: string }) => it.productId === data.productId)) {
      throw new HttpsError(
        "failed-precondition",
        "Το προϊόν δεν μπορεί να διαγραφεί οριστικά επειδή έχει καταγεγραμμένες πωλήσεις. Χρησιμοποιήστε την απενεργοποίηση."
      );
    }
  }

  // Delete product document
  const productRef = db.doc(`tenants/${actor.tenantId}/products/${data.productId}`);
  await productRef.delete();

  // Also clean up any zero-balance inventory entries for this product
  const inventorySnap = await db
    .collection(`tenants/${actor.tenantId}/inventory`)
    .where("productId", "==", data.productId)
    .get();

  const batch = db.batch();
  for (const doc of inventorySnap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  return { ok: true };
});
