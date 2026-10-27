import { HttpsError, onCall } from "firebase-functions/v2/https";
import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";

export const deletePromotion = onCall(async (request) => {
  const data = request.data as { tenantId: string; promotionId?: string };
  const actor = await resolveActorContext(request.auth, data?.tenantId);
  assertRole(actor, ["OWNER"]);
  const id = data?.promotionId;
  if (typeof id !== "string" || !id || id.includes("/")) {
    throw new HttpsError("invalid-argument", "Μη έγκυρη προσφορά.");
  }
  const ref = db.doc(`tenants/${actor.tenantId}/promotions/${id}`);
  const lockRef = db.doc(`tenants/${actor.tenantId}/settings/promotionRules`);
  await db.runTransaction(async (tx) => {
    const [existing, lock] = await Promise.all([tx.get(ref), tx.get(lockRef)]);
    if (!existing.exists) throw new HttpsError("not-found", "Η προσφορά δεν βρέθηκε.");
    // Serialize deletion with checkout and edits. Historical order snapshots remain intact.
    tx.set(lockRef, { revision: Number(lock.data()?.revision ?? 0) + 1, updatedAt: serverTimestamp() });
    tx.delete(ref);
  });
  return { ok: true };
});
