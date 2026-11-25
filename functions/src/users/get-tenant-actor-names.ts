import {getAuth} from "firebase-admin/auth";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {assertRole, resolveActorContext} from "../common/auth";
import {db} from "../common/firestore";

// Auth profiles cannot be read directly from the browser. Resolve only members of this shop.
export const getTenantActorNames = onCall(async (request) => {
  const actor = await resolveActorContext(request.auth, request.data?.tenantId);
  assertRole(actor, ["OWNER"]);
  const ids = request.data?.actorIds;
  if (!Array.isArray(ids) || ids.length > 100 || ids.some((id) =>
    typeof id !== "string" || !id || id.length > 128 || id.includes("/"))) {
    throw new HttpsError("invalid-argument", "Provide up to 100 valid actor IDs.");
  }
  const uniqueIds = [...new Set<string>(ids)];
  if (!uniqueIds.length) return {names: {}};
  const profiles = await db.getAll(...uniqueIds.map((id) => db.doc(`users/${id}`)));
  const names: Record<string, string> = {};
  const members = profiles.filter((profile) => profile.exists && profile.data()?.tenantId === actor.tenantId);
  if (!members.length) return {names};
  const accounts = await getAuth().getUsers(members.map((profile) => ({uid: profile.id})));
  for (const profile of members) {
    const account = accounts.users.find((user) => user.uid === profile.id);
    const name = String(account?.displayName || profile.data()?.name || "").trim();
    // An account without a configured name still gets a readable label, never its UID.
    names[profile.id] = name || account?.email ||
      (profile.data()?.role === "OWNER" ? "Διαχειριστής" : "Υπάλληλος");
  }
  return {names};
});
