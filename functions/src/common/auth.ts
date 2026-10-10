import { HttpsError } from "firebase-functions/v2/https";

import { db } from "./firestore";
import { ActorContext, AppUserRole } from "../types/domain";

function isEmulator(): boolean {
  return process.env.FUNCTIONS_EMULATOR === "true";
}

export function validateTenantScope(tenantId: string): void {
  if (!tenantId || tenantId.trim().length === 0) {
    throw new HttpsError("invalid-argument", "tenantId is required.");
  }
}

export async function resolveActorContext(
  auth: { uid?: string } | null | undefined,
  requestedTenantId: string
): Promise<ActorContext> {
  validateTenantScope(requestedTenantId);

  if (!auth?.uid) {
    if (isEmulator()) {
      return {
        uid: "emulator-user",
        tenantId: requestedTenantId,
        role: "OWNER"
      };
    }

    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const userRef = db.doc(`users/${auth.uid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("permission-denied", "User profile not found.");
  }

  const userData = userSnap.data() as { tenantId?: string; role?: string; active?: boolean } | undefined;
  const tenantId = userData?.tenantId;
  const role = userData?.role;

  if (!tenantId) {
    throw new HttpsError("permission-denied", "User tenant not configured.");
  }
  if (tenantId !== requestedTenantId) {
    throw new HttpsError("permission-denied", "Cross-tenant access denied.");
  }
  if (role !== "OWNER" && role !== "EMPLOYEE") {
    throw new HttpsError("permission-denied", "Invalid user role.");
  }
  if (userData?.active === false) {
    throw new HttpsError("permission-denied", "User account is disabled.");
  }

  return {
    uid: auth.uid,
    tenantId,
    role
  };
}

export function assertRole(actor: ActorContext, allowedRoles: AppUserRole[]): void {
  if (!allowedRoles.includes(actor.role)) {
    throw new HttpsError("permission-denied", "Insufficient permissions.");
  }
}
