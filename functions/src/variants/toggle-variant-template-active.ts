import {HttpsError, onCall} from "firebase-functions/v2/https";

import {assertRole, resolveActorContext} from "../common/auth";
import {db, serverTimestamp} from "../common/firestore";
import {ToggleVariantTemplateActiveInput} from "../types/domain";

export const toggleVariantTemplateActive = onCall(async (request) => {
  const data = request.data as ToggleVariantTemplateActiveInput;

  if (!data?.templateId) {
    throw new HttpsError("invalid-argument", "templateId is required.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const templateRef = db.doc(`tenants/${actor.tenantId}/variantTemplates/${data.templateId}`);
  await templateRef.update({active: Boolean(data.active), updatedAt: serverTimestamp()});

  return {ok: true};
});
