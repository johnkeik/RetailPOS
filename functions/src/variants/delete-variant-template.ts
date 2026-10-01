import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db } from "../common/firestore";
import { DeleteVariantTemplateInput } from "../types/domain";

export const deleteVariantTemplate = onCall(async (request) => {
  const data = request.data as DeleteVariantTemplateInput;

  if (!data?.templateId) {
    throw new HttpsError("invalid-argument", "templateId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  // Safety check 1: ensure no products are actively assigned to this template
  const productsSnap = await db
    .collection(`tenants/${actor.tenantId}/products`)
    .get();

  for (const doc of productsSnap.docs) {
    const pData = doc.data();
    const assignments = pData.variantAssignments ?? {};
    if (data.templateId in assignments) {
      throw new HttpsError(
        "failed-precondition",
        `Η παραλλαγή είναι συνδεδεμένη με το προϊόν "${pData.name}". Αφαιρέστε πρώτα την ανάθεση από το προϊόν.`
      );
    }
  }

  // Safety check 2: ensure no orders contain this variant template
  const ordersSnap = await db
    .collection(`tenants/${actor.tenantId}/orders`)
    .limit(50)
    .get();

  for (const doc of ordersSnap.docs) {
    const orderData = doc.data();
    const items = Array.isArray(orderData.items) ? orderData.items : [];
    if (items.some((it: { variantTemplateId?: string; variantId?: string }) =>
      it.variantTemplateId === data.templateId || it.variantId === data.templateId
    )) {
      throw new HttpsError(
        "failed-precondition",
        "Η παραλλαγή δεν μπορεί να διαγραφεί οριστικά επειδή έχει καταγεγραμμένες πωλήσεις. Χρησιμοποιήστε την απενεργοποίηση."
      );
    }
  }

  // Delete template
  const templateRef = db.doc(`tenants/${actor.tenantId}/variantTemplates/${data.templateId}`);
  await templateRef.delete();

  return { ok: true };
});
