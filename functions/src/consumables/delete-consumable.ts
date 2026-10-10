import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db } from "../common/firestore";
import { DeleteConsumableInput } from "../types/domain";

export const deleteConsumable = onCall(async (request) => {
  const data = request.data as DeleteConsumableInput;

  if (!data?.consumableId) {
    throw new HttpsError("invalid-argument", "consumableId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  // Safety check 1: ensure no variant templates use this consumable in recipe or special bottle
  const templatesSnap = await db
    .collection(`tenants/${actor.tenantId}/variantTemplates`)
    .get();

  for (const doc of templatesSnap.docs) {
    const tData = doc.data();
    const recipeConsumables = Array.isArray(tData.recipeConsumables)
      ? tData.recipeConsumables
      : [];
    const isUsedInRecipe = recipeConsumables.some(
      (rc: { consumableId?: string }) => rc.consumableId === data.consumableId
    );
    const isUsedAsSpecial = tData.specialBottleConsumableId === data.consumableId;

    if (isUsedInRecipe || isUsedAsSpecial) {
      throw new HttpsError(
        "failed-precondition",
        `Το αναλώσιμο χρησιμοποιείται στην παραλλαγή "${tData.name}". Αφαιρέστε το πρώτα από τη συνταγή της παραλλαγής.`
      );
    }
  }

  // Safety check 2: ensure no orders have recorded sales of this consumable
  const ordersSnap = await db
    .collection(`tenants/${actor.tenantId}/orders`)
    .limit(50)
    .get();

  for (const doc of ordersSnap.docs) {
    const orderData = doc.data();
    const items = Array.isArray(orderData.items) ? orderData.items : [];
    if (items.some((it: { productId?: string }) => it.productId === data.consumableId)) {
      throw new HttpsError(
        "failed-precondition",
        "Το αναλώσιμο έχει καταγεγραμμένες πωλήσεις στο ιστορικό. Χρησιμοποιήστε την απενεργοποίηση."
      );
    }
  }

  // Delete consumable document
  const consumableRef = db.doc(`tenants/${actor.tenantId}/consumables/${data.consumableId}`);
  await consumableRef.delete();

  // Clean up any inventory entry for this consumable
  const inventorySnap = await db
    .collection(`tenants/${actor.tenantId}/inventory`)
    .where("productId", "==", data.consumableId)
    .get();

  const batch = db.batch();
  for (const doc of inventorySnap.docs) {
    batch.delete(doc.ref);
  }
  await batch.commit();

  return { ok: true };
});
