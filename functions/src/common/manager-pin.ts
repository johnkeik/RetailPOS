import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { HttpsError } from "firebase-functions/v2/https";

import { db } from "./firestore";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

export function managerPinRef(tenantId: string) {
  return db.doc(`tenants/${tenantId}/private/security`);
}

export function hashManagerPin(pin: string, salt: string): string {
  return scryptSync(pin, salt, 64).toString("hex");
}

export function newManagerPinSalt(): string {
  return randomBytes(16).toString("hex");
}

export async function assertManagerPin(tenantId: string, pin: string): Promise<void> {
  const ref = managerPinRef(tenantId);
  const result = await db.runTransaction(async (tx) => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) return "not-configured" as const;

    const data = snapshot.data()!;
    const lockedUntil = data["lockedUntil"];
    if (lockedUntil instanceof Timestamp && lockedUntil.toMillis() > Date.now()) {
      return "locked" as const;
    }
    const lockoutExpired = lockedUntil instanceof Timestamp;

    const salt = data["pinSalt"] as string | undefined;
    const storedHash = data["pinHash"] as string | undefined;
    if (!salt || !storedHash) return "not-configured" as const;

    const expected = Buffer.from(storedHash, "hex");
    const actual = Buffer.from(hashManagerPin(pin, salt), "hex");
    const valid = expected.length === actual.length && timingSafeEqual(expected, actual);
    if (valid) {
      tx.update(ref, { failedAttempts: 0, lockedUntil: null });
      return "valid" as const;
    }

    const failedAttempts = (lockoutExpired ? 0 : Number(data["failedAttempts"] ?? 0)) + 1;
    tx.update(ref, {
      failedAttempts,
      lockedUntil: failedAttempts >= MAX_FAILED_ATTEMPTS
        ? Timestamp.fromMillis(Date.now() + LOCKOUT_MS)
        : null
    });
    return failedAttempts >= MAX_FAILED_ATTEMPTS ? "locked" as const : "invalid" as const;
  });

  if (result === "not-configured") {
    throw new HttpsError("failed-precondition", "Ο κωδικός manager δεν έχει οριστεί.");
  }
  if (result === "locked") {
    throw new HttpsError("resource-exhausted", "Πολλές λανθασμένες προσπάθειες. Δοκιμάστε ξανά σε 15 λεπτά.");
  }
  if (result === "invalid") {
    throw new HttpsError("permission-denied", "Ο κωδικός manager δεν είναι σωστός.");
  }
}