import { HttpsError, onCall } from "firebase-functions/v2/https";
import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { Promotion } from "./promotion-pricing";

export const savePromotion = onCall(async (request) => {
  const data = request.data as Partial<Promotion> & { tenantId: string; promotionId?: string };
  const actor = await resolveActorContext(request.auth, data?.tenantId);
  assertRole(actor, ["OWNER"]);
  const name = typeof data.name === "string" ? data.name.trim() : "";
  const kind = data.kind ?? "CHEAPEST";
  const giftId = kind === "GIFT_VARIANT" ? data.giftVariantTemplateId : null;
  const validRule = kind === "GIFT_VARIANT" ?
    Number.isInteger(data.groupSize) && Number(data.groupSize) >= 1 && Number(data.groupSize) <= 20 &&
    data.discountPercent === 100 && typeof giftId === "string" && !!giftId && !giftId.includes("/") &&
    Array.isArray(data.variantTemplateIds) && !data.variantTemplateIds.includes(giftId) : kind === "CHEAPEST" &&
    ((data.groupSize === 2 && data.discountPercent === 50) || (data.groupSize === 3 && data.discountPercent === 100));
  if (!name || name.length > 120 || !Array.isArray(data.variantTemplateIds) ||
      data.variantTemplateIds.length < 1 || data.variantTemplateIds.length > 100 ||
      data.variantTemplateIds.some((id) => typeof id !== "string" || !id || id.includes("/")) ||
      !validRule ||
      typeof data.repeat !== "boolean" || typeof data.active !== "boolean" ||
      (data.promotionId !== undefined && (typeof data.promotionId !== "string" ||
        !data.promotionId || data.promotionId.includes("/")))) {
    throw new HttpsError("invalid-argument", "Ελέγξτε όνομα, παραλλαγές και τύπο προσφοράς.");
  }
  for (const value of [data.startsAt, data.endsAt]) {
    if (value != null && (typeof value !== "string" || !Number.isFinite(Date.parse(value)))) {
      throw new HttpsError("invalid-argument", "Μη έγκυρη ημερομηνία προσφοράς.");
    }
  }
  const startsAt = data.startsAt ? new Date(data.startsAt).toISOString() : null;
  const endsAt = data.endsAt ? new Date(data.endsAt).toISOString() : null;
  if (startsAt && endsAt && startsAt >= endsAt) {
    throw new HttpsError("invalid-argument", "Η λήξη πρέπει να είναι μετά την έναρξη.");
  }
  const variantTemplateIds = [...new Set(data.variantTemplateIds)];
  const involvedIds = [...variantTemplateIds, ...(giftId ? [giftId] : [])];
  const collection = db.collection(`tenants/${actor.tenantId}/promotions`);
  const lockRef = db.doc(`tenants/${actor.tenantId}/settings/promotionRules`);
  const ref = data.promotionId ? collection.doc(data.promotionId) : collection.doc();
  await db.runTransaction(async (tx) => {
    const [existing, templates, lock] = await Promise.all([
      tx.get(ref),
      Promise.all(involvedIds.map((id) =>
        tx.get(db.doc(`tenants/${actor.tenantId}/variantTemplates/${id}`)))),
      tx.get(lockRef)
    ]);
    if (data.promotionId && !existing.exists) throw new HttpsError("not-found", "Η προσφορά δεν βρέθηκε.");
    if (data.active && templates.some((snapshot) => !snapshot.exists || snapshot.data()?.active === false)) {
      throw new HttpsError("failed-precondition", "Επιλέξτε ενεργές παραλλαγές για την προσφορά.");
    }
    // Serialize rule edits, including checkout and deletion.
    tx.set(lockRef, { revision: Number(lock.data()?.revision ?? 0) + 1, updatedAt: serverTimestamp() });
    tx.set(ref, {
      tenantId: actor.tenantId, name, variantTemplateIds, kind, giftVariantTemplateId: giftId,
      groupSize: data.groupSize, discountPercent: data.discountPercent,
      repeat: data.repeat, active: data.active, startsAt, endsAt,
      ...(existing.exists ? {} : { createdAt: serverTimestamp() }),
      updatedAt: serverTimestamp(), updatedBy: actor.uid
    }, { merge: true });
  });
  return { promotionId: ref.id };
});
