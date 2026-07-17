/**
 * Secure Runtime Alpha 913 ("Construction Coordination Record") — Stage 3
 * of Phase C of the Alpha 891–930 Private Conversation Draft Construction
 * and Readiness Runtime Arc.
 *
 * Alpha 912 ("Construction Coordination Decision") compared:
 *   A. Conversation first / B. Membership first / C. Capability first —
 *      each a bare ordering with no recovery record; insufficient alone
 *      because Capability issuance is NOT idempotent (two
 *      `issueJoinCapability()` calls mint two DIFFERENT ids —
 *      `10_persistence_coordination.md`), so a naive retry would orphan a
 *      second Capability.
 *   D. a narrow construction-coordination record + recovery path —
 *      ADOPTED, reusing `FedosConversationDurableRedemptionCoordinator`'s
 *      own proven pattern (Alpha 843–847) field-for-field, substituting
 *      construction's own phase vocabulary. Multiple append-only stores
 *      lack rollback, so a durable "how far did we get" fact is the only
 *      honest way to recover.
 *   E. claim transactionality across the separate logs — REJECTED
 *      unconditionally (no shared commit exists).
 *
 * NOT a generic saga framework (Alpha 912's own prohibition) — five real
 * phases, one deterministic id, no arbitrary payload.
 *
 * `coordinationId` is DETERMINISTIC from the Conversation id alone —
 * construction happens at most once per Conversation id (unlike
 * redemption's per-redeemer key), so a retried construction re-derives
 * the SAME id and recovery finds the in-flight attempt with no generator
 * or lookup table.
 *
 * Phases are TOTALLY ORDERED and only ever move FORWARD:
 *
 *   prepared -> conversation-persisted -> creator-membership-admitted
 *            -> capability-issued (SKIPPED when no Capability is
 *               required/requested) -> draft-completed
 *            \-> terminal-failed (ONLY from "prepared", strictly before
 *                any durable draft write succeeds — recovering from it is
 *                identical to recovering from no fact at all).
 *
 * `issuedCapabilityId` records the id of an issued initial Capability so
 * a recovery replay reads the ALREADY-issued id rather than minting a
 * second one (`10`'s own reason for preferring a dedicated log over
 * deterministic re-derivation). It is carried FORWARD onto every later
 * fact so `resolveCurrentConstructionCoordinationRecord()` never loses
 * it. It is a public capability id, NEVER a bearer secret or key material
 * (Alpha 913).
 *
 * HARD GUARDRAILS:
 *   - No bearer secret, no key material, no arbitrary payload.
 *   - `schemaVersion` is the literal numeric type `1`.
 *   - This file defines TYPES + one deterministic id helper — no class.
 */

export type FedosConversationConstructionCoordinationPhase =
  | "prepared"
  | "conversation-persisted"
  | "creator-membership-admitted"
  | "capability-issued"
  | "draft-completed"
  | "terminal-failed";

export interface FedosPersistedConversationConstructionCoordinationV1 {
  readonly schemaVersion: 1;
  readonly coordinationId: string;
  readonly conversationId: string;
  readonly mode: string;
  readonly phase: FedosConversationConstructionCoordinationPhase;
  /** The issued initial Capability's PUBLIC id, or `null` — never a bearer secret. See this file's own header. */
  readonly issuedCapabilityId: string | null;
  readonly startedAt: number;
  readonly updatedAt: number;
}

/** Deterministic — one construction attempt per Conversation id. Mirrors `fedosConversationRedemptionCoordinationId`'s own `::`-joined shape. */
export function fedosConversationConstructionCoordinationId(conversationId: string): string {
  return `construction::${conversationId}`;
}
