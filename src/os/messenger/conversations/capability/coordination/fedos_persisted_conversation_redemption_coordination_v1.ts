/**
 * Secure Runtime Alpha 843 ("Redemption Coordination Record") — Stage 1
 * of Phase D of the Alpha 821–850 Durable Conversation Membership &
 * Capability Persistence Arc.
 *
 * Alpha 824 ("Cross-Authority Coordination Decision") adopted Option D —
 * "a dedicated narrow redemption-coordination record and recovery path"
 * — over a generic transaction framework (Option C, rejected: no
 * existing transaction abstraction exists in this codebase to reuse) and
 * over claiming atomicity without rollback/recovery (Option E, rejected
 * unconditionally). This file is that narrow record — five phases, no
 * generic saga machinery, no arbitrary payload.
 *
 * `coordinationId` is DETERMINISTIC — `(capabilityId, redeemer)`, mirroring
 * the capability-domain's own `"redeemed"` event key (Alpha 833/838) and
 * the membership-domain's own deterministic `FedosConversationMembershipId`
 * (Alpha 767) — a retried `redeemAndAdmit()` call for the SAME redeemer
 * always re-derives the SAME `coordinationId`, so recovery never needs a
 * generator or a lookup table to find "the" in-flight attempt.
 *
 * Phases are TOTALLY ORDERED and only ever move forward within one
 * coordination attempt:
 *
 *   prepared -> capability-consumed -> membership-admitted -> completed
 *            \-> terminal-failed (ONLY reachable directly from
 *                "prepared" -- see `../fedos_conversation_durable_redemption_coordinator.ts`'s
 *                own header for why nothing ever regresses FROM
 *                "capability-consumed" TO "terminal-failed": once the
 *                Capability is durably consumed, a real resource has
 *                already been spent, and Alpha 846's own "no fake
 *                rollback" instruction forbids ever pretending otherwise.)
 *
 * Like Membership persistence (Alpha 827) and Capability persistence
 * (Alpha 837), a durable backend for this record is written as one
 * immutable fact PER `(coordinationId, phase)` — never rewritten — with
 * the CURRENT phase resolved as the highest-ranked phase reached so far
 * (`resolveCurrentCoordinationRecord()`,
 * `./fedos_conversation_redemption_coordination_persistence.ts`).
 *
 * HARD GUARDRAILS:
 *   - No bearer secret, no arbitrary payload — exactly the fields needed
 *     to resume or explain one coordination attempt.
 *   - `schemaVersion` is the literal numeric type `1`.
 *   - This file defines TYPES ONLY — no function, no class.
 */

export type FedosConversationRedemptionCoordinationPhase =
  | "prepared"
  | "capability-consumed"
  | "membership-admitted"
  | "completed"
  | "terminal-failed";

export interface FedosPersistedConversationRedemptionCoordinationV1 {
  readonly schemaVersion: 1;
  readonly coordinationId: string;
  readonly capabilityId: string;
  readonly conversationId: string;
  readonly redeemerAuthority: string;
  readonly redeemerPublicIdentifier: string;
  readonly redeemerIdentityId: string | null;
  readonly phase: FedosConversationRedemptionCoordinationPhase;
  readonly startedAt: number;
  readonly updatedAt: number;
}

/** Deterministic — see this file's own header. Mirrors `fedosConversationCapabilityRedeemedEventKey`'s own `(capabilityId, redeemer)` shape exactly. */
export function fedosConversationRedemptionCoordinationId(
  capabilityId: string,
  redeemerAuthority: string,
  redeemerPublicIdentifier: string,
): string {
  return `${capabilityId}::${redeemerAuthority}::${redeemerPublicIdentifier}`;
}
