import { HttpsError, onCall } from "firebase-functions/v2/https";
import { Timestamp } from "firebase-admin/firestore";

import { assertRole } from "../common/auth";
import { db } from "../common/firestore";
import { resolvePosActor } from "../pos/device-auth";
import { ListTodayExpensesInput } from "../types/domain";

const MAX_RANGE_MS = 36 * 60 * 60 * 1000;

// The POS sends its own local-day bounds because the shop's timezone is not
// stored server side. The range is capped so this cannot list older history.
export const listTodayExpenses = onCall(async (request) => {
  const data = request.data as ListTodayExpensesInput;
  const from = Number(data?.fromMillis);
  const to = Number(data?.toMillis);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || to - from > MAX_RANGE_MS) {
    throw new HttpsError("invalid-argument", "Μη έγκυρο χρονικό διάστημα.");
  }

  const actor = await resolvePosActor(request.auth, data.tenantId, data.employeeId);
  assertRole(actor, ["OWNER", "EMPLOYEE"]);

  // A day holds few expenses; filtering the employee in memory avoids a composite index.
  const snapshot = await db.collection(`tenants/${actor.tenantId}/expenses`)
    .where("createdAt", ">=", Timestamp.fromMillis(from))
    .where("createdAt", "<", Timestamp.fromMillis(to))
    .orderBy("createdAt", "desc")
    .get();

  const expenses = snapshot.docs
    .filter((doc) => doc.data()["employeeId"] === data.employeeId)
    .map((doc) => {
      const item = doc.data();
      return {
        id: doc.id,
        amount: Number(item["amount"] ?? 0),
        paymentMethod: item["paymentMethod"],
        description: String(item["description"] ?? ""),
        status: item["status"] === "VOIDED" ? "VOIDED" : "ACTIVE",
        createdAtMillis: (item["createdAt"] as Timestamp | undefined)?.toMillis() ?? null,
        edited: item["updatedAt"] != null
      };
    });

  return { expenses };
});
