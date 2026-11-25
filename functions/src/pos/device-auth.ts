import {randomBytes, createHash, timingSafeEqual} from "crypto";
import {getAuth} from "firebase-admin/auth";
import {HttpsError, onCall} from "firebase-functions/v2/https";
import {assertRole, resolveActorContext, validateTenantScope} from "../common/auth";
import {db, serverTimestamp} from "../common/firestore";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const randomId = () => randomBytes(24).toString("hex");

function tenant(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new HttpsError("invalid-argument", "Invalid shop.");
  }
  return value;
}

function deviceRef(tenantId: string, uid: string) {
  if (!/^pos_[a-f0-9]{48}$/.test(uid)) throw new HttpsError("permission-denied", "Invalid device.");
  return db.doc(`tenants/${tenantId}/devices/${uid}`);
}

export const activatePosDevice = onCall(async (request) => {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Manager sign-in required.");
  const profile = (await db.doc(`users/${request.auth.uid}`).get()).data();
  const tenantId = tenant(profile?.tenantId);
  const actor = await resolveActorContext(request.auth, tenantId);
  assertRole(actor, ["OWNER"]);
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Manager sign-in required.");
  const authTime = Number(request.auth.token.auth_time);
  if (!Number.isFinite(authTime) || Date.now() / 1000 - authTime > 300) {
    throw new HttpsError("unauthenticated", "Sign in again to activate this PC.");
  }
  const deviceId = `pos_${randomId()}`;
  const secret = randomBytes(32).toString("hex");
  await deviceRef(tenantId, deviceId).set({
    tenantId, active: true, secretHash: hash(secret),
    name: String(request.data?.name || "Shop PC").slice(0, 80),
    activatedBy: actor.uid, activatedAt: serverTimestamp(), lastSeenAt: serverTimestamp()
  });
  const token = await getAuth().createCustomToken(deviceId, {posDevice: true, tenantId});
  return {tenantId, deviceId, secret, token};
});

// A high-entropy device credential is held in OS-protected storage, never in Firestore as plaintext.
// Resuming always clears the previous employee session, including after a PC restart.
export const resumePosDevice = onCall(async (request) => {
  const tenantId = tenant(request.data?.tenantId);
  const uid = String(request.data?.deviceId || "");
  const secret = request.data?.secret;
  if (typeof secret !== "string" || !/^[a-f0-9]{64}$/.test(secret)) {
    throw new HttpsError("unauthenticated", "Activation required.");
  }
  const ref = deviceRef(tenantId, uid);
  await db.runTransaction(async (tx) => {
    const data = (await tx.get(ref)).data();
    const stored = String(data?.secretHash || "");
    if (!data?.active || data.tenantId !== tenantId || stored.length !== 64 ||
      !timingSafeEqual(Buffer.from(stored), Buffer.from(hash(secret)))) {
      throw new HttpsError("permission-denied", "Device revoked or activation invalid.");
    }
    tx.update(ref, {employeeId: null, sessionId: null, lastSeenAt: serverTimestamp()});
  });
  return {tenantId, token: await getAuth().createCustomToken(uid, {posDevice: true, tenantId})};
});

export const startPosEmployeeSession = onCall(async (request) => {
  const tenantId = tenant(request.data?.tenantId);
  const uid = request.auth?.uid;
  if (!uid || request.auth?.token.posDevice !== true || request.auth.token.tenantId !== tenantId) {
    throw new HttpsError("unauthenticated", "Activate this PC first.");
  }
  const code = request.data?.code;
  if (typeof code !== "string" || !/^\d{1,12}$/.test(code)) {
    throw new HttpsError("invalid-argument", "Enter a numeric employee code.");
  }
  const ref = deviceRef(tenantId, uid);
  const attemptId = randomId();
  await db.runTransaction(async (tx) => {
    const device = (await tx.get(ref)).data();
    if (!device?.active || device.tenantId !== tenantId) {
      throw new HttpsError("permission-denied", "Device revoked.");
    }
    const now = Date.now();
    const inWindow = now - Number(device.attemptWindow || 0) < 15 * 60 * 1000;
    const attempts = inWindow ? Number(device.attempts || 0) : 0;
    if (attempts >= 10) throw new HttpsError("resource-exhausted", "Try again in 15 minutes.");
    tx.update(ref, {
      attempts: attempts + 1, attemptWindow: inWindow ? device.attemptWindow : now,
      attemptId, employeeId: null, sessionId: null
    });
  });
  const matches = await db.collection(`tenants/${tenantId}/employees`)
    .where("employeeCode", "==", code).get();
  const employees = matches.docs.filter((doc) => doc.data().active === true);
  if (employees.length !== 1) throw new HttpsError("permission-denied", "Invalid employee code.");
  const employee = employees[0];
  const sessionId = randomId();
  await db.runTransaction(async (tx) => {
    const device = (await tx.get(ref)).data();
    if (!device?.active || device.attemptId !== attemptId) {
      throw new HttpsError("permission-denied", "Session changed. Try again.");
    }
    tx.update(ref, {employeeId: employee.id, sessionId, lastSeenAt: serverTimestamp()});
  });
  const token = await getAuth().createCustomToken(uid, {
    posDevice: true, tenantId, employeeId: employee.id, sessionId
  });
  return {token, employeeId: employee.id, employeeName: employee.data().name || "Employee"};
});

export async function resolvePosActor(
  auth: {uid?: string; token?: Record<string, unknown>} | null | undefined,
  tenantId: string,
  employeeId: string
) {
  validateTenantScope(tenantId);
  tenant(tenantId);
  if (typeof employeeId !== "string" || !employeeId || employeeId.includes("/") || employeeId.length > 128) {
    throw new HttpsError("invalid-argument", "Invalid employee.");
  }
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Authentication required.");
  if (auth.token?.posDevice !== true) {
    const actor = await resolveActorContext(auth, tenantId);
    assertRole(actor, ["OWNER"]);
    return actor;
  }
  if (auth.token.tenantId !== tenantId || auth.token.employeeId !== employeeId) {
    throw new HttpsError("permission-denied", "Employee or shop mismatch.");
  }
  const device = (await deviceRef(tenantId, auth.uid).get()).data();
  const employee = (await db.doc(`tenants/${tenantId}/employees/${employeeId}`).get()).data();
  if (!device?.active || device.tenantId !== tenantId || device.employeeId !== employeeId ||
    !device.sessionId || device.sessionId !== auth.token.sessionId || employee?.active !== true) {
    throw new HttpsError("permission-denied", "Device or employee session is no longer active.");
  }
  return {uid: auth.uid, tenantId, role: "EMPLOYEE" as const, employeeId};
}
