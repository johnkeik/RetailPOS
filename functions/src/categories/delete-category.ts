import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db } from "../common/firestore";
import { DeleteCategoryInput } from "../types/domain";

export const deleteCategory = onCall(async (request) => {
  const data = request.data as DeleteCategoryInput;

  if (!data?.categoryId) {
    throw new HttpsError("invalid-argument", "categoryId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  // Check if any products use this category
  const productsSnap = await db
    .collection(`tenants/${actor.tenantId}/products`)
    .where("categoryId", "==", data.categoryId)
    .limit(1)
    .get();

  if (!productsSnap.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Η κατηγορία χρησιμοποιείται σε προϊόντα. Αλλάξτε πρώτα την κατηγορία στα προϊόντα ή διαγράψτε τα."
    );
  }

  const categoryRef = db.doc(`tenants/${actor.tenantId}/categories/${data.categoryId}`);
  await categoryRef.delete();

  return { ok: true };
});
