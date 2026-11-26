import { assertRole, resolveActorContext } from "../common/auth";
import { resolvePosActor } from "../pos/device-auth";
import { ActorContext } from "../types/domain";

// POS calls send the session's employeeId and are resolved as that employee;
// dashboard calls omit it and must come from the shop owner.
export async function resolveExpenseActor(
  auth: Parameters<typeof resolvePosActor>[0],
  tenantId: string,
  employeeId: unknown
): Promise<ActorContext> {
  if (typeof employeeId === "string" && employeeId) {
    const actor = await resolvePosActor(auth, tenantId, employeeId);
    assertRole(actor, ["OWNER", "EMPLOYEE"]);
    return actor;
  }
  const actor = await resolveActorContext(auth, tenantId);
  assertRole(actor, ["OWNER"]);
  return actor;
}

// Who performed a change, in the shape the dashboard resolves to a name.
export function changedByFields(prefix: "updated" | "voided", actor: ActorContext) {
  if (actor.role === "EMPLOYEE" && actor.employeeId) {
    return { [`${prefix}ByEmployeeId`]: actor.employeeId, [`${prefix}ByUid`]: null };
  }
  return { [`${prefix}ByUid`]: actor.uid, [`${prefix}ByEmployeeId`]: null };
}
