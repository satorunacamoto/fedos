/**
 * Secure Runtime Alpha 1120 ("Activation Coordination Record") — Phase B
 * of the Alpha 1111–1180 Private Conversation Activation and Direct
 * Messaging Runtime Arc.
 *
 * Mirrors `FedosPersistedConversationConstructionCoordinationV1`'s own
 * shape and discipline exactly
 * (`../construction/coordination/fedos_persisted_conversation_construction_coordination_v1.ts`,
 * Alpha 913) — a narrow, versioned, append-only-friendly fact log, never a
 * generic transaction/saga framework (Alpha 1119's own "reject C" ruling).
 *
 * `activationId` is DETERMINISTIC from the Conversation id alone —
 * activation happens at most once per Conversation, so a retried
 * activation re-derives the SAME id and recovery finds the in-flight
 * attempt with no generator or lookup table (Alpha 913's own precedent).
 *
 * Phases are TOTALLY ORDERED and only ever move FORWARD:
 *
 *   prepared -> readiness-confirmed -> lifecycle-activated -> completed
 *            \-> terminal-failed (ONLY from "prepared", strictly before any
 *                readiness fact is durably confirmed — recovering from it is
 *                identical to recovering from no fact at all, matching
 *                `FedosPersistedConversationConstructionCoordinationV1`'s own
 *                identical rule).
 *
 * Once `"completed"` is durable, `resolveFedosConversationActiveConversation()`
 * (`./fedos_conversation_active_lookup.ts`) treats the Conversation as
 * genuinely active — this record is therefore the ONLY durable source of
 * truth for "is this Conversation active", never a rewritten
 * `lifecycleState` field on the immutable draft record (Alpha 1116's own
 * "do not silently rewrite persisted V1 records" instruction).
 *
 * HARD GUARDRAILS:
 *   - No secret key, shared key, or bearer token of any kind.
 *   - `schemaVersion` is the literal numeric type `1`.
 *   - This file defines TYPES + one deterministic id helper — no class, no
 *     I/O.
 */

export type FedosConversationActivationPhase =
  | "prepared"
  | "readiness-confirmed"
  | "lifecycle-activated"
  | "completed"
  | "terminal-failed";

export interface FedosPersistedConversationActivationV1 {
  readonly schemaVersion: 1;
  readonly activationId: string;
  readonly conversationId: string;
  readonly phase: FedosConversationActivationPhase;
  readonly startedAt: number;
  readonly updatedAt: number;
}

/** Deterministic — one activation attempt per Conversation id. Mirrors `fedosConversationConstructionCoordinationId`'s own `::`-joined shape. */
export function fedosConversationActivationId(conversationId: string): string {
  return `activation::${conversationId}`;
}
