import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db } from "../common/firestore";
import { DeleteBrandInput } from "../types/domain";

export const deleteBrand = onCall(async (request) => {
  const data = request.data as DeleteBrandInput;

  if (!data?.brandId) {
    throw new HttpsError("invalid-argument", "brandId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  // Check if any products use this brand
  const productsSnap = await db
    .collection(`tenants/${actor.tenantId}/products`)
    .where("brandId", "==", data.brandId)
    .limit(1)
    .get();

  if (!productsSnap.empty) {
    throw new HttpsError(
      "failed-precondition",
      "Η μάρκα χρησιμοποιείται σε προϊόντα. Αλλάξτε πρώτα τη μάρκα στα προϊόντα ή διαγράψτε τα."
    );
  }

  const brandRef = db.doc(`tenants/${actor.tenantId}/brands/${data.brandId}`);
  await brandRef.delete();

  return { ok: true };
});
