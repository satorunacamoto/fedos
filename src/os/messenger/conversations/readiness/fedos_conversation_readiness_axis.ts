/**
 * Secure Runtime Alpha 898 ("Readiness Axes") — Stage 8 of Phase A of the
 * Alpha 891–930 Private Conversation Draft Construction and Readiness
 * Runtime Arc.
 *
 * A CLOSED, multidimensional readiness model — never one stored boolean
 * (this Arc's own Absolute Prohibition, and the same "distinct axes,
 * never collapsed into one enum" discipline `FedosConversationPolicy`
 * itself already follows, `../../board/runtime/policy/fedos_conversation_policy.ts`,
 * Alpha 653). The nine axes are exactly the nine
 * `docs/reviews/private_conversation_construction_v1/02_readiness_axes.md`
 * derived directly from real source, kept individually named so a future
 * encryption Arc can flip ONE axis without touching the others.
 *
 * Each axis carries one COARSE, closed state — never a raw `Error`, never
 * a free-form string, mirroring every other closed-vocabulary result
 * type in this codebase:
 *   - `"ready"`         — this axis is satisfied right now.
 *   - `"unavailable"`   — the capability is absent right now but may
 *                         appear later (e.g. encryption, before a future
 *                         Rust/WASM activation Arc).
 *   - `"unsupported"`   — structurally impossible in this build (e.g. a
 *                         mode/policy the current validators reject).
 *   - `"failed"`        — a real attempt was made and returned an error
 *                         outcome (e.g. a durable write returned
 *                         `"failed"`).
 *   - `"not-required"`  — this axis has no bearing on THIS construction
 *                         (e.g. an initial Capability that was never
 *                         requested).
 *
 * This file defines TYPES/CONSTANTS ONLY — no evaluation logic (that is
 * `./fedos_conversation_readiness.ts`, Alpha 899), no I/O, no class.
 */

export type FedosConversationReadinessAxis =
  | "identity"
  | "conversationPersistence"
  | "policy"
  | "creatorMembership"
  | "capability"
  | "encryption"
  | "payloadStorage"
  | "retention"
  | "protocolDelivery";

export const FEDOS_CONVERSATION_READINESS_AXES: readonly FedosConversationReadinessAxis[] = [
  "identity",
  "conversationPersistence",
  "policy",
  "creatorMembership",
  "capability",
  "encryption",
  "payloadStorage",
  "retention",
  "protocolDelivery",
];

export type FedosConversationReadinessAxisState =
  | "ready"
  | "unavailable"
  | "unsupported"
  | "failed"
  | "not-required";

export const FEDOS_CONVERSATION_READINESS_AXIS_STATES: readonly FedosConversationReadinessAxisState[] = [
  "ready",
  "unavailable",
  "unsupported",
  "failed",
  "not-required",
];

/** One axis's coarse, closed reading. Immutable. */
export interface FedosConversationReadinessAxisResult {
  readonly axis: FedosConversationReadinessAxis;
  readonly state: FedosConversationReadinessAxisState;
}
