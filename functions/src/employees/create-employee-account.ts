import { getAuth } from "firebase-admin/auth";
import { HttpsError, onCall } from "firebase-functions/v2/https";

import { assertRole, resolveActorContext } from "../common/auth";
import { db, serverTimestamp } from "../common/firestore";
import { CreateEmployeeAccountInput } from "../types/domain";

export const createEmployeeAccount = onCall(async (request) => {
  const data = request.data as CreateEmployeeAccountInput;
  const email = typeof data?.email === "string" ? data.email.trim().toLowerCase() : "";
  if (typeof data?.employeeId !== "string" || !data.employeeId || data.employeeId.includes("/") ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Συμπληρώστε έγκυρο email υπαλλήλου.");
  }

  const actor = await resolveActorContext(request.auth, data.tenantId);
  assertRole(actor, ["OWNER"]);

  const employeeRef = db.doc(`tenants/${actor.tenantId}/employees/${data.employeeId}`);
  const employeeSnapshot = await employeeRef.get();
  if (!employeeSnapshot.exists) {
    throw new HttpsError("not-found", "Ο υπάλληλος δεν βρέθηκε.");
  }

  const employee = employeeSnapshot.data();
  if (!employee) {
    throw new HttpsError("not-found", "Ο υπάλληλος δεν βρέθηκε.");
  }
  const accountRef = db.doc(`tenants/${actor.tenantId}/employeeAccounts/${data.employeeId}`);
  if ((await accountRef.get()).exists) {
    throw new HttpsError("already-exists", "Ο υπάλληλος έχει ήδη λογαριασμό dashboard.");
  }
  if (employee["active"] === false) {
    throw new HttpsError("failed-precondition", "Ενεργοποιήστε τον υπάλληλο πριν δημιουργήσετε πρόσβαση.");
  }

  let account;
  try {
    account = await getAuth().createUser({
      email,
      displayName: String(employee["name"] ?? ""),
      disabled: employee["active"] === false
    });
  } catch (error) {
    if ((error as { code?: string })?.code === "auth/email-already-exists") {
      throw new HttpsError("already-exists", "Το email χρησιμοποιείται ήδη.");
    }
    throw error;
  }

  try {
    await db.runTransaction(async (transaction) => {
      const [currentEmployee, currentAccount] = await Promise.all([
        transaction.get(employeeRef),
        transaction.get(accountRef)
      ]);
      if (!currentEmployee.exists) {
        throw new HttpsError("not-found", "Ο υπάλληλος δεν βρέθηκε.");
      }
      if (currentEmployee.data()?.["active"] === false) {
        throw new HttpsError("failed-precondition", "Ενεργοποιήστε τον υπάλληλο πριν δημιουργήσετε πρόσβαση.");
      }
      if (currentAccount.exists) {
        throw new HttpsError("already-exists", "Ο υπάλληλος έχει ήδη λογαριασμό dashboard.");
      }

      const userRef = db.doc(`users/${account.uid}`);
      transaction.set(accountRef, {
        tenantId: actor.tenantId,
        employeeId: data.employeeId,
        authUid: account.uid,
        email,
        createdAt: serverTimestamp(),
        createdBy: actor.uid
      });
      transaction.set(userRef, {
        tenantId: actor.tenantId,
        role: "EMPLOYEE",
        employeeId: data.employeeId,
        email,
        active: true,
        createdAt: serverTimestamp(),
        createdBy: actor.uid
      });
    });
  } catch (error) {
    await getAuth().deleteUser(account.uid).catch(() => undefined);
    throw error;
  }

  return { email, employeeId: data.employeeId };
});
