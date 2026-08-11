/**
 * Secure Runtime Alpha 941 ("Encryption Coordination Record") — Phase B
 * of the Alpha 931–990 Conversation Identity Resolution and Encryption
 * Coordinator Arc.
 *
 * Reuses `FedosPrivateConversationConstructionCoordinator`'s own proven
 * crash-recovery pattern (Alpha 915–917) and
 * `FedosConversationDurableRedemptionCoordinator`'s own (Alpha 845–847)
 * field-for-field, substituting the Encryption domain's own phase
 * vocabulary — NOT a generic saga framework, three real phases, one
 * deterministic id, no arbitrary payload, matching both precedents'
 * own explicit prohibition.
 *
 * `coordinationId` is deterministic from `(conversationId,
 * idempotencyKey)` — a caller (or a recovering coordinator instance)
 * that supplies the SAME idempotency key for the SAME conversation
 * always re-derives the SAME coordination id, giving `getCoordination()`
 * a stable lookup with no separate index (mirrors
 * `fedosConversationConstructionCoordinationId`'s own single-key
 * determinism and `fedosConversationRedemptionCoordinationId`'s own
 * multi-part determinism).
 *
 * Phases are TOTALLY ORDERED and only ever move FORWARD:
 *
 *   prepared -> payload-persisted -> envelope-persisted (= completed)
 *            \-> terminal-failed (ONLY from "prepared", strictly before
 *                the ciphertext payload is ever durably written —
 *                recovering from it is identical to recovering from no
 *                fact at all, per the redemption coordinator's own
 *                identical rule).
 *
 * `envelopeId`/`payloadId` are recorded on every fact from `"prepared"`
 * onward so a recovering coordinator reuses the SAME ids a prior attempt
 * already minted — never a second Envelope/Payload for the same
 * idempotency key (`fedos_conversation_encryption_coordinator.ts`'s own
 * "no fake rollback" recovery logic depends on this).
 *
 * HARD GUARDRAILS:
 *   - No plaintext, no ciphertext, no key material, no arbitrary
 *     payload — this record carries coordination bookkeeping only,
 *     mirroring every other coordination-log record in this codebase.
 *   - `schemaVersion` is the literal numeric type `1`.
 *   - This file defines TYPES + one deterministic id helper — no class.
 */

export type FedosConversationEncryptionCoordinationPhase = "prepared" | "payload-persisted" | "envelope-persisted" | "terminal-failed";

export interface FedosPersistedConversationEncryptionCoordinationV1 {
  readonly schemaVersion: 1;
  readonly coordinationId: string;
  readonly conversationId: string;
  /** The Envelope id this attempt uses/used — recorded from `"prepared"` onward, never regenerated on recovery. */
  readonly envelopeId: string;
  /** The Payload id this attempt uses/used — recorded from `"prepared"` onward, never regenerated on recovery. */
  readonly payloadId: string;
  readonly phase: FedosConversationEncryptionCoordinationPhase;
  readonly startedAt: number;
  readonly updatedAt: number;
}

/** Deterministic — one encryption attempt per `(conversationId, idempotencyKey)` pair. Mirrors `fedosConversationRedemptionCoordinationId`'s own `::`-joined, multi-part shape. */
export function fedosConversationEncryptionCoordinationId(conversationId: string, idempotencyKey: string): string {
  return `encryption::${conversationId}::${idempotencyKey}`;
}
